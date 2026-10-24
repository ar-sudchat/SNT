const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
process.env.JWT_SECRET = 'test';
process.env.GOOGLE_CLIENT_ID = 'cid.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'sec';

const tenants = [{ id: 'tA', slug: 'snt', name: 'A' }, { id: 'tB', slug: 'bkk', name: 'B' }];
const teachers = [
  { id: 1, teacherCode: 'T01', tenantId: 'tA', name: 'ครูเอ', user: null },
  { id: 2, teacherCode: 'T01', tenantId: 'tB', name: 'ครูบี', user: null },
  { id: 3, teacherCode: 'T02', tenantId: 'tA', name: 'ครูซี', user: null },
  { id: 4, teacherCode: 'T09', tenantId: 'tB', name: 'ครูดี', user: null },
];
const memberships = [{ id: 1, userId: 10, tenantId: 'tA', role: 'TEACHER' }];
const users = [];
const match = (row, where) => Object.entries(where).every(([k, v]) => row[k] === v);
stub('config/database', {
  tenant: {
    findUnique: async ({ where }) => tenants.find(t => (where.id ? t.id === where.id : t.slug === where.slug)) || null,
    findFirst: async () => tenants[0],
  },
  teacher: {
    findFirst: async ({ where }) => teachers.find(t => match(t, where)) || null,
    findMany: async ({ where, take }) => teachers.filter(t => match(t, where)).slice(0, take),
  },
  student: { findFirst: async () => null },
  user: {
    findFirst: async ({ where }) => { const u = users.find(x => x.teacherId === where.teacherId); return u && { ...u, teacher: teachers.find(t => t.id === u.teacherId) }; },
    findUnique: async ({ where }) => users.find(u => match(u, where)) || null,
    create: async ({ data }) => { const u = { id: 100 + users.length, ...data }; users.push(u); return u; },
    update: async ({ where, data }) => Object.assign(users.find(u => u.id === where.id), data),
  },
  membership: {
    findFirst: async ({ where }) => memberships.find(m => m.userId === where.userId) || null,
    findUnique: async ({ where }) => { const k = where.userId_tenantId; return memberships.find(m => m.userId === k.userId && m.tenantId === k.tenantId) || null; },
    findMany: async ({ where }) => memberships.filter(m => m.userId === where.userId).map(m => ({ ...m, tenant: tenants.find(t => t.id === m.tenantId) })),
    create: async ({ data }) => { const m = { id: memberships.length + 1, ...data }; memberships.push(m); return m; },
  },
});
const ctrl = require('../controllers/authController');
const google = require('../services/googleAuth');

const call = (fn, req) => new Promise((resolve) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  fn({ headers: {}, ...req }, res);
});

test('google id_token verification (mocked fetch)', async () => {
  const now = Date.now();
  const good = { aud: process.env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: String(Math.floor(now / 1000) + 600), email_verified: 'true', sub: '123', email: 'A@x.com' };
  const f = (claims, ok = true) => async () => ({ ok, json: async () => claims });
  assert.deepStrictEqual(await google.verifyIdToken('t', f(good), now), { sub: '123', email: 'a@x.com', name: null });
  for (const bad of [{ aud: 'other' }, { iss: 'evil.com' }, { exp: String(Math.floor(now / 1000) - 1) }, { email_verified: 'false' }]) {
    await assert.rejects(google.verifyIdToken('t', f({ ...good, ...bad }), now));
  }
  await assert.rejects(google.verifyIdToken('t', f(good, false), now));
});

test('google state: signed, short TTL, bound to nonce cookie', () => {
  const { state, nonce } = google.createState(1000);
  assert.ok(google.verifyState(state, nonce, 2000));
  assert.ok(!google.verifyState(state, 'other', 2000));
  assert.ok(!google.verifyState(state, nonce, 1000 + google.STATE_TTL_MS + 1));
  assert.ok(!google.verifyState(state.slice(0, -2) + 'xx', nonce, 2000));
});

test('google link: by sub only; never auto-links an unverified password account (pre-takeover)', async () => {
  // Attacker pre-registers the victim's email with a password, victim later signs in with Google.
  users.push({ id: 50, email: 'old@x.com', password: 'h', role: 'TEACHER' });
  assert.strictEqual(await ctrl._linkGoogleUser({ sub: 's1', email: 'old@x.com' }), 'link_required');
  assert.strictEqual(users.find(u => u.id === 50).googleSub, undefined);
  users.push({ id: 51, email: 'g@x.com', password: 'h', role: 'TEACHER', googleSub: 's1' });
  assert.strictEqual((await ctrl._linkGoogleUser({ sub: 's1', email: 'changed@x.com' })).id, 51);
  assert.strictEqual(await ctrl._linkGoogleUser({ sub: 's2', email: 'g@x.com' }), null);
  const fresh = await ctrl._linkGoogleUser({ sub: 's3', email: 'new@x.com' });
  assert.strictEqual(fresh.googleSub, 's3');
});

test('switch-tenant requires membership', async () => {
  const user = { id: 10, role: 'TEACHER', tid: 'tA' };
  let r = await call(ctrl.switchTenant, { user, body: { tenantId: 'tB' } });
  assert.strictEqual(r.status, 403);
  memberships.push({ id: 9, userId: 10, tenantId: 'tB', role: 'ADMIN' });
  r = await call(ctrl.switchTenant, { user, body: { tenantId: 'tB' } });
  assert.strictEqual(r.status, 200);
  const d = jwt.verify(r.body.token, 'test');
  assert.strictEqual(d.tid, 'tB'); assert.strictEqual(d.trole, 'ADMIN'); assert.strictEqual(d.userId, 10);
  r = await call(ctrl.memberships, { user });
  assert.deepStrictEqual(r.body.memberships.map(t => t.slug), ['snt', 'bkk']);
});

test('teacher code login: unique code works, ambiguous code across groups -> 409; bad password 401', async () => {
  let r = await call(ctrl.login, { body: { username: 'T02', password: 'T02', slug: 'bkk' } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.user.name, 'ครูซี');
  assert.strictEqual(jwt.verify(r.body.token, 'test').tid, 'tA');
  r = await call(ctrl.login, { body: { username: 'T02', password: 'bad' } });
  assert.strictEqual(r.status, 401);
  r = await call(ctrl.login, { body: { username: 'T01', password: 'T01' } });
  assert.strictEqual(r.status, 409); assert.match(r.body.error, /อีเมล/);
});

test('teacher code login: default password (= code) only provisions in the legacy school', async () => {
  // Self-service group teacher row without an account: guessable code must not grant membership.
  const before = users.length;
  const r = await call(ctrl.login, { body: { username: 'T09', password: 'T09' } });
  assert.strictEqual(r.status, 401);
  assert.strictEqual(users.length, before);
  assert.ok(!memberships.some(m => m.tenantId === 'tB' && m.userId >= 100));
});

test('google endpoints 503 when not configured', async () => {
  const id = process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_ID;
  try {
    assert.strictEqual((await call(ctrl.googleStart, {})).status, 503);
    assert.deepStrictEqual((await call(ctrl.config, {})).body, { google: false });
  } finally { process.env.GOOGLE_CLIENT_ID = id; }
});
