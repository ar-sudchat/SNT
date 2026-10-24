// แปลงวันที่สอนแบบข้อความของบันทึกเก่า ("3, 9, 10 มิ.ย. 69") เป็นวันจริง (teachDates/dateFrom/dateTo)
// เฉพาะบันทึกที่ยังไม่มีวันจริงและมีข้อความวันที่ · รันซ้ำได้ · ไม่ใส่ --apply = ดูอย่างเดียว
//   node scripts/backfillTeachDates.js            (ดูว่าจะแปลงอะไรบ้าง)
//   node scripts/backfillTeachDates.js --apply    (เขียนจริง)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { parseThaiDates, dateFields } = require('../services/thaiDates');

async function backfill(prisma, { apply = false, log = console.log } = {}) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const rows = await tx.assessmentRecord.findMany({
      where: { teachDates: { isEmpty: true }, dateText: { not: '' } },
      select: { id: true, dateText: true, createdAt: true },
    });
    let done = 0, skipped = 0;
    for (const r of rows) {
      const dates = parseThaiDates(r.dateText, r.createdAt.getFullYear());
      if (!dates.length) { skipped++; log(`skip #${r.id} "${r.dateText}" (อ่านวันที่ไม่ได้)`); continue; }
      log(`#${r.id} "${r.dateText}" -> ${dates.join(', ')}`);
      if (apply) await tx.assessmentRecord.update({ where: { id: r.id }, data: dateFields(dates, r.dateText) });
      done++;
    }
    log(`${apply ? 'แปลงแล้ว' : 'จะแปลง'} ${done} บันทึก · อ่านไม่ได้ ${skipped} บันทึก${apply ? '' : ' (ใส่ --apply เพื่อเขียนจริง)'}`);
    return { done, skipped };
  }, { timeout: 120000 });
}

if (require.main === module) {
  const prisma = new PrismaClient();
  backfill(prisma, { apply: process.argv.includes('--apply') })
    .catch((e) => { console.error(e.message); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}

module.exports = { backfill };
