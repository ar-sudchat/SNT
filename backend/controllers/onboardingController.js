// Self-service school signup + teacher invites (multi-tenant onboarding).
// Uses basePrisma with explicit tenantId everywhere: nothing here depends on request tenant context.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { basePrisma: db } = require('../config/database');
const groups = require('../services/groups');

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESERVED_SLUGS = new Set(['api', 's', 'ops', 'admin', 'auth', 'p', 'privacy', 'guide', 'static']);
const INVITE_ROLES = new Set(['TEACHER', 'ADMIN']);
const MANAGER_ROLES = new Set(['OWNER', 'ADMIN']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_OWNED_GROUPS = parseInt(process.env.MAX_OWNED_GROUPS || '5', 10);

const err = (status, error) => Object.assign(new Error(error), { status, expose: true });

// ---------- pure helpers (unit tested) ----------
function validateSlug(raw) {
  const slug = String(raw == null ? '' : raw).trim().toLowerCase();
  if (slug.length < 3 || slug.length > 30) return { ok: false, error: 'ชื่อลิงก์ต้องยาว 3-30 ตัวอักษร' };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: 'ใช้ได้เฉพาะ a-z ตัวเลข และขีดกลาง (-)' };
  if (slug.startsWith('-') || slug.endsWith('-')) return { ok: false, error: 'ห้ามขึ้นต้นหรือลงท้ายด้วยขีดกลาง' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: 'ชื่อนี้สงวนไว้ กรุณาใช้ชื่ออื่น' };
  return { ok: true, slug };
}

const newInviteToken = () => crypto.randomBytes(32).toString('hex');

// 'ok' | 'accepted' | 'expired'
function inviteState(invite, now = new Date()) {
  if (invite.acceptedAt) return 'accepted';
  if (new Date(invite.expiresAt).getTime() <= now.getTime()) return 'expired';
  return 'ok';
}

const canManageInvites = (membershipRole) => MANAGER_ROLES.has(membershipRole);

function thaiAcademicYear(d = new Date()) {
  // Thai school year starts in May: Jan-Apr belong to the previous year.
  const y = d.getMonth() < 4 ? d.getFullYear() - 1 : d.getFullYear();
  return y + 543;
}

function validatePassword(pw) {
  const s = String(pw == null ? '' : pw);
  if (s.length < 8) return 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร';
  if (s.length > 128) return 'รหัสผ่านยาวเกินไป';
  return null;
}

// Tiny per-IP fixed-window limiter (per process, like loginRateLimit).
function makeRateLimit(max, windowMs, msg) {
  const hits = new Map();
  const mw = (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10000) for (const [k, v] of hits) if (now - v.first > windowMs) hits.delete(k);
    const k = req.ip;
    let r = hits.get(k);
    if (!r || now - r.first > windowMs) { r = { count: 0, first: now }; hits.set(k, r); }
    r.count += 1;
    if (r.count > max) {
      res.set('Retry-After', String(Math.ceil((r.first + windowMs - now) / 1000)));
      return res.status(429).json({ error: msg });
    }
    next();
  };
  mw._reset = () => hits.clear();
  return mw;
}
const signupRateLimit = makeRateLimit(parseInt(process.env.SIGNUP_MAX || '10', 10), 60 * 60 * 1000, 'สมัครบ่อยเกินไป กรุณาลองใหม่ภายหลัง');
const inviteAcceptRateLimit = makeRateLimit(30, 15 * 60 * 1000, 'ลองบ่อยเกินไป กรุณารอสักครู่');

