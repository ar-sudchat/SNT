// Legacy "admin" username login must never land on a self-service school owner (also role ADMIN).
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
process.env.JWT_SECRET = 'test';
delete process.env.ADMIN_PASSWORD_HASH; // legacy default password path
const users = [{ id: 7, email: 'owner@school.th', role: 'ADMIN', password: 'h', memberships: [{ role: 'OWNER', slug: 'newschool' }] }];
const matches = (u, w) => (!w.role || u.role === w.role) && (!w.email || u.email === w.email) &&
  (!w.memberships || u.memberships.some(m => m.role === w.memberships.some.role && m.slug === w.memberships.some.tenant.slug));
stub('config/database', {
  user: {
    findFirst: async ({ where }) => users.find(u => matches(u, where)) || null,
    create: async ({ data }) => { const u = { id: 99, memberships: [], ...data }; users.push(u); return u; },
  },
  membership: { findUnique: async () => null, findFirst: async () => null, create: async ({ data }) => data },
  tenant: { findUnique: async () => ({ id: 'tS' }), findFirst: async () => ({ id: 'tS' }) },
});
const ctrl = require('../controllers/authController');
const call = (body) => new Promise((resolve) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  ctrl.login({ body }, res);
});

test('admin username login does not fall back to another ADMIN account', async () => {
  const r = await call({ username: 'admin', password: '1234' });
  assert.strictEqual(r.status, 200);
  assert.notStrictEqual(jwt.verify(r.body.token, 'test').userId, 7);
  assert.strictEqual(r.body.user.email, 'admin@system.local');
});
