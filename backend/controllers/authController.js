const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { validateProfile, streakOf } = require('../services/profile');
const { withoutTenant } = require('../services/tenantContext');
const google = require('../services/googleAuth');
const groups = require('../services/groups');
const STUDENT_NO_LOGIN = 'นักเรียนไม่ต้องเข้าสู่ระบบ ดูงานได้จากลิงก์ที่ครูส่งให้';

// Tenant for the JWT `tid` claim: the user's first membership. If the user has none,
// attach them to `fallbackTenantId` (or the first tenant) with `role`. (A2 will replace this.)
const MEMBER_ROLE = { ADMIN: 'OWNER', TEACHER: 'TEACHER', STUDENT: 'STUDENT' };
async function tenantForUser(user, fallbackTenantId) {
  // Teacher-code login names a group: land there when the user is a member of it.
  const inGroup = fallbackTenantId && await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: fallbackTenantId } } });
  if (inGroup) return inGroup.tenantId;
  const m = await prisma.membership.findFirst({ where: { userId: user.id }, orderBy: { id: 'asc' } });
  if (m) return m.tenantId;
  let tenantId = fallbackTenantId;
  if (!tenantId) {
    const t = (await prisma.tenant.findUnique({ where: { slug: 'snt' }, select: { id: true } }))
      || (await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }));
    tenantId = t && t.id;
  }
  if (!tenantId) return null;
  await prisma.membership.create({ data: { userId: user.id, tenantId, role: MEMBER_ROLE[user.role] || 'STUDENT' } });
  return tenantId;
}

// Admin credentials come from env. ADMIN_PASSWORD_HASH is a bcrypt hash.
// Legacy fallback (admin/1234) only when ADMIN_PASSWORD_HASH is unset -> loud warning.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const LEGACY_ADMIN_PASSWORD = '1234';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const INVALID_LOGIN = 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
const LEGACY_TENANT_SLUG = process.env.FIRST_TENANT_SLUG || 'snt'; // single-school tenant (scripts/backfillTenant.js)

if (!ADMIN_PASSWORD_HASH) {
  console.warn('\n' + '!'.repeat(72) +
    '\n!! SECURITY WARNING: ADMIN_PASSWORD_HASH is not set.' +
    '\n!! Falling back to the legacy default admin password. Set ADMIN_USERNAME and' +
    '\n!! ADMIN_PASSWORD_HASH (bcrypt) in the environment before production use.\n' +
    '!'.repeat(72) + '\n');
}

if (process.env.ADMIN_PASSWORD_RESET === 'true') {
  console.warn('!! ADMIN_PASSWORD_RESET=true: admin login uses ADMIN_PASSWORD_HASH from env and ignores the in-app password. Remove it after recovery.');
}

// Admin password rule (login and change-password share it):
// - passwordSetAt set (changed in-app) -> DB bcrypt hash only, env no longer accepted
// - otherwise, or ADMIN_PASSWORD_RESET=true -> env ADMIN_PASSWORD_HASH (legacy 1234 only when env unset)
async function checkAdminPassword(password, adminUser) {
  const pw = String(password == null ? '' : password);
  const reset = process.env.ADMIN_PASSWORD_RESET === 'true';
  if (!reset && adminUser && adminUser.passwordSetAt) {
    return !!adminUser.password && bcrypt.compare(pw, adminUser.password);
  }
  const envHash = process.env.ADMIN_PASSWORD_HASH || '';
  if (envHash) return bcrypt.compare(pw, envHash);
  return pw === LEGACY_ADMIN_PASSWORD;
}

