// Group (tenant) access: effective role from Membership, one Teacher row per staff member per group.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 'test';
const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
const ctx = require('../services/tenantContext');

// In-memory prisma. Teacher queries are tenant-scoped like the real extension (getTenantId()).
const D = { users: [], teachers: [], memberships: [], tenants: [{ id: 'gA', status: 'ACTIVE' }, { id: 'gB', status: 'ACTIVE' }] };
let seq = 1000;
const match = (row, where = {}) => Object.entries(where).every(([k, v]) => row[k] === v);
const scoped = (where = {}) => { const tid = ctx.getTenantId(); return tid && !ctx.isBypassed() ? { ...where, tenantId: tid } : where; };
const dup = () => Object.assign(new Error('dup'), { code: 'P2002' });
const tick = () => new Promise(r => setImmediate(r));
const db = {
  teacher: {
    findFirst: async ({ where }) => { await tick(); return D.teachers.find(t => match(t, scoped(where))) || null; },
    findUnique: async ({ where }) => D.teachers.find(t => match(t, scoped(where))) || null,
    findMany: async ({ where, take }) => D.teachers.filter(t => match(t, where)).slice(0, take)
      .map(t => ({ ...t, user: D.users.find(u => u.teacherId === t.id) || null, account: D.users.find(u => u.id === t.userId) || null })),
    create: async ({ data }) => {
      await tick();
      const row = { id: seq++, status: 'ACTIVE', ...data, tenantId: ctx.getTenantId() };
      if (D.teachers.some(t => t.tenantId === row.tenantId && t.teacherCode === row.teacherCode)) throw dup();
      D.teachers.push(row); return row;
    },
    update: async ({ where, data }) => Object.assign(D.teachers.find(t => match(t, scoped(where))), data),
  },
  user: {
    findUnique: async ({ where }) => { const u = D.users.find(x => match(x, where)); return u ? { ...u, teacher: D.teachers.find(t => t.id === u.teacherId) || null, student: null } : null; },
    findFirst: async ({ where }) => D.users.find(x => match(x, where)) || null,
    create: async ({ data }) => { const u = { id: seq++, ...data }; D.users.push(u); return u; },
  },
  membership: {
    findFirst: async ({ where }) => D.memberships.find(m => m.userId === where.userId) || null,
    findUnique: async ({ where }) => { const k = where.userId_tenantId; return D.memberships.find(m => m.userId === k.userId && m.tenantId === k.tenantId) || null; },
    create: async ({ data }) => { const m = { id: seq++, ...data }; D.memberships.push(m); return m; },
  },
  tenant: { findUnique: async ({ where }) => D.tenants.find(t => t.id === where.id) || null },
  student: { findFirst: async () => null },
};
stub('config/database', Object.assign({}, db, { basePrisma: db }));

const { accessFor, ensureTeacherFor } = require('../services/teacherAccount');
const { authenticate, isAdmin, authorize, isTeacher } = require('../middleware/auth');
const authCtrl = require('../controllers/authController');

const addUser = (u) => { const row = { id: seq++, password: 'x', teacherId: null, ...u }; D.users.push(row); return row; };
const member = (userId, tenantId, role) => D.memberships.push({ id: seq++, userId, tenantId, role });
const tok = (u, tid) => jwt.sign({ userId: u.id, role: u.role, tid }, 'test');

