const test = require('node:test');
const assert = require('node:assert');
const { isPlatformAdminEmail, requirePlatformAdmin, setTenantStatus } = require('../controllers/opsController');

const run = (user) => {
  let code = null, nexted = false;
  const res = { status(c) { code = c; return this; }, json() { return this; } };
  requirePlatformAdmin({ user }, res, () => { nexted = true; });
  return { code, nexted };
};

test('email match is case-insensitive, trimmed, comma list', () => {
  const env = { PLATFORM_ADMIN_EMAILS: ' Root@Kru.app , b@x.io ' };
  assert.ok(isPlatformAdminEmail('root@kru.app', env));
  assert.ok(isPlatformAdminEmail(' B@X.IO ', env));
  assert.ok(!isPlatformAdminEmail('c@x.io', env));
});

test('fails closed: empty/missing env or email', () => {
  assert.ok(!isPlatformAdminEmail('a@b.c', {}));
  assert.ok(!isPlatformAdminEmail('a@b.c', { PLATFORM_ADMIN_EMAILS: ' , ' }));
  assert.ok(!isPlatformAdminEmail('', { PLATFORM_ADMIN_EMAILS: ',' }));
  assert.ok(!isPlatformAdminEmail(null, { PLATFORM_ADMIN_EMAILS: 'a@b.c' }));
  assert.ok(!isPlatformAdminEmail(['a@b.c'], { PLATFORM_ADMIN_EMAILS: 'a@b.c' }));
});

test('middleware: 401 anonymous, 403 non-admin (even role ADMIN), next for platform admin', () => {
  const prev = process.env.PLATFORM_ADMIN_EMAILS;
  process.env.PLATFORM_ADMIN_EMAILS = 'root@kru.app';
  try {
    assert.strictEqual(run(undefined).code, 401);
    assert.deepStrictEqual(run({ email: 'admin@system.local', role: 'ADMIN' }), { code: 403, nexted: false });
    // Same email registered by password (unverified) is not enough: must be Google-verified.
    assert.deepStrictEqual(run({ email: 'root@kru.app', googleSub: null }), { code: 403, nexted: false });
    assert.deepStrictEqual(run({ email: 'ROOT@kru.app', googleSub: 'g-1' }), { code: null, nexted: true });
  } finally {
    if (prev === undefined) delete process.env.PLATFORM_ADMIN_EMAILS; else process.env.PLATFORM_ADMIN_EMAILS = prev;
  }
});

test('setTenantStatus rejects invalid status before touching the DB', async () => {
  let code = null;
  const res = { status(c) { code = c; return this; }, json() { return this; } };
  await setTenantStatus({ body: { status: 'PENDING_DELETE' }, params: { id: 'x' }, user: { id: 1 } }, res);
  assert.strictEqual(code, 400);
});
