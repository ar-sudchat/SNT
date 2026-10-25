const crypto = require('crypto');
const prisma = require('../config/database');
const { withoutTenant, runWithTenant, getTenantId } = require('../services/tenantContext');

const INVALID_MSG = 'ลิงก์หมดอายุหรือไม่ถูกต้อง';
const FORBIDDEN_MSG = 'คุณไม่มีสิทธิ์สร้างลิงก์ให้นักเรียนคนนี้ (ไม่ได้สอนห้อง/ระดับชั้นนี้)';

let warned = false;
function getSecret() {
  if (process.env.PARENT_LINK_SECRET) return process.env.PARENT_LINK_SECRET;
  if (!warned) {
    warned = true;
    console.warn('[parent-links] PARENT_LINK_SECRET not set; deriving from JWT_SECRET. Set PARENT_LINK_SECRET in production.');
  }
  return crypto.createHash('sha256').update('parent-link:' + (process.env.JWT_SECRET || '')).digest('hex');
}
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');

function signToken(studentId, days, tenantId) {
  const d = Number(days || process.env.PARENT_LINK_DAYS) || 120;
  const exp = Math.floor(Date.now() / 1000) + Math.round(d * 86400);
  const payload = b64u(JSON.stringify(tenantId ? { sid: Number(studentId), tid: String(tenantId), exp } : { sid: Number(studentId), exp }));
  return { token: `${payload}.${hmac(payload)}`, exp };
}

function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const expected = Buffer.from(hmac(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!Number.isInteger(data.sid) || typeof data.exp !== 'number') return null;
    if (data.tid !== undefined && (typeof data.tid !== 'string' || !data.tid)) return null;
    if (data.exp * 1000 < Date.now()) return null;
    return data;
  } catch { return null; }
}

// Teacher may create links for students in a class they home-teach, or whose grade
// (and academic year) has a subject they teach. ADMIN bypasses.
async function teacherCanAccessStudent(user, student) {
  if (user.role === 'ADMIN' || user.canManage) return true;
  const teacherId = user.teacherId || (user.teacher && user.teacher.id);
  if (!teacherId) return false;
  if (student.class.teacherId === teacherId) return true;
  const where = { teacherId, gradeId: student.class.gradeId };
  if (student.class.academicYearId) where.academicYearId = student.class.academicYearId;
  const n = await prisma.subject.count({ where });
  return n > 0;
}

