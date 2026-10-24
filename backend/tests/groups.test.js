const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const g = require('../services/groups');

process.env.JWT_SECRET = 'test';
const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
// Tiny in-memory prisma (shared by basePrisma and the scoped client).
const D = { users: [], tenants: [], memberships: [], years: [] };
let seq = 1;
const pk = (where) => where.userId_tenantId || where;
const findM = (w) => D.memberships.find(m => Object.entries(pk(w)).every(([k, v]) => m[k] === v)) || null;
const db = {
  user: {
    findUnique: async ({ where }) => D.users.find(u => (where.id ? u.id === where.id : u.email === where.email)) || null,
    create: async ({ data }) => { const u = { id: seq++, ...data }; D.users.push(u); return u; },
  },
  tenant: {
    create: async ({ data }) => {
      if (D.tenants.some(t => t.joinCode === data.joinCode)) throw Object.assign(new Error('dup'), { code: 'P2002' });
      const t = { id: `t${seq++}`, status: 'ACTIVE', ...data }; D.tenants.push(t); return t;
    },
    findUnique: async ({ where }) => D.tenants.find(t => (where.id ? t.id === where.id : t.joinCode === where.joinCode)) || null,
    update: async ({ where, data }) => Object.assign(D.tenants.find(t => t.id === where.id), data),
  },
  membership: {
    findUnique: async ({ where }) => findM(where),
    findFirst: async ({ where }) => D.memberships.find(m => m.userId === where.userId) || null,
    findMany: async ({ where }) => D.memberships.filter(m => m.tenantId === where.tenantId).map(m => ({ ...m, user: D.users.find(u => u.id === m.userId) })),
    create: async ({ data }) => { if (findM({ userId: data.userId, tenantId: data.tenantId })) throw Object.assign(new Error('dup'), { code: 'P2002' }); const m = { id: seq++, createdAt: new Date(), ...data }; D.memberships.push(m); return m; },
    count: async ({ where }) => D.memberships.filter(m => Object.entries(where).every(([k, v]) => m[k] === v)).length,
    delete: async ({ where }) => { D.memberships = D.memberships.filter(m => m.id !== where.id); },
  },
  academicYear: { create: async ({ data }) => { D.years.push(data); return data; } },
  async $transaction(fn) { return fn(db); },
};
stub('config/database', Object.assign(Object.create(db), db, { basePrisma: db }));
const auth = require('../controllers/authController');
const c = require('../controllers/onboardingController');