// ---------- internals ----------
const signToken = (user, tid, trole) =>
  jwt.sign({ userId: user.id, role: user.role, tid, ...(trole ? { trole } : {}) }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const publicUser = (u) => ({ id: u.id, email: u.email, role: u.role, name: u.displayName || u.email });

const publicBase = (req) =>
  (process.env.PUBLIC_URL || req.get('origin') || 'http://localhost:3000').replace(/\/+$/, '');

// Optional auth: returns the User for a valid Bearer token, null when no header, throws 401 when invalid.
async function optionalUser(req) {
  const h = req.headers.authorization;
  if (!h) return null;
  if (!h.startsWith('Bearer ')) throw err(401, 'กรุณาเข้าสู่ระบบใหม่');
  let decoded;
  try { decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); } catch (e) { throw err(401, 'กรุณาเข้าสู่ระบบใหม่'); }
  const user = await db.user.findUnique({ where: { id: decoded.userId } });
  if (!user) throw err(401, 'กรุณาเข้าสู่ระบบใหม่');
  return user;
}

// Resolve + authorize the caller for invite management.
async function managerOf(req) {
  const user = await optionalUser(req);
  if (!user) throw err(401, 'กรุณาเข้าสู่ระบบ');
  let tid = null;
  try { tid = jwt.decode(req.headers.authorization.split(' ')[1]).tid; } catch (e) { /* ignore */ }
  const m = tid
    ? await db.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: tid } } })
    : await db.membership.findFirst({ where: { userId: user.id }, orderBy: { id: 'asc' } });
  if (!m || !canManageInvites(m.role)) throw err(403, 'เฉพาะเจ้าของหรือผู้ดูแลกลุ่มเท่านั้น');
  return { user, tenantId: m.tenantId, role: m.role };
}

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e.expose) return res.status(e.status).json({ error: e.message });
    console.error('onboarding error:', e);
    res.status(500).json({ error: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' });
  }
};

// ---------- handlers ----------
const slugAvailable = wrap(async (req, res) => {
  const v = validateSlug(req.query.slug);
  if (!v.ok) return res.json({ available: false, reason: v.error });
  const t = await db.tenant.findUnique({ where: { slug: v.slug }, select: { id: true } });
  res.json({ available: !t, slug: v.slug, reason: t ? 'ชื่อนี้ถูกใช้แล้ว' : null });
});

const createSchool = wrap(async (req, res) => {
  const { schoolName, slug, ownerName, email, password } = req.body || {};
  const name = String(schoolName || '').trim();
  if (name.length < 2 || name.length > 120) throw err(400, 'กรุณากรอกชื่อโรงเรียน (2-120 ตัวอักษร)');
  const v = validateSlug(slug);
  if (!v.ok) throw err(400, v.error);

  let user = await optionalUser(req); // logged-in (e.g. Google signup) variant
  let hashed = null, mail = null, display = null;
  if (!user) {
    mail = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(mail)) throw err(400, 'อีเมลไม่ถูกต้อง');
    const pe = validatePassword(password);
    if (pe) throw err(400, pe);
    display = String(ownerName || '').trim().slice(0, 80) || null;
    if (await db.user.findUnique({ where: { email: mail }, select: { id: true } })) {
      throw err(409, 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบก่อน แล้วสร้างโรงเรียน');
    }
    hashed = await bcrypt.hash(String(password), 10);
  }

  try {
    const out = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { slug: v.slug, name, joinCode: groups.newJoinCode() } });
      if (!user) {
        user = await tx.user.create({ data: { email: mail, password: hashed, role: 'ADMIN', displayName: display } });
      } else if (user.role !== 'ADMIN' && !(await tx.membership.findFirst({ where: { userId: user.id } }))) {
        user = await tx.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      }
      await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: 'OWNER' } });
      const be = thaiAcademicYear();
      await tx.academicYear.create({
        data: { tenantId: tenant.id, year: String(be), name: `ปีการศึกษา ${be}`, isCurrent: true },
      });
      return { tenant, user };
    });
    res.status(201).json({
      token: signToken(out.user, out.tenant.id),
      user: publicUser(out.user),
      tenant: { id: out.tenant.id, slug: out.tenant.slug, name: out.tenant.name },
    });
  } catch (e) {
    if (e.code === 'P2002') {
      const t = String((e.meta && e.meta.target) || '');
      throw err(409, /slug/.test(t) ? 'ชื่อลิงก์นี้ถูกใช้แล้ว' : 'อีเมลนี้มีบัญชีอยู่แล้ว');
    }
    throw e;
  }
});