function buildUrl(req, token) {
  const base = (process.env.PARENT_LINK_BASE_URL || process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`)
    .split(',')[0].trim().replace(/\/+$/, '');
  return `${base}/p/${token}`;
}

exports.createLink = async (req, res) => {
  try {
    const studentId = parseInt(req.body && req.body.studentId);
    if (!studentId) return res.status(400).json({ error: 'กรุณาระบุนักเรียน' });
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, class: { select: { teacherId: true, gradeId: true, academicYearId: true } } }
    });
    if (!student) return res.status(404).json({ error: 'ไม่พบข้อมูลนักเรียน' });
    if (!(await teacherCanAccessStudent(req.user, student))) return res.status(403).json({ error: FORBIDDEN_MSG });
    const { token, exp } = signToken(studentId, undefined, req.tenantId || getTenantId());
    res.json({ url: buildUrl(req, token), token, expiresAt: new Date(exp * 1000).toISOString() });
  } catch (e) {
    console.error('createLink', e);
    res.status(500).json({ error: 'สร้างลิงก์ไม่สำเร็จ' });
  }
};

const STATUS_WORDS = {
  APPROVED: 'ส่งแล้ว (ผ่าน)',
  PENDING: 'ส่งแล้ว รอตรวจ',
  REJECTED: 'ต้องแก้ไข ส่งใหม่',
  NOT_SUBMITTED: 'ยังไม่ส่ง'
};

exports.getPublic = async (req, res) => {
  const data = verifyToken(req.params.token);
  if (!data) return res.status(401).json({ error: INVALID_MSG });
  try {
    // Public link: the tenant comes from the signed student id, then everything below is scoped.
    // async + await: PrismaPromise ทำงานตอน await จึงต้อง await ภายใน withoutTenant ไม่งั้นหลุด scope (Student เป็นตารางของกลุ่ม)
    const owner = await withoutTenant(async () => await prisma.student.findUnique({ where: { id: data.sid }, select: { tenantId: true, tenant: { select: { status: true } } } }));
    if (!owner) return res.status(401).json({ error: INVALID_MSG });
    // Suspended / pending-delete groups stop serving data, like the logged-in API (authenticate).
    if (owner.tenant && owner.tenant.status !== 'ACTIVE') return res.status(401).json({ error: INVALID_MSG });
    // New tokens bind tid in the signed payload; it must match the student's tenant. Legacy tokens: no tid.
    if (data.tid && data.tid !== owner.tenantId) return res.status(401).json({ error: INVALID_MSG });
    // เปิด scope ของกลุ่มนักเรียนเอง: setTenantId() เงียบเมื่อ scope ของ request หลุด (เจอจริงที่ลิงก์ผู้ปกครอง ตอบ 500)
    await runWithTenant(owner.tenantId, async () => {
      const student = await prisma.student.findUnique({
        where: { id: data.sid },
        select: {
          id: true, name: true, status: true,
          class: { select: { className: true, gradeId: true, academicYearId: true, academicYear: { select: { year: true, name: true } } } }
        }
      });
      if (!student || student.status !== 'ACTIVE') return res.status(401).json({ error: INVALID_MSG });
      const yearId = student.class.academicYearId;
      const subjects = await prisma.subject.findMany({
        where: { gradeId: student.class.gradeId, academicYearId: yearId, status: 'ACTIVE' },
        select: {
          id: true, subjectName: true,
          tasks: { where: { status: 'ACTIVE' }, orderBy: { taskNumber: 'asc' }, select: { id: true, taskName: true, taskNumber: true, deadline: true } }
        },
        orderBy: { subjectName: 'asc' }
      });
      const subs = await prisma.submission.findMany({
        where: { studentId: student.id, taskId: { in: subjects.flatMap(s => s.tasks.map(t => t.id)) } },
        select: { taskId: true, status: true, submitDate: true }
      });
      const byTask = Object.fromEntries(subs.map(s => [s.taskId, s]));
      const now = Date.now();
      const summary = { total: 0, submitted: 0, approved: 0, pending: 0, rejected: 0, missing: 0, overdue: 0 };
      const out = subjects.map(s => ({
        subjectName: s.subjectName,
        tasks: s.tasks.map(t => {
          const st = (byTask[t.id] && byTask[t.id].status) || 'NOT_SUBMITTED';
          const done = st === 'APPROVED' || st === 'PENDING';
          const overdue = !done && !!t.deadline && new Date(t.deadline).getTime() < now;
          summary.total++;
          if (st !== 'NOT_SUBMITTED') summary.submitted++;
          if (st === 'APPROVED') summary.approved++;
          if (st === 'PENDING') summary.pending++;
          if (st === 'REJECTED') summary.rejected++;
          if (!done) summary.missing++;
          if (overdue) summary.overdue++;
          return { taskNumber: t.taskNumber, taskName: t.taskName, deadline: t.deadline, status: st, statusText: STATUS_WORDS[st], overdue };
        })
      }));
      const firstName = String(student.name || '').trim().replace(/^(เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|นาย|นางสาว|น\.ส\.)\s*/, '').split(/\s+/)[0];
      res.set('Cache-Control', 'no-store');
      res.set('X-Robots-Tag', 'noindex');
      res.json({
        student: { firstName, className: student.class.className },
        academicYear: student.class.academicYear ? (student.class.academicYear.name || student.class.academicYear.year) : null,
        subjects: out,
        summary,
        expiresAt: new Date(data.exp * 1000).toISOString(),
        generatedAt: new Date().toISOString()
      });
    });
  } catch (e) {
    console.error('getPublic parent', e);
    res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
  }
};

exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.teacherCanAccessStudent = teacherCanAccessStudent;
exports.INVALID_MSG = INVALID_MSG;
