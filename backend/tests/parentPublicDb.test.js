// ลิงก์ผู้ปกครองกับฐานข้อมูลจริง: ไม่มีผู้ใช้ล็อกอิน ต้องหากลุ่มจากนักเรียนแล้วเปิด scope ของกลุ่มเอง
// (parent.test.js จำลองฐานข้อมูล จึงไม่เคยผ่านตัวกันข้อมูลข้ามกลุ่ม — เคยตอบ 500 ทุกลิงก์)
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
process.env.PARENT_LINK_SECRET = process.env.PARENT_LINK_SECRET || 'test-secret';
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { tenantScope } = require('../middleware/tenant');
const ctrl = require('../controllers/parentController');
const { publicRouter } = require('../routes/parent');
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

const get = (port, url) => new Promise((resolve, reject) => {
  http.get({ port, path: url }, res => { let s = ''; res.on('data', c => s += c); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(s) })); }).on('error', reject);
});

test('public parent view on the real database', async (t) => {
  const sfx = Date.now();
  const A = await base.tenant.create({ data: { slug: `parent-${sfx}`, name: `ผู้ปกครอง${sfx}` } });
  const year = await asBypass(base.academicYear.create({ data: { tenantId: A.id, year: '2503', isCurrent: true } }));
  const teacher = await asBypass(base.teacher.create({ data: { tenantId: A.id, teacherCode: 'T1', name: 'ครู' } }));
  const grade = await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: 'ป.3' } }));
  const cls = await asBypass(base.class.create({ data: { tenantId: A.id, className: 'ป.3/1', gradeId: grade.id, academicYearId: year.id } }));
  const st = await asBypass(base.student.create({ data: { tenantId: A.id, studentCode: 'P1', name: 'เด็กหญิงมะลิ ใจดี', classId: cls.id } }));
  const subject = await asBypass(base.subject.create({ data: { tenantId: A.id, subjectCode: 'ท13101', subjectName: 'ภาษาไทย 3', gradeId: grade.id, academicYearId: year.id, teacherId: teacher.id } }));
  await asBypass(base.task.create({ data: { tenantId: A.id, subjectId: subject.id, taskName: 'งาน 1', taskNumber: 1, createdById: teacher.id } }));

  const app = express();
  app.use(tenantScope);
  app.use('/api/public/parent', publicRouter);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => {
    server.close();
    for (const m of ['submission', 'task', 'subject', 'student', 'class', 'grade', 'teacher', 'academicYear', 'auditLog'])
      await asBypass(base[m].deleteMany({ where: { tenantId: A.id } }));
    await base.tenant.deleteMany({ where: { id: A.id } });
    await base.$disconnect();
  });
  const port = server.address().port;

  const r = await get(port, '/api/public/parent/' + ctrl.signToken(st.id, undefined, A.id).token);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.student.firstName, 'มะลิ');
  assert.strictEqual(r.body.summary.total, 1);
  assert.strictEqual(r.body.subjects[0].tasks[0].statusText, 'ยังไม่ส่ง');
});