const createInvite = wrap(async (req, res) => {
  const m = await managerOf(req);
  const role = String((req.body && req.body.role) || 'TEACHER').toUpperCase();
  if (!INVITE_ROLES.has(role)) throw err(400, 'บทบาทต้องเป็น TEACHER หรือ ADMIN');
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) throw err(400, 'อีเมลไม่ถูกต้อง');
  const inv = await db.invite.create({
    data: { tenantId: m.tenantId, email: email || null, role, token: newInviteToken(), expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  res.status(201).json({ id: inv.id, email: inv.email, role: inv.role, expiresAt: inv.expiresAt, link: `${publicBase(req)}/invite/${inv.token}` });
});

const listInvites = wrap(async (req, res) => {
  const m = await managerOf(req);
  const rows = await db.invite.findMany({ where: { tenantId: m.tenantId }, orderBy: { createdAt: 'desc' }, take: 100 });
  const base = publicBase(req);
  res.json(rows.map((i) => {
    const state = inviteState(i);
    return {
      id: i.id, email: i.email, role: i.role, status: state, createdAt: i.createdAt, expiresAt: i.expiresAt,
      link: state === 'ok' ? `${base}/invite/${i.token}` : null,
    };
  }));
});

const deleteInvite = wrap(async (req, res) => {
  const m = await managerOf(req);
  const id = parseInt(req.params.id, 10);
  const r = Number.isInteger(id) ? await db.invite.deleteMany({ where: { id, tenantId: m.tenantId } }) : { count: 0 };
  if (!r.count) throw err(404, 'ไม่พบคำเชิญ');
  res.json({ ok: true });
});

const previewInvite = wrap(async (req, res) => {
  const inv = await db.invite.findUnique({ where: { token: String(req.params.token) }, include: { tenant: { select: { name: true } } } });
  if (!inv) throw err(404, 'ไม่พบคำเชิญนี้');
  res.json({ schoolName: inv.tenant.name, role: inv.role, email: inv.email, status: inviteState(inv), expiresAt: inv.expiresAt });
});

const acceptInvite = wrap(async (req, res) => {
  const token = String(req.params.token);
  const inv = await db.invite.findUnique({ where: { token }, include: { tenant: { select: { id: true, slug: true, name: true } } } });
  if (!inv) throw err(404, 'ไม่พบคำเชิญนี้');
  const st = inviteState(inv);
  if (st === 'accepted') throw err(410, 'คำเชิญนี้ถูกใช้แล้ว');
  if (st === 'expired') throw err(410, 'คำเชิญหมดอายุแล้ว ขอลิงก์ใหม่จากผู้ดูแลกลุ่ม');

  const body = req.body || {};
  let user = await optionalUser(req);
  if (user) {
    if (inv.email && (user.email || '').toLowerCase() !== inv.email) throw err(403, 'คำเชิญนี้ส่งถึงอีเมลอื่น');
  } else {
    const mail = (inv.email || String(body.email || '').trim().toLowerCase());
    if (!EMAIL_RE.test(mail)) throw err(400, 'กรุณากรอกอีเมล');
    if (inv.email && body.email && String(body.email).trim().toLowerCase() !== inv.email) throw err(403, 'คำเชิญนี้ส่งถึงอีเมลอื่น');
    const existing = await db.user.findUnique({ where: { email: mail } });
    if (existing) {
      if (!body.password || !(await bcrypt.compare(String(body.password), existing.password))) {
        throw err(401, 'อีเมลนี้มีบัญชีแล้ว กรอกรหัสผ่านเดิมเพื่อเข้าร่วม');
      }
      user = existing;
    } else {
      const pe = validatePassword(body.password);
      if (pe) throw err(400, pe);
      user = { _new: true, email: mail, password: await bcrypt.hash(String(body.password), 10), displayName: String(body.name || '').trim().slice(0, 80) || null };
    }
  }

  if (user.id && await db.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: inv.tenantId } } })) {
    throw err(409, 'คุณเป็นสมาชิกของกลุ่มนี้อยู่แล้ว');
  }

  const done = await db.$transaction(async (tx) => {
    // Atomic single-use claim: only one concurrent accept can flip acceptedAt.
    const claim = await tx.invite.updateMany({ where: { id: inv.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });
    if (claim.count !== 1) throw err(410, 'คำเชิญนี้ถูกใช้แล้วหรือหมดอายุ');
    let u = user;
    if (user._new) {
      u = await tx.user.create({ data: { email: user.email, password: user.password, displayName: user.displayName, role: inv.role === 'ADMIN' ? 'ADMIN' : 'TEACHER' } });
    }
    await tx.membership.create({ data: { userId: u.id, tenantId: inv.tenantId, role: inv.role } });
    return u;
  });
  res.json({
    token: signToken(done, inv.tenantId),
    user: publicUser(done),
    tenant: inv.tenant,
    role: inv.role,
  });
});

