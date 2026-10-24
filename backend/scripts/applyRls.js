// Apply prisma/rls.sql (idempotent). Usage: node scripts/applyRls.js  (uses DIRECT_URL || DATABASE_URL)
// Rollback: node scripts/applyRls.js --disable
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const { TENANT_MODELS } = require('../config/database');

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    if (process.argv.includes('--disable')) {
      for (const t of TENANT_MODELS) {
        await db.$executeRawUnsafe(`ALTER TABLE "${t}" NO FORCE ROW LEVEL SECURITY`);
        await db.$executeRawUnsafe(`ALTER TABLE "${t}" DISABLE ROW LEVEL SECURITY`);
      }
      console.log('RLS disabled on', TENANT_MODELS.size, 'tables');
      return;
    }
    await db.$executeRawUnsafe(fs.readFileSync(path.join(__dirname, '../prisma/rls.sql'), 'utf8'));
    const rows = await db.$queryRawUnsafe(
      `SELECT relname FROM pg_class WHERE relname = ANY($1) AND relrowsecurity AND relforcerowsecurity`, [...TENANT_MODELS]);
    const missing = [...TENANT_MODELS].filter(t => !rows.some(r => r.relname === t));
    if (missing.length) throw new Error(`RLS not active on: ${missing.join(', ')}`);
    console.log(`RLS active (ENABLE+FORCE) on ${rows.length} tables`);
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e.message); process.exit(1); });
