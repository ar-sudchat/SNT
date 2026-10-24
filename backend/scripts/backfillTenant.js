// Backfill the first tenant ("snt") for a single-school database.
// Idempotent: safe to run many times. Uses raw SQL so it works against both the
// "expand" schema (tenantId nullable) and the final schema (tenantId required).
//   node scripts/backfillTenant.js            (uses DATABASE_URL)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const SLUG = process.env.FIRST_TENANT_SLUG || 'snt';
const NAME = process.env.SCHOOL_NAME || process.env.FIRST_TENANT_NAME || 'โรงเรียนแรก';
const TABLES = ['AcademicYear', 'Grade', 'Class', 'Student', 'Teacher', 'Subject', 'Task',
  'QRCode', 'Submission', 'AiConversation', 'AiMessage'];
const ROLE_MAP = { ADMIN: 'OWNER', TEACHER: 'TEACHER', STUDENT: 'STUDENT' };

async function backfill(prisma = new PrismaClient(), log = console.log) {
  let tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) {
    tenant = await prisma.tenant.create({ data: { slug: SLUG, name: NAME, plan: 'school' } });
    log(`created tenant ${SLUG} (${tenant.id})`);
  } else log(`tenant ${SLUG} exists (${tenant.id})`);
  // The first (real) school must not be capped by free-plan limits.
  if (tenant.plan !== 'school') {
    tenant = await prisma.tenant.update({ where: { id: tenant.id }, data: { plan: 'school' } });
    log(`tenant ${SLUG} plan -> school`);
  }

  for (const t of TABLES) {
    const n = await prisma.$executeRawUnsafe(`UPDATE "${t}" SET "tenantId" = $1 WHERE "tenantId" IS NULL`, tenant.id);
    log(`${t}: ${n} row(s) set`);
  }

  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  for (const u of users) {
    const r = await prisma.membership.upsert({
      where: { userId_tenantId: { userId: u.id, tenantId: tenant.id } },
      update: {},
      create: { userId: u.id, tenantId: tenant.id, role: ROLE_MAP[u.role] || 'STUDENT' },
    });
    
  }
  log(`memberships ensured for ${users.length} user(s)`);
  return tenant;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  backfill(prisma).then(() => prisma.$disconnect()).catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
}
module.exports = { backfill, SLUG };