// Runs authenticate (inside a request scope, like server.js), then optional guards. Returns req + outcome.
function run(token, ...guards) {
  return new Promise((resolve) => {
    const req = { headers: { authorization: `Bearer ${token}` }, originalUrl: '/api/x' };
    const res = { statusCode: 200, status(s) { this.statusCode = s; return this; }, json(b) { resolve({ req, status: this.statusCode, body: b }); } };
    const chain = [authenticate, ...guards];
    const step = (i) => (i === chain.length ? resolve({ req, status: 200, passed: true }) : chain[i](req, res, () => step(i + 1)));
    ctx.enterScope(() => step(0));
  });
}
const call = (fn, req) => new Promise((resolve) => {
  const res = { statusCode: 200, status(s) { this.statusCode = s; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  fn({ headers: {}, body: {}, ...req }, res);
});

test('accessFor: permissions follow the membership in the current group', () => {
  assert.deepStrictEqual(accessFor('TEACHER', 'OWNER'), { role: 'TEACHER', canManage: true });
  assert.deepStrictEqual(accessFor('TEACHER', 'ADMIN'), { role: 'TEACHER', canManage: true });
  assert.deepStrictEqual(accessFor('TEACHER', 'TEACHER'), { role: 'TEACHER', canManage: false });
  assert.deepStrictEqual(accessFor('ADMIN', 'OWNER'), { role: 'ADMIN', canManage: true });
  // a school admin who joined someone else's group as a teacher is only a teacher there
  assert.deepStrictEqual(accessFor('ADMIN', 'TEACHER'), { role: 'TEACHER', canManage: false });
  assert.deepStrictEqual(accessFor('ADMIN', null), { role: 'ADMIN', canManage: false });
  assert.deepStrictEqual(accessFor('STUDENT', 'STUDENT'), { role: 'STUDENT', canManage: false });
  assert.deepStrictEqual(accessFor('TEACHER', 'STUDENT'), { role: 'STUDENT', canManage: false });
});

test('ensureTeacherFor: one row per user per group, idempotent and race-safe', async () => {
  const u = addUser({ email: 'own@x.com', role: 'TEACHER', displayName: 'อาทิตย์ สุดใจ' });
  const [a, b, c] = await Promise.all([ensureTeacherFor(u, 'gA'), ensureTeacherFor(u, 'gA'), ensureTeacherFor(u, 'gA')]);
  assert.ok(a && a.id === b.id && b.id === c.id);
  assert.deepStrictEqual([a.tenantId, a.userId, a.name, a.teacherCode, a.email], ['gA', u.id, 'อาทิตย์ สุดใจ', `T${u.id}`, 'own@x.com']);
  assert.strictEqual((await ensureTeacherFor(u, 'gA')).id, a.id);
  const inB = await ensureTeacherFor(u, 'gB');
  assert.notStrictEqual(inB.id, a.id); assert.strictEqual(inB.tenantId, 'gB');
  assert.strictEqual(D.teachers.filter(t => t.userId === u.id).length, 2);
  assert.strictEqual(await ensureTeacherFor(u, null), null);
});

test('ensureTeacherFor: adopts the legacy User.teacherId row in the same group; code collision gets a suffix', async () => {
  const legacy = { id: seq++, tenantId: 'gA', teacherCode: 'K01', name: 'ครูเดิม', status: 'ACTIVE', userId: null };
  D.teachers.push(legacy);
  const u = addUser({ email: 'old@x.com', role: 'TEACHER', teacherId: legacy.id });
  assert.strictEqual((await ensureTeacherFor(u, 'gA')).id, legacy.id);
  assert.strictEqual(legacy.userId, u.id);
  const other = await ensureTeacherFor(u, 'gB'); // legacy row is in gA: not reused for gB
  assert.notStrictEqual(other.id, legacy.id);

  const v = addUser({ email: 'v@x.com', role: 'TEACHER' });
  D.teachers.push({ id: seq++, tenantId: 'gA', teacherCode: `T${v.id}`, name: 'someone else', userId: null });
  assert.strictEqual((await ensureTeacherFor(v, 'gA')).teacherCode, `T${v.id}-2`);
});

test('authenticate: group OWNER on a TEACHER account gets a Teacher row and setup rights', async () => {
  const u = addUser({ email: 'owner@x.com', role: 'TEACHER', displayName: 'ครูเจ้าของ' });
  member(u.id, 'gA', 'OWNER');
  const r = await run(tok(u, 'gA'), isAdmin, authorize('ADMIN'), isTeacher);
  assert.strictEqual(r.passed, true);
  assert.strictEqual(r.req.user.role, 'TEACHER');
  assert.strictEqual(r.req.user.canManage, true);
  assert.strictEqual(r.req.user.trole, 'OWNER');
  assert.ok(r.req.user.teacherId);
  assert.strictEqual(r.req.user.teacher.tenantId, 'gA');
  assert.strictEqual(r.req.tenantId, 'gA');
});

test('authenticate: TEACHER member cannot set up the group; global ADMIN is only a teacher in a joined group', async () => {
  const t = addUser({ email: 'mem@x.com', role: 'TEACHER' });
  member(t.id, 'gA', 'TEACHER');
  let r = await run(tok(t, 'gA'), isAdmin);
  assert.strictEqual(r.status, 403);
  assert.strictEqual(r.req.user.canManage, false);
  assert.ok(r.req.user.teacherId, 'member still gets a Teacher row to teach in this group');
  r = await run(tok(t, 'gA'), authorize('ADMIN'));
  assert.strictEqual(r.status, 403);

  const boss = addUser({ email: 'boss@x.com', role: 'ADMIN' });
  member(boss.id, 'gA', 'OWNER');
  member(boss.id, 'gB', 'TEACHER');
  r = await run(tok(boss, 'gA'), isAdmin);
  assert.strictEqual(r.passed, true); assert.strictEqual(r.req.user.role, 'ADMIN');
  assert.strictEqual(r.req.user.teacherId, null, 'admins are not silently added to the teacher list');
  r = await run(tok(boss, 'gB'), isAdmin);
  assert.strictEqual(r.status, 403);
  assert.strictEqual(r.req.user.role, 'TEACHER');
  assert.ok(r.req.user.teacherId);
});

test('authenticate: a legacy teacher link into another group is not used in this group', async () => {
  const foreign = { id: seq++, tenantId: 'gB', teacherCode: 'L1', name: 'ครูโรงเรียนเก่า', userId: null };
  D.teachers.push(foreign);
  const u = addUser({ email: 'leg@x.com', role: 'TEACHER', teacherId: foreign.id });
  member(u.id, 'gA', 'OWNER');
  const r = await run(tok(u, 'gA'));
  assert.notStrictEqual(r.req.user.teacherId, foreign.id);
  assert.strictEqual(r.req.user.teacher.tenantId, 'gA');
});

test('/auth/me: current group teacher, trole/canManage, no "ผู้ดูแลระบบ" name for teachers', async () => {
  const u = addUser({ email: 'me@x.com', role: 'TEACHER', displayName: 'ครูมี' });
  member(u.id, 'gA', 'OWNER');
  const r = await run(tok(u, 'gA'));
  const me = await new Promise((resolve) => ctx.runWithTenant('gA', () =>
    call(authCtrl.getCurrentUser, { user: r.req.user }).then(resolve)));
  assert.strictEqual(me.status, 200);
  assert.strictEqual(me.body.role, 'TEACHER');
  assert.strictEqual(me.body.canManage, true);
  assert.strictEqual(me.body.trole, 'OWNER');
  assert.strictEqual(me.body.teacher.id, r.req.user.teacherId);
  assert.strictEqual(me.body.name, 'ครูมี');
});

test('teacher-code login: a group member\'s Teacher row needs that account\'s password (no auto-created login)', async () => {
  const u = addUser({ email: 'code@x.com', role: 'TEACHER', password: await bcrypt.hash('real-pass-1', 4) });
  member(u.id, 'gA', 'OWNER');
  const t = await ensureTeacherFor(u, 'gA');
  const before = D.users.length;
  let r = await call(authCtrl.login, { body: { username: t.teacherCode, password: t.teacherCode } });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(D.users.length, before, 'must not create a second account bound to this teacher');
  r = await call(authCtrl.login, { body: { username: t.teacherCode, password: 'real-pass-1' } });
  assert.strictEqual(r.status, 200);
  const claims = jwt.verify(r.body.token, 'test');
  assert.strictEqual(claims.userId, u.id);
  assert.strictEqual(claims.tid, 'gA');
});