const authController = {
  // Login - env admin or teacher code (students do not log in: 410)
  async login(req, res) {
    // Login runs before any tenant is known: look up across tenants explicitly.
    return withoutTenant(() => authController._login(req, res));
  },

  async _login(req, res) {
    try {
      const { username, password } = req.body;

      // 1. Check for Admin login
      if (username === ADMIN_USERNAME) {
        // Find or create admin user
        // Legacy single-school admin only: never pick an arbitrary ADMIN (SaaS owners are ADMIN too).
        // Fallback (admin row with another email) must still be the legacy school's owner: a self-service
        // school owner is role ADMIN too and would otherwise be reachable with the env/legacy password.
        let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', email: LEGACY_ADMIN_EMAIL } })
          || await prisma.user.findFirst({ where: { role: 'ADMIN', memberships: { some: { role: 'OWNER', tenant: { slug: LEGACY_TENANT_SLUG } } } }, orderBy: { id: 'asc' } });
        if (!(await checkAdminPassword(password, adminUser))) {
          return res.status(401).json({ error: INVALID_LOGIN });
        }

        if (!adminUser) {
          const hashedPassword = await bcrypt.hash(String(password), 10);
          adminUser = await prisma.user.create({
            data: {
              email: 'admin@system.local',
              password: hashedPassword,
              role: 'ADMIN'
            }
          });
        }

        const token = jwt.sign(
          { userId: adminUser.id, role: 'ADMIN', tid: await tenantForUser({ ...adminUser, role: 'ADMIN' }) },
          process.env.JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({
          token,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            role: 'ADMIN',
            name: 'ผู้ดูแลระบบ'
          }
        });
      }

      const scope = {};

      // 2. Check for Teacher login (by teacherCode)
      const matches = await prisma.teacher.findMany({
        where: { teacherCode: username, ...scope },
        include: { user: true, account: true },
        take: 2
      });
      // Teacher codes are unique per group only: refuse to guess which group.
      if (matches.length > 1) {
        return res.status(409).json({ error: 'รหัสครูนี้มีอยู่ในหลายกลุ่ม กรุณาเข้าสู่ระบบด้วยอีเมลแทน' });
      }
      const teacher = matches[0] || null;

      if (teacher) {
        // Check if teacher has a user account (legacy User.teacherId, or a group member's Teacher.userId)
        const account = teacher.user || teacher.account;
        if (account) {
          const isValidPassword = await bcrypt.compare(password, account.password);
          if (!isValidPassword) {
            return res.status(401).json({ error: INVALID_LOGIN });
          }
        } else {
          // Auto-create user for teacher (password = teacherCode by default). Legacy school only:
          // in self-service groups codes are guessable (T001...) and anyone could claim the row and
          // join the group; those teachers join by join code / invite instead.
          const home = await prisma.tenant.findUnique({ where: { id: teacher.tenantId }, select: { slug: true } });
          if (password !== teacher.teacherCode || !home || home.slug !== LEGACY_TENANT_SLUG) {
            return res.status(401).json({ error: INVALID_LOGIN });
          }
          const hashedPassword = await bcrypt.hash(password, 10);
          await prisma.user.create({
            data: {
              email: teacher.email || `${teacher.teacherCode}@teacher.local`,
              password: hashedPassword,
              role: 'TEACHER',
              teacherId: teacher.id
            }
          });
        }

        const user = await prisma.user.findFirst({
          where: account ? { id: account.id } : { teacherId: teacher.id },
          include: { teacher: true }
        });

        // Use the role stored on the User row (DB-managed), so a teacher whose
        // role was set to ADMIN in the database logs in with admin privileges.
        const token = jwt.sign(
          { userId: user.id, role: user.role, tid: await tenantForUser(user, teacher.tenantId) },
          process.env.JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            teacher: { id: teacher.id, tenantId: teacher.tenantId, teacherCode: teacher.teacherCode, name: teacher.name, email: teacher.email, status: teacher.status },
            name: teacher.name
          }
        });
      }

      // 3. Check for Student login (by studentCode)
      const student = await prisma.student.findFirst({
        where: { studentCode: username, ...scope },
        select: { id: true }
      });

      // Students no longer log in (they use parent link / QR pages).
      if (student) return res.status(410).json({ error: STUDENT_NO_LOGIN });

      // Not found
      return res.status(401).json({ error: INVALID_LOGIN });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'เข้าสู่ระบบไม่สำเร็จ' });
    }
  },

  // Register (kept for compatibility)
  async register(req, res) {
    try {
      const { email, password, role, teacherId, studentId } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'อีเมลนี้ถูกใช้ลงทะเบียนแล้ว' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
          teacherId: role === 'TEACHER' ? teacherId : null,
          studentId: role === 'STUDENT' ? studentId : null
        },
        include: {
          teacher: true,
          student: true
        }
      });

      const token = jwt.sign(
        { userId: user.id, role: user.role, tid: await withoutTenant(() => tenantForUser(user, req.tenantId)) },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          teacher: user.teacher,
          student: user.student
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'ลงทะเบียนไม่สำเร็จ' });
    }
  },

  // Get current user
  async getCurrentUser(req, res) {
    try {
      // Teacher = this group's Teacher row (resolved by authenticate), not the legacy User.teacherId link.
      const teacher = req.user.teacherId ? await prisma.teacher.findUnique({
        where: { id: req.user.teacherId },
        include: {
          subjects: { where: { status: 'ACTIVE' }, select: { id: true, subjectCode: true, subjectName: true } },
          homeClass: { select: { id: true, className: true } }
        }
      }) : null;
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          student: {
            include: {
              class: {
                include: {
                  grade: true
                }
              }
            }
          }
        }
      });

      const role = req.user.role; // effective role in the current group
      res.json({
        id: user.id,
        email: user.email,
        role,
        trole: req.user.trole || null,
        canManage: !!req.user.canManage,
        name: teacher?.name || user.student?.name || user.displayName || (role === 'ADMIN' ? 'ผู้ดูแลระบบ' : user.email),
        teacher,
        student: user.student,
        avatar: user.avatar || null,
        avatarPreset: user.avatarPreset || null,
        displayName: user.displayName || null,
        bio: user.bio || null,
        accent: user.accent || null,
        tid: req.user.tid || null
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // Update own profile (avatar / preset / display name / bio / accent)
  async updateProfile(req, res) {
    try {
      const { data, error } = validateProfile(req.body);
      if (error) return res.status(400).json({ error });
      // Choosing a preset clears an uploaded photo and vice versa
      if (data.avatar && !('avatarPreset' in data)) data.avatarPreset = null;
      if (data.avatarPreset && !('avatar' in data)) data.avatar = null;
      const u = await prisma.user.update({
        where: { id: req.user.id }, data,
        select: { avatar: true, avatarPreset: true, displayName: true, bio: true, accent: true }
      });
      // A new name shows up everywhere at once: the teacher row of this user in every group.
      if (u.displayName) {
        await prisma.basePrisma.teacher.updateMany({ where: { userId: req.user.id }, data: { name: u.displayName.slice(0, 100) } });
      }
      res.json(u);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'บันทึกโปรไฟล์ไม่สำเร็จ' });
    }
  },

  // Cheap aggregate stats for the profile page
  async getProfileStats(req, res) {
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400e3);
      const since = new Date(now.getTime() - 120 * 86400e3);
      const aiChats = await prisma.aiConversation.count({ where: { userId: req.user.id } });
      if (req.user.role === 'TEACHER' && req.user.teacherId) {
        const tid = req.user.teacherId;
        const [reviewed, reviewedWeek, subjects, students, recent, tasks] = await Promise.all([
          prisma.submission.count({ where: { reviewedById: tid } }),
          prisma.submission.count({ where: { reviewedById: tid, reviewDate: { gte: weekAgo } } }),
          prisma.subject.count({ where: { teacherId: tid, status: 'ACTIVE' } }),
          prisma.submission.groupBy({ by: ['studentId'], where: { task: { subject: { teacherId: tid } } } }).then(r => r.length),
          prisma.submission.findMany({ where: { reviewedById: tid, reviewDate: { gte: since } }, select: { reviewDate: true }, orderBy: { reviewDate: 'desc' }, take: 5000 }),
          prisma.task.count({ where: { createdById: tid } })
        ]);
        return res.json({ role: 'TEACHER', reviewed, reviewedWeek, subjects, students, tasks, aiChats, streak: streakOf(recent.map(r => r.reviewDate), now) });
      }
      if (req.user.role === 'STUDENT' && req.user.studentId) {
        const sid = req.user.studentId;
        const subs = await prisma.submission.findMany({
          where: { studentId: sid, status: { in: ['PENDING', 'APPROVED'] } },
          select: { status: true, submitDate: true, reviewDate: true, task: { select: { deadline: true } } },
          take: 2000
        });
        const onTime = s => !s.task.deadline || ((s.submitDate || s.reviewDate) && new Date(s.submitDate || s.reviewDate) <= s.task.deadline);
        const ordered = subs.filter(s => s.task.deadline).sort((a, b) => b.task.deadline - a.task.deadline);
        let onTimeStreak = 0;
        for (const s of ordered) { if (onTime(s)) onTimeStreak++; else break; }
        return res.json({
          role: 'STUDENT', submitted: subs.length, approved: subs.filter(s => s.status === 'APPROVED').length,
          onTime: subs.filter(onTime).length, onTimeStreak, aiChats
        });
      }
      const [teachers, students, subjects, approved] = await Promise.all([
        prisma.teacher.count({ where: { status: 'ACTIVE' } }),
        prisma.student.count({ where: { status: 'ACTIVE' } }),
        prisma.subject.count({ where: { status: 'ACTIVE' } }),
        prisma.submission.count({ where: { status: 'APPROVED' } })
      ]);
      res.json({ role: 'ADMIN', teachers, students, subjects, approved, aiChats });
    } catch (error) {
      console.error('Profile stats error:', error);
      res.status(500).json({ error: 'โหลดสถิติไม่สำเร็จ' });
    }
  },

  // Logout
  async logout(req, res) {
    res.json({ message: 'ออกจากระบบแล้ว' });
  },

  // Change password for the signed-in user. No current password needed: the session already proves
  // who they are (owner decision 2026-10-24). Errors are 400, not 401 (401 means "session expired" to the frontend).
  async changePassword(req, res) {
    try {
      const newPassword = String((req.body && req.body.newPassword) || '');
      if (newPassword.length < 8) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
      if (newPassword.length > 128) return res.status(400).json({ error: 'รหัสผ่านใหม่ยาวเกินไป' });
      const code = req.user.teacher?.teacherCode || req.user.student?.studentCode || '';
      if (code && newPassword.toLowerCase() === String(code).toLowerCase()) {
        return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผู้ใช้' });
      }
      const isAdmin = req.user.role === 'ADMIN';
      if (isAdmin && newPassword.toLowerCase() === String(ADMIN_USERNAME).toLowerCase()) {
        return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผู้ใช้' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const data = isAdmin ? { password: hashedPassword, passwordSetAt: new Date() } : { password: hashedPassword };
      await prisma.user.update({ where: { id: req.user.id }, data });

      res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ' });
    }
  }
};

