const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
// Fixture writes on RLS tables must set app.bypass_rls (works under a non-superuser role too).
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

// authenticate stub: x-user / x-tenant headers (real requireOwner + controllers hit the local DB)
const path = require('node:path');
const p = require.resolve(path.join('..', 'middleware/auth.js'));
require.cache[p] = { id: p, filename: p, loaded: true, exports: {
  authenticate: (req, res, next) => {
    if (!req.headers['x-user']) return res.status(401).json({});
    req.user = { id: +req.headers['x-user'] }; req.tenantId = req.headers['x-tenant'];
    runWithTenant(req.tenantId, next);
  } } };
const router = require('../routes/tenantData');

const call = (port, method, url, headers, body) => new Promise((resolve, reject) => {
  const d = body ? Buffer.from(JSON.stringify(body)) : null;
  const r = http.request({ port, method, path: url, headers: { 'content-type': 'application/json', ...(d ? { 'content-length': d.length } : {}), ...headers } },
    res => { let s = ''; res.on('data', c => s += c); res.on('end', () => resolve({ status: res.statusCode, body: s })); });
  r.on('error', reject); r.end(d);
});

test('tenant data: owner-only, own-tenant export, delete flow', async (t) => {
  const sfx = Date.now();
  const mk = (n) => base.tenant.create({ data: { slug: `pdpa-${n}-${sfx}`, name: `โรงเรียน${n}${sfx}` } });
  const A = await mk('a'), B = await mk('b');
  const u = (n, role) => base.user.create({ data: { email: `${n}${sfx}@t.test`, password: 'x', role } });
  const owner = await u('owner', 'ADMIN'), admin = await u('adm', 'ADMIN');
  await base.membership.createMany({ data: [
    { userId: owner.id, tenantId: A.id, role: 'OWNER' }, { userId: admin.id, tenantId: A.id, role: 'ADMIN' }] });
  await asBypass(base.grade.createMany({ data: [{ tenantId: A.id, gradeName: 'GA' }, { tenantId: B.id, gradeName: 'GB-secret' }] }));

  const app = express(); app.use(express.json()); app.use('/api/tenant', router);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => {
    server.close();
    await asBypass(base.grade.deleteMany({ where: { tenantId: { in: [A.id, B.id] } } }));
    await asBypass(base.auditLog.deleteMany({ where: { tenantId: { in: [A.id, B.id] } } }));
    await base.tenant.deleteMany({ where: { id: { in: [A.id, B.id] } } });
    await base.user.deleteMany({ where: { id: { in: [owner.id, admin.id] } } });
    await base.$disconnect();
  });
  const port = server.address().port;
  const H = (id) => ({ 'x-user': String(id), 'x-tenant': A.id });

  assert.strictEqual((await call(port, 'GET', '/api/tenant/export', {})).status, 401);
  for (const [m, url] of [['GET', '/api/tenant/export'], ['GET', '/api/tenant/audit'], ['POST', '/api/tenant/delete-request'], ['POST', '/api/tenant/delete-cancel']])
    assert.strictEqual((await call(port, m, url, H(admin.id), {})).status, 403, url);
  // owner of A cannot act on B (no membership there)
  assert.strictEqual((await call(port, 'GET', '/api/tenant/export', { 'x-user': String(owner.id), 'x-tenant': B.id })).status, 403);

  const ex = await call(port, 'GET', '/api/tenant/export', H(owner.id));
  assert.strictEqual(ex.status, 200);
  assert.ok(ex.body.includes('"GA"'));
  assert.ok(!ex.body.includes('GB-secret'));
  assert.ok(!ex.body.includes('"password"'));
  assert.ok(ex.body.includes(A.slug) && !ex.body.includes(B.slug));

  assert.strictEqual((await call(port, 'POST', '/api/tenant/delete-request', H(owner.id), { confirm: 'wrong' })).status, 400);
  const dr = await call(port, 'POST', '/api/tenant/delete-request', H(owner.id), { confirm: A.name });
  assert.strictEqual(dr.status, 200);
  const days = (new Date(JSON.parse(dr.body).deleteAfter) - Date.now()) / 86400000;
  assert.ok(days > 29.9 && days <= 30);
  assert.strictEqual((await base.tenant.findUnique({ where: { id: A.id } })).status, 'PENDING_DELETE');
  assert.strictEqual((await call(port, 'POST', '/api/tenant/delete-request', H(owner.id), { confirm: A.name })).status, 409);
  const st = JSON.parse((await call(port, 'GET', '/api/tenant/status', H(owner.id))).body);
  assert.ok(st.pending.deleteAfter);
  assert.strictEqual((await call(port, 'POST', '/api/tenant/delete-cancel', H(owner.id), {})).status, 200);
  assert.strictEqual((await base.tenant.findUnique({ where: { id: A.id } })).status, 'ACTIVE');

  const au = JSON.parse((await call(port, 'GET', '/api/tenant/audit?limit=10', H(owner.id))).body);
  assert.deepStrictEqual(au.items.map(i => i.action), ['tenant.delete_cancel', 'tenant.delete_request', 'tenant.export']);
  assert.ok(au.items.every(i => i.tenantId === A.id));
});
