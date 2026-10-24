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
    findFirst: async ({ where }) => Object.values(db.users).find(u => u.studentId === where.studentId) || null,
    create: async ({ data }) => { const u = { id: 'new', ...data }; db.users[u.id] = u; return u; },
  },
  teacher: { findUnique: async () => null },
  student: { findUnique: async ({ where }) => db.students[where.studentCode] || null },
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

  await t.test('admin is refused with server-hash message', async () => {
    const r = await call(ctrl.changePassword, { id: 'a', role: 'ADMIN' }, { currentPassword: 'x', newPassword: 'abcdefgh1' });
    assert.strictEqual(r.status, 400); assert.match(r.body.error, /ADMIN_PASSWORD_HASH/);
  });
  await t.test('wrong current password -> 400 not 401', async () => {
    const u = teacherUser();
    const r = await call(ctrl.changePassword, u, { currentPassword: 'nope', newPassword: 'abcdefgh1' });
    assert.strictEqual(r.status, 400); assert.match(r.body.error, /ปัจจุบันไม่ถูกต้อง/);
  });
  await t.test('validation: short, equals code, equals current', async () => {
    const u = teacherUser();
    for (const [np, re] of [['short', /8 ตัว/], ['teacher01', /รหัสผู้ใช้/]]) {
      const r = await call(ctrl.changePassword, u, { currentPassword: 'T001', newPassword: np });
      assert.strictEqual(r.status, 400); assert.match(r.body.error, re);
    }
    const r = await call(ctrl.changePassword, u, { currentPassword: 'samepass1', newPassword: 'samepass1' });
    assert.strictEqual(r.status, 400); assert.match(r.body.error, /ปัจจุบัน/);
    assert.strictEqual(db.users.u1.password, hash);
  });
  await t.test('success updates hash', async () => {
    const u = teacherUser();
    const r = await call(ctrl.changePassword, u, { currentPassword: 'T001', newPassword: 'newpass123' });
    assert.strictEqual(r.status, 200);
    assert.ok(await bcrypt.compare('newpass123', db.users.u1.password));
  });
  await t.test('student login uses stored hash once a User row exists', async () => {
    const su = { id: 's1', role: 'STUDENT', studentId: 9, password: await bcrypt.hash('changed99', 4), student: {} };
    db.users.s1 = su;
    db.students.S100 = { id: 9, studentCode: 'S100', name: 'ส', user: su };
    assert.strictEqual((await call(ctrl.login, null, { username: 'S100', password: 'S100' })).status, 401);
    assert.strictEqual((await call(ctrl.login, null, { username: 'S100', password: 'changed99' })).status, 200);
  });
});