// ---- Accounts (email / Google), memberships, tenant switching ----
const LEGACY_ADMIN_EMAIL = 'admin@system.local';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_OFF = 'ยังไม่เปิดใช้การเข้าสู่ระบบด้วย Google';
const NONCE_COOKIE = 'ks_gstate';

const signFor = async (user, tenantId) => {
  let m = null;
  if (tenantId) m = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } });
  if (!m) m = await prisma.membership.findFirst({ where: { userId: user.id }, orderBy: { id: 'asc' } });
  if (!m) { // every account has a group: create the personal one on first login/signup
    const t = await groups.createPersonalGroup(prisma, user);
    m = { tenantId: t.id, role: 'OWNER' };
  }
  const token = jwt.sign(
    { userId: user.id, role: user.role, tid: m.tenantId, trole: m.role },
    process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { token, tid: m.tenantId, trole: m.role };
};
const publicUser = (u, extra = {}) => ({ id: u.id, email: u.email, role: u.role, name: u.displayName || u.email, ...extra });
const readCookie = (req, name) => {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
};
const cookieAttrs = (maxAgeSec) =>
  `Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${google.publicUrl().startsWith('https') ? '; Secure' : ''}`;

const LINK_REQUIRED = 'link_required';
// Find a User for verified Google claims by googleSub; new email -> new account.
async function linkGoogleUser({ sub, email, name }) {
  let user = await prisma.user.findUnique({ where: { googleSub: sub } });
  if (user) return user;
  user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    if (user.googleSub && user.googleSub !== sub) return null;
    // Never auto-link to a password account: email/password signup and teacher-code accounts are
    // unverified, so whoever registered this email first would own the Google user's account
    // (pre-account takeover). SAAS-DESIGN §auth: log in with the password instead.
    return LINK_REQUIRED;
  }
  const password = await bcrypt.hash(require('node:crypto').randomBytes(24).toString('hex'), 10);
  return prisma.user.create({ data: { email, googleSub: sub, password, role: 'TEACHER', displayName: name || null } });
}