// ---------- groups ----------
const requireUser = async (req) => {
  const user = await optionalUser(req);
  if (!user) throw err(401, 'กรุณาเข้าสู่ระบบ');
  return user;
};
// Caller's membership in :id (404 when not a member, so group ids are not probeable).
async function membershipIn(req, user) {
  const tenantId = String(req.params.id || '');
  const m = tenantId && await db.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId } } });
  if (!m) throw err(404, 'ไม่พบกลุ่มนี้');
  return m;
}
const requireManager = (m) => { if (!MANAGER_ROLES.has(m.role)) throw err(403, 'เฉพาะเจ้าของหรือผู้ดูแลกลุ่มเท่านั้น'); };
const groupOut = (t, role) => ({ id: t.id, name: t.name, joinCode: t.joinCode || null, kind: t.kind || 'group', role });

const createGroupH = wrap(async (req, res) => {
  const user = await requireUser(req);
  const v = groups.validateGroupName(req.body && req.body.name);
  if (!v.ok) throw err(400, v.error);
  // Each group carries its own free AI quota: cap owned groups so quotas cannot be multiplied.
  const owned = await db.membership.count({ where: { userId: user.id, role: 'OWNER' } });
  if (owned >= MAX_OWNED_GROUPS) throw err(429, `สร้างกลุ่มได้สูงสุด ${MAX_OWNED_GROUPS} กลุ่มต่อบัญชี`);
  const t = await groups.createGroup(db, user, v.name);
  res.status(201).json({ group: groupOut(t, 'OWNER'), token: signToken(user, t.id, 'OWNER') });
});

const joinGroup = wrap(async (req, res) => {
  const user = await requireUser(req);
  const code = groups.normalizeJoinCode(req.body && req.body.code);
  if (!code) throw err(400, 'รหัสกลุ่มไม่ถูกต้อง (รูปแบบ XXX-XXX)');
  const t = await db.tenant.findUnique({ where: { joinCode: code } });
  if (!t || t.status !== 'ACTIVE') throw err(404, 'ไม่พบกลุ่มจากรหัสนี้');
  if (await db.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: t.id } } })) {
    throw err(409, 'คุณเป็นสมาชิกของกลุ่มนี้อยู่แล้ว');
  }
  try {
    await db.membership.create({ data: { userId: user.id, tenantId: t.id, role: 'TEACHER' } });
  } catch (e) { if (e.code === 'P2002') throw err(409, 'คุณเป็นสมาชิกของกลุ่มนี้อยู่แล้ว'); throw e; }
  res.json({ group: groupOut(t, 'TEACHER'), token: signToken(user, t.id, 'TEACHER') });
});