const call = (fn, req) => new Promise((resolve) => {
  const res = { statusCode: 200, set() {}, status(s) { this.statusCode = s; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  fn({ headers: {}, params: {}, body: {}, ...req }, res);
});
const bearer = (token) => ({ authorization: `Bearer ${token}` });

test('join code: format, unambiguous alphabet, normalize', () => {
  for (let i = 0; i < 200; i++) assert.match(g.newJoinCode(), g.JOIN_CODE_RE);
  assert.ok(!/[01OIL]/.test(g.JOIN_ALPHABET));
  assert.strictEqual(g.normalizeJoinCode(' k7q 29x '), 'K7Q-29X');
  assert.strictEqual(g.normalizeJoinCode('k7q-29x'), 'K7Q-29X');
  for (const bad of ['K7Q-29', 'O0O-111', '', null, 'ABCDEFG']) assert.strictEqual(g.normalizeJoinCode(bad), null, String(bad));
});

test('group flow: signup -> personal group, create, join, members, rotate, leave', async () => {
  let r = await call(auth.signup, { body: { email: 'a@x.com', password: 'password1', name: 'ครูเอ' } });
  assert.strictEqual(r.status, 201);
  const tokA = r.body.token, a = jwt.verify(tokA, 'test');
  assert.ok(a.tid); assert.strictEqual(a.trole, 'OWNER'); assert.strictEqual(r.body.user.tid, a.tid);
  const personal = D.tenants.find(t => t.id === a.tid);
  assert.strictEqual(personal.name, 'กลุ่มของ ครูเอ'); assert.match(personal.joinCode, g.JOIN_CODE_RE);
  assert.ok(D.years.some(y => y.tenantId === a.tid && y.isCurrent));

  // existing user with no membership gets a personal group on login (no tid=null)
  r = await call(auth.signup, { body: { email: 'b@x.com', password: 'password1' } });
  const tokB = r.body.token, b = jwt.verify(tokB, 'test');
  assert.ok(b.tid);

  r = await call(c.createGroup, { headers: bearer(tokA), body: { name: 'ม.3 วิทย์' } });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.body.group.role, 'OWNER');
  const gid = r.body.group.id, code = r.body.group.joinCode;
  assert.strictEqual(jwt.verify(r.body.token, 'test').tid, gid);
  assert.strictEqual((await call(c.createGroup, { headers: bearer(tokA), body: { name: ' ' } })).status, 400);
  assert.strictEqual((await call(c.createGroup, { body: { name: 'x' } })).status, 401);

  assert.strictEqual((await call(c.joinGroup, { headers: bearer(tokB), body: { code: 'ZZZ-ZZZ' } })).status, 404);
  assert.strictEqual((await call(c.joinGroup, { headers: bearer(tokB), body: { code: 'bad' } })).status, 400);
  r = await call(c.joinGroup, { headers: bearer(tokB), body: { code: code.toLowerCase().replace('-', '') } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.group.role, 'TEACHER');
  assert.strictEqual(jwt.verify(r.body.token, 'test').trole, 'TEACHER');
  assert.strictEqual((await call(c.joinGroup, { headers: bearer(tokB), body: { code } })).status, 409);

  r = await call(c.listMembers, { headers: bearer(tokB), params: { id: gid } });
  assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.body.members.map(m => m.role), ['OWNER', 'TEACHER']);
  assert.strictEqual((await call(c.listMembers, { headers: bearer(tokB), params: { id: a.tid } })).status, 404);

  r = await call(c.getGroup, { headers: bearer(tokB), params: { id: gid } });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body, { id: gid, name: 'ม.3 วิทย์', joinCode: code, kind: 'group', role: 'TEACHER' });
  assert.strictEqual((await call(c.getGroup, { headers: bearer(tokB), params: { id: a.tid } })).status, 404);
  assert.strictEqual((await call(c.getGroup, { params: { id: gid } })).status, 401);

  assert.strictEqual((await call(c.rotateJoinCode, { headers: bearer(tokB), params: { id: gid } })).status, 403);
  r = await call(c.rotateJoinCode, { headers: bearer(tokA), params: { id: gid } });
  assert.strictEqual(r.status, 200); assert.notStrictEqual(r.body.joinCode, code);
  assert.strictEqual((await call(c.joinGroup, { headers: bearer(tokB), body: { code } })).status, 404);

  assert.strictEqual((await call(c.renameGroup, { headers: bearer(tokB), params: { id: gid }, body: { name: 'x' } })).status, 403);
  r = await call(c.renameGroup, { headers: bearer(tokA), params: { id: gid }, body: { name: 'ม.3/1' } });
  assert.deepStrictEqual(r.body, { id: gid, name: 'ม.3/1' });

  // teacher can't remove owner; last owner can't leave; teacher can leave
  assert.strictEqual((await call(c.removeMember, { headers: bearer(tokB), params: { id: gid, userId: String(a.userId) } })).status, 403);
  assert.strictEqual((await call(c.removeMember, { headers: bearer(tokA), params: { id: gid, userId: String(a.userId) } })).status, 409);
  r = await call(c.removeMember, { headers: bearer(tokB), params: { id: gid, userId: String(b.userId) } });
  assert.deepStrictEqual(r.body, { ok: true, left: true });
  assert.strictEqual((await call(c.listMembers, { headers: bearer(tokB), params: { id: gid } })).status, 404);
});

test('owned groups are capped per account (each group has its own AI quota)', async () => {
  const r0 = await call(auth.signup, { body: { email: 'cap@x.com', password: 'password1' } });
  const tok = r0.body.token; // personal group = 1 owned
  for (let i = 0; i < 4; i++) assert.strictEqual((await call(c.createGroup, { headers: bearer(tok), body: { name: `g${i}` } })).status, 201);
  const r = await call(c.createGroup, { headers: bearer(tok), body: { name: 'one too many' } });
  assert.strictEqual(r.status, 429); assert.match(r.body.error, /สูงสุด 5 กลุ่ม/);
});