Object.assign(authController, {
  async config(req, res) {
    res.json({ google: google.isConfigured() });
  },

  async signup(req, res) {
    return withoutTenant(async () => {
      try {
        const email = String((req.body && req.body.email) || '').trim().toLowerCase();
        const password = String((req.body && req.body.password) || '');
        const name = req.body && req.body.name ? String(req.body.name).slice(0, 80) : null;
        if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
        if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'รหัสผ่านต้องมี 8-128 ตัวอักษร' });
        if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้ลงทะเบียนแล้ว' });
        const user = await prisma.user.create({ data: { email, password: await bcrypt.hash(password, 10), role: 'TEACHER', displayName: name } });
        const { token, tid, trole } = await signFor(user);
        res.status(201).json({ token, user: publicUser(user, { tid, trole }) });
      } catch (e) {
        console.error('Signup error:', e);
        res.status(500).json({ error: 'สมัครสมาชิกไม่สำเร็จ' });
      }
    });
  },

  async emailLogin(req, res) {
    return withoutTenant(async () => {
      try {
        const email = String((req.body && req.body.email) || '').trim().toLowerCase();
        const password = String((req.body && req.body.password) || '');
        const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
        // Legacy admin row is env/passwordSetAt-managed: must use the admin username path.
        // (School owners are role ADMIN too and log in here normally.)
        if (!user || user.email === LEGACY_ADMIN_EMAIL || !(await bcrypt.compare(password, user.password || ''))) {
          return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        }
        const { token, tid } = await signFor(user);
        res.json({ token, user: publicUser(user, { tid }) });
      } catch (e) {
        console.error('Email login error:', e);
        res.status(500).json({ error: 'เข้าสู่ระบบไม่สำเร็จ' });
      }
    });
  },

  async googleStart(req, res) {
    if (!google.isConfigured()) return res.status(503).json({ error: GOOGLE_OFF });
    const { state, nonce } = google.createState();
    res.setHeader('Set-Cookie', `${NONCE_COOKIE}=${nonce}; ${cookieAttrs(Math.floor(google.STATE_TTL_MS / 1000))}`);
    res.redirect(302, google.authUrl(state));
  },

  async googleCallback(req, res) {
    if (!google.isConfigured()) return res.status(503).json({ error: GOOGLE_OFF });
    const back = (frag) => {
      res.setHeader('Set-Cookie', `${NONCE_COOKIE}=; ${cookieAttrs(0)}`);
      res.redirect(302, `${google.publicUrl()}/auth/callback#${frag}`);
    };
    const { code, state, error } = req.query || {};
    if (error || !code) return back('error=cancelled');
    if (!google.verifyState(state, readCookie(req, NONCE_COOKIE))) return back('error=state');
    return withoutTenant(async () => {
      try {
        const claims = await google.verifyIdToken(await google.exchangeCode(String(code)));
        const user = await linkGoogleUser(claims);
        if (!user) return back('error=conflict');
        if (user === LINK_REQUIRED) return back('error=link_required');
        const { token } = await signFor(user);
        back(`token=${encodeURIComponent(token)}`);
      } catch (e) {
        console.error('Google callback error:', e.message);
        back('error=google');
      }
    });
  },

  async memberships(req, res) {
    return withoutTenant(async () => {
      try {
        const rows = await prisma.membership.findMany({
          where: { userId: req.user.id }, orderBy: { id: 'asc' },
          include: { tenant: { select: { id: true, slug: true, name: true, joinCode: true, kind: true } } },
        });
        res.json({ current: req.user.tid || null, memberships: rows.map(m => ({ tenantId: m.tenant.id, tenantName: m.tenant.name, slug: m.tenant.slug, joinCode: m.tenant.joinCode || null, kind: m.tenant.kind || 'group', role: m.role })) });
      } catch (e) {
        console.error('Memberships error:', e);
        res.status(500).json({ error: 'โหลดรายชื่อกลุ่มไม่สำเร็จ' });
      }
    });
  },

  async switchTenant(req, res) {
    return withoutTenant(async () => {
      try {
        const tenantId = req.body && typeof req.body.tenantId === 'string' ? req.body.tenantId : '';
        const m = tenantId && await prisma.membership.findUnique({ where: { userId_tenantId: { userId: req.user.id, tenantId } } });
        if (!m) return res.status(403).json({ error: 'คุณไม่ได้เป็นสมาชิกของกลุ่มนี้' });
        const { token, tid, trole } = await signFor(req.user, m.tenantId);
        res.json({ token, tid, role: trole });
      } catch (e) {
        console.error('Switch tenant error:', e);
        res.status(500).json({ error: 'สลับกลุ่มไม่สำเร็จ' });
      }
    });
  },
});

module.exports = authController;
module.exports._linkGoogleUser = linkGoogleUser;