const getGroup = wrap(async (req, res) => {
  const user = await requireUser(req);
  const m = await membershipIn(req, user);
  const t = await db.tenant.findUnique({ where: { id: m.tenantId } });
  if (!t) throw err(404, 'ไม่พบกลุ่มนี้');
  res.json(groupOut(t, m.role));
});

const listMembers = wrap(async (req, res) => {
  const user = await requireUser(req);
  const m = await membershipIn(req, user);
  const rows = await db.membership.findMany({
    where: { tenantId: m.tenantId }, orderBy: { id: 'asc' },
    include: { user: { select: { id: true, email: true, displayName: true, avatar: true, avatarPreset: true } } },
  });
  res.json({
    myRole: m.role,
    members: rows.map((r) => ({
      userId: r.userId, name: r.user.displayName || r.user.email, email: r.user.email,
      avatar: r.user.avatar || null, avatarPreset: r.user.avatarPreset || null, role: r.role, joinedAt: r.createdAt,
    })),
  });
});

const rotateJoinCode = wrap(async (req, res) => {
  const user = await requireUser(req);
  const m = await membershipIn(req, user);
  requireManager(m);
  for (let i = 0; ; i++) {
    try {
      const t = await db.tenant.update({ where: { id: m.tenantId }, data: { joinCode: groups.newJoinCode() } });
      return res.json({ joinCode: t.joinCode });
    } catch (e) { if (e.code !== 'P2002' || i >= 4) throw e; }
  }
});

const removeMember = wrap(async (req, res) => {
  const user = await requireUser(req);
  const m = await membershipIn(req, user);
  const targetId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(targetId)) throw err(400, 'รหัสผู้ใช้ไม่ถูกต้อง');
  const self = targetId === user.id;
  if (!self) requireManager(m);
  const target = await db.membership.findUnique({ where: { userId_tenantId: { userId: targetId, tenantId: m.tenantId } } });
  if (!target) throw err(404, 'ไม่พบสมาชิกนี้ในกลุ่ม');
  if (!self && target.role === 'OWNER' && m.role !== 'OWNER') throw err(403, 'ผู้ดูแลลบเจ้าของกลุ่มไม่ได้');
  if (target.role === 'OWNER') {
    const owners = await db.membership.count({ where: { tenantId: m.tenantId, role: 'OWNER' } });
    if (owners <= 1) throw err(409, 'เจ้าของคนสุดท้ายออกจากกลุ่มไม่ได้ ต้องตั้งเจ้าของคนอื่นก่อน');
  }
  await db.membership.delete({ where: { id: target.id } });
  res.json({ ok: true, left: self });
});

const renameGroup = wrap(async (req, res) => {
  const user = await requireUser(req);
  const m = await membershipIn(req, user);
  requireManager(m);
  const v = groups.validateGroupName(req.body && req.body.name);
  if (!v.ok) throw err(400, v.error);
  const t = await db.tenant.update({ where: { id: m.tenantId }, data: { name: v.name } });
  res.json({ id: t.id, name: t.name });
});

const joinRateLimit = makeRateLimit(30, 15 * 60 * 1000, 'ลองบ่อยเกินไป กรุณารอสักครู่');

module.exports = {
  createGroup: createGroupH, joinGroup, getGroup, listMembers, rotateJoinCode, removeMember, renameGroup, joinRateLimit,
  slugAvailable, createSchool, createInvite, listInvites, deleteInvite, previewInvite, acceptInvite,
  signupRateLimit, inviteAcceptRateLimit,
  validateSlug, newInviteToken, inviteState, canManageInvites, thaiAcademicYear, validatePassword, makeRateLimit,
  RESERVED_SLUGS, INVITE_TTL_MS,
};
