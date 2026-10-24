// DB-level isolation: raw SQL in tenant A must not see tenant B rows. Skips without a local DB.
const test = require('node:test');
const assert = require('node:assert');

const url = process.env.DATABASE_URL || '';
const local = /localhost|127\.0\.0\.1|host=\/tmp/.test(url);

test('RLS isolates tenants at the database level', { skip: !local && 'no local DATABASE_URL' }, async (t) => {
  // Superusers / BYPASSRLS roles ignore RLS even with FORCE, so test as a plain role (like prod kruscan_app).
  const { PrismaClient } = require('@prisma/client');
  const admin = new PrismaClient({ datasources: { db: { url } } });
  try { await admin.$queryRaw`SELECT 1`; } catch { return t.skip('local DB unreachable'); }
  const rls = await admin.$queryRaw`SELECT relforcerowsecurity f FROM pg_class WHERE relname = 'Student'`;
  if (!rls[0] || !rls[0].f) { await admin.$disconnect(); return t.skip('rls.sql not applied (node scripts/applyRls.js)'); }
  await admin.$executeRawUnsafe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='kruscan_rls_test') THEN
    CREATE ROLE kruscan_rls_test LOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$`);
  await admin.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kruscan_rls_test');
  await admin.$executeRawUnsafe('GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO kruscan_rls_test');
  await admin.$disconnect();
  const u = new URL(url.replace(/^postgresql:/, 'http:')); u.username = 'kruscan_rls_test';
  const prevUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = u.toString().replace(/^http:/, 'postgresql:');
  process.env.RLS_ENABLED = '1';
  delete require.cache[require.resolve('../config/database')];
  const prisma = require('../config/database');
  const { basePrisma: db } = prisma;
  const { runWithTenant } = require('../services/tenantContext');

  assert.strictEqual((await db.$queryRaw`SELECT current_user u`)[0].u, 'kruscan_rls_test');
  const sfx = Date.now().toString(36);
  const bypass = db.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
  const [, A, B] = await db.$transaction([bypass,
    db.tenant.create({ data: { name: `rlsA-${sfx}`, slug: `rls-a-${sfx}` } }),
    db.tenant.create({ data: { name: `rlsB-${sfx}`, slug: `rls-b-${sfx}` } })]);
  const mk = (tid) => db.$transaction([db.$executeRaw`SELECT set_config('app.tenant_id', ${tid}, true)`,
    db.$executeRaw`INSERT INTO "AuditLog" ("tenantId", action) VALUES (${tid}, 'rls-test')`]);
  try {
    await mk(A.id); await mk(B.id);
    const rawAs = (tid) => db.$transaction([db.$executeRaw`SELECT set_config('app.tenant_id', ${tid}, true)`,
      db.$queryRaw`SELECT "tenantId" FROM "AuditLog" WHERE action = 'rls-test'`]).then(r => r[1]);
    const seenA = await rawAs(A.id);
    assert.ok(seenA.length >= 1);
    assert.ok(seenA.every(r => r.tenantId === A.id), 'tenant A saw another tenant row');
    // No GUC at all = zero rows (fail closed)
    assert.strictEqual((await db.$queryRaw`SELECT 1 FROM "AuditLog" WHERE action = 'rls-test'`).length, 0);
    // Cross-tenant insert rejected by WITH CHECK
    await assert.rejects(db.$transaction([db.$executeRaw`SELECT set_config('app.tenant_id', ${A.id}, true)`,
      db.$executeRaw`INSERT INTO "AuditLog" ("tenantId", action) VALUES (${B.id}, 'rls-test')`]));
    // GUC is transaction-local: does not leak to the next statement on the pool
    assert.strictEqual((await db.$queryRaw`SELECT current_setting('app.tenant_id', true) v`)[0].v || '', '');
    // App client (extension) sees only its tenant
    const n = await runWithTenant(A.id, async () => await prisma.auditLog.count({ where: { action: 'rls-test' } }));
    assert.strictEqual(n, seenA.length);
  } finally {
    await db.$transaction([db.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`,
      db.auditLog.deleteMany({ where: { tenantId: { in: [A.id, B.id] } } }),
      db.tenant.deleteMany({ where: { id: { in: [A.id, B.id] } } })]);
    await db.$disconnect();
    process.env.DATABASE_URL = prevUrl;
  }
});
