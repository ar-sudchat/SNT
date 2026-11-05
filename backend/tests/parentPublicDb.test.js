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

  const subject2 = await asBypass(base.subject.create({ data: { tenantId: A.id, subjectCode: 'ค13101', subjectName: 'คณิตศาสตร์ 3', gradeId: grade.id, academicYearId: year.id, teacherId: teacher.id } }));
  await asBypass(base.task.create({ data: { tenantId: A.id, subjectId: subject2.id, taskName: 'งานเลข', taskNumber: 1, createdById: teacher.id } }));
  const payload = `KS1.${A.slug}.${'a'.repeat(32)}`;
  await asBypass(base.qRCode.create({ data: { tenantId: A.id, studentId: st.id, subjectId: subject2.id, qrcodeData: payload } }));

  const app = express();
  app.use(tenantScope);
  app.use('/api/public/parent', publicRouter);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => {
    server.close();
    for (const m of ['qRCode', 'submission', 'task', 'subject', 'student', 'class', 'grade', 'teacher', 'academicYear', 'auditLog'])
      await asBypass(base[m].deleteMany({ where: { tenantId: A.id } }));
    await base.tenant.deleteMany({ where: { id: A.id } });
    await base.$disconnect();
  });
  const port = server.address().port;

  const r = await get(port, '/api/public/parent/' + ctrl.signToken(st.id, undefined, A.id).token);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.student.firstName, 'มะลิ');
  assert.strictEqual(r.body.summary.total, 2);
  assert.strictEqual(r.body.subjects[0].tasks[0].statusText, 'ยังไม่ส่ง');

  // สแกน QR (ลิงก์ที่พิมพ์ในรูป QR): วิชาที่สแกนขึ้นก่อน และเห็นวิชาอื่นด้วย
  const q = await get(port, '/api/public/parent/qr/' + encodeURIComponent(payload));
  assert.strictEqual(q.status, 200, JSON.stringify(q.body));
  assert.strictEqual(q.body.focusSubject, 'คณิตศาสตร์ 3');
  assert.deepStrictEqual(q.body.subjects.map(x => x.subjectName), ['คณิตศาสตร์ 3', 'ภาษาไทย 3']);
  assert.strictEqual(q.body.subjects[0].focus, true);
  assert.strictEqual(q.body.expiresAt, null);
  const bad = await get(port, '/api/public/parent/qr/' + encodeURIComponent(`KS1.${A.slug}.${'b'.repeat(32)}`));
  assert.strictEqual(bad.status, 401);
  const other = await get(port, '/api/public/parent/qr/' + encodeURIComponent('SNT-1-2-3'));
  assert.strictEqual(other.status, 401);
});
