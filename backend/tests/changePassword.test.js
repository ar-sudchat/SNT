const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
process.env.JWT_SECRET = 'test';
const db = { users: {}, students: {} };
stub('config/database', {
  user: {
    findUnique: async ({ where }) => db.users[where.id] || null,
    update: async ({ where, data }) => Object.assign(db.users[where.id], data),
    findFirst: async ({ where }) => Object.values(db.users).find(u => where.role ? u.role === where.role : u.studentId === where.studentId) || null,
    create: async ({ data }) => { const u = { id: 'new', ...data }; db.users[u.id] = u; return u; },
  },
  teacher: { findFirst: async () => null, findMany: async () => [] },
  student: { findFirst: async ({ where }) => db.students[where.studentCode] || null },
  membership: { findFirst: async () => ({ tenantId: 't1' }) },
  tenant: { findFirst: async () => ({ id: 't1' }) },
});
const ctrl = require('../controllers/authController');

function call(fn, user, body) {
  return new Promise((resolve) => {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
    fn({ user, body }, res);
  });
}

test('changePassword', async (t) => {
  const hash = await bcrypt.hash('T001', 4);
  const teacherUser = () => (db.users.u1 = { id: 'u1', role: 'TEACHER', password: hash, teacher: { teacherCode: 'TEACHER01' } });

  await t.test('admin: change in-app, old env password stops working, reset flag restores env', async () => {
    process.env.ADMIN_PASSWORD_HASH = await bcrypt.hash('envpass123', 4);
    db.users.a = { id: 'a', role: 'ADMIN', email: 'admin@system.local', password: 'x', passwordSetAt: null };
    const login = (pw) => call(ctrl.login, null, { username: 'admin', password: pw }).then(r => r.status);
    assert.strictEqual(await login('envpass123'), 200);
    let r = await call(ctrl.changePassword, db.users.a, { newPassword: 'short' });
    assert.strictEqual(r.status, 400);
    r = await call(ctrl.changePassword, db.users.a, { newPassword: 'adminNew99' });
    assert.strictEqual(r.status, 200);
    assert.ok(db.users.a.passwordSetAt instanceof Date);
    assert.strictEqual(await login('envpass123'), 401);
    assert.strictEqual(await login('adminNew99'), 200);
    process.env.ADMIN_PASSWORD_RESET = 'true';
    try {
      assert.strictEqual(await login('envpass123'), 200);
      assert.strictEqual(await login('adminNew99'), 401);
    } finally { delete process.env.ADMIN_PASSWORD_RESET; }
    assert.strictEqual(await login('adminNew99'), 200);
    delete db.users.a; delete process.env.ADMIN_PASSWORD_HASH;
  });
  await t.test('no current password needed: signed-in user sets a new one', async () => {
    const u = teacherUser();
    const r = await call(ctrl.changePassword, u, { newPassword: 'abcdefgh1' });
    assert.strictEqual(r.status, 200);
    assert.ok(await bcrypt.compare('abcdefgh1', db.users.u1.password));
  });
  await t.test('validation: short, equals code', async () => {
    const u = teacherUser();
    for (const [np, re] of [['short', /8 ตัว/], ['teacher01', /รหัสผู้ใช้/]]) {
      const r = await call(ctrl.changePassword, u, { newPassword: np });
      assert.strictEqual(r.status, 400); assert.match(r.body.error, re);
    }
    assert.strictEqual(db.users.u1.password, hash);
  });
  await t.test('success updates hash', async () => {
    const u = teacherUser();
    const r = await call(ctrl.changePassword, u, { currentPassword: 'T001', newPassword: 'newpass123' });
    assert.strictEqual(r.status, 200);
    assert.ok(await bcrypt.compare('newpass123', db.users.u1.password));
  });
  await t.test('student login is gone: 410 with Thai message', async () => {
    db.students.S100 = { id: 9 };
    const r = await call(ctrl.login, null, { username: 'S100', password: 'S100' });
    assert.strictEqual(r.status, 410);
    assert.match(r.body.error, /นักเรียนไม่ต้องเข้าสู่ระบบ/);
  });
});
