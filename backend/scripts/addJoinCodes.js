// Idempotent: give every tenant without a joinCode one (incl. 'snt'). Usage: node scripts/addJoinCodes.js
require('dotenv').config();
const { basePrisma: db } = require('../config/database');
const { newJoinCode } = require('../services/groups');

async function main() {
  const rows = await db.tenant.findMany({ where: { joinCode: null }, select: { id: true, slug: true } });
  for (const t of rows) {
    for (let i = 0; ; i++) {
      try {
        const u = await db.tenant.update({ where: { id: t.id }, data: { joinCode: newJoinCode() } });
        console.log(`${t.slug}: ${u.joinCode}`);
        break;
      } catch (e) { if (e.code !== 'P2002' || i >= 4) throw e; }
    }
  }
  console.log(`done: ${rows.length} tenant(s) updated`);
}
main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
