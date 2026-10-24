const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
// Fixture writes on RLS tables must set app.bypass_rls (works under a non-superuser role too).
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

// authenticate stub: x-tenant / x-teacher headers; role ADMIN without x-teacher = global admin with no Teacher row.
const p = require.resolve(path.join('..', 'middleware/auth.js'));
require.cache[p] = { id: p, filename: p, loaded: true, exports: {
  authenticate: (req, res, next) => {
    if (!req.headers['x-tenant']) return res.status(401).json({});
    req.user = { id: 1, role: 'ADMIN', teacherId: req.headers['x-teacher'] ? +req.headers['x-teacher'] : null };
    req.tenantId = req.headers['x-tenant'];
    runWithTenant(req.tenantId, next);
  },
  authorize: () => (req, res, next) => next(),
  isTeacher: (req, res, next) => next() } };
const subjectsRouter = require('../routes/subjects');
const studentsRouter = require('../routes/students');

const call = (port, method, url, headers, body) => new Promise((resolve, reject) => {
  const d = body ? Buffer.from(JSON.stringify(body)) : null;
  const r = http.request({ port, method, path: url, headers: { 'content-type': 'application/json', ...(d ? { 'content-length': d.length } : {}), ...headers } },
    res => { let s = ''; res.on('data', c => s += c); res.on('end', () => resolve({ status: res.statusCode, body: s ? JSON.parse(s) : null })); });
  r.on('error', reject); r.end(d);
});

test('bulk subjects & students', async (t) => {
  const sfx = Date.now();
  const mk = (n) => base.tenant.create({ data: { slug: `bulk-${n}-${sfx}`, name: `โรงเรียน${n}${sfx}` } });
  const A = await mk('a'), B = await mk('b');
  const ids = [A.id, B.id];
  const user = await base.user.create({ data: { email: `bulk${sfx}@t.test`, password: 'x', role: 'STUDENT' } });

  const yearOld = await asBypass(base.academicYear.create({ data: { tenantId: A.id, year: '2500', isCurrent: false } }));
  const yearCur = await asBypass(base.academicYear.create({ data: { tenantId: A.id, year: '2501', isCurrent: true } }));
  const teacherA = await asBypass(base.teacher.create({ data: { tenantId: A.id, teacherCode: 'T1', name: 'ครูเอ' } }));
  const teacherA2 = await asBypass(base.teacher.create({ data: { tenantId: A.id, teacherCode: 'T2', name: 'ครูสอง' } }));
  const teacherB = await asBypass(base.teacher.create({ data: { tenantId: B.id, teacherCode: 'TB', name: 'ครูบี' } }));
  const gradeA = await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: 'ป.1' } }));
  const gradeB = await asBypass(base.grade.create({ data: { tenantId: B.id, gradeName: 'ป.1' } }));
  const classA = await asBypass(base.class.create({ data: { tenantId: A.id, className: 'ป.1/1', gradeId: gradeA.id } }));
  const classB = await asBypass(base.class.create({ data: { tenantId: B.id, className: 'ป.1/1', gradeId: gradeB.id } }));
  const stuA1 = await asBypass(base.student.create({ data: { tenantId: A.id, studentCode: 'S1', name: 'เด็กหนึ่ง', classId: classA.id } }));
  const stuA2 = await asBypass(base.student.create({ data: { tenantId: A.id, studentCode: 'S2', name: 'เด็กสอง', classId: classA.id } }));
  const stuB = await asBypass(base.student.create({ data: { tenantId: B.id, studentCode: 'S1', name: 'เด็กบี', classId: classB.id } }));
  await base.user.update({ where: { id: user.id }, data: { studentId: stuA1.id } });

  const app = express(); app.use(express.json());
  app.use('/api/subjects', subjectsRouter); app.use('/api/students', studentsRouter);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => {
    server.close();
    for (const m of ['assessmentScore', 'assessmentRecord', 'assessmentTemplate', 'submission', 'qRCode', 'task', 'subject', 'student', 'class', 'grade', 'teacher', 'academicYear', 'auditLog'])
      await asBypass(base[m].deleteMany({ where: { tenantId: { in: ids } } }));
    await base.user.deleteMany({ where: { id: user.id } });
    await base.tenant.deleteMany({ where: { id: { in: ids } } });
    await base.$disconnect();
  });
  const port = server.address().port;
  const H = { 'x-tenant': A.id, 'x-teacher': String(teacherA.id) };
  const HAdmin = { 'x-tenant': A.id };

  await t.test('subjects bulk create: defaults teacher and current year', async () => {
    const r = await call(port, 'POST', '/api/subjects/bulk', H, { items: [
      { subjectCode: 'M1', subjectName: 'คณิต' },
      { subjectCode: ' M2 ', subjectName: 'ไทย', gradeId: gradeA.id, teacherId: teacherA2.id, academicYearId: yearOld.id }] });
    assert.strictEqual(r.status, 201);
    assert.deepStrictEqual(r.body.skipped, []);
    const [m1, m2] = r.body.created;
    assert.strictEqual(m1.teacherId, teacherA.id);
    assert.strictEqual(m1.academicYearId, yearCur.id);
    assert.strictEqual(m1.gradeId, null);
    assert.strictEqual(m2.subjectCode, 'M2');
    assert.strictEqual(m2.teacherId, teacherA2.id);
    assert.strictEqual(m2.gradeId, gradeA.id);
    assert.strictEqual(m2.academicYearId, yearOld.id);
    assert.ok(m1.tenantId === A.id);
  });

  await t.test('subjects bulk create: duplicates, existing, missing, cross-group ids', async () => {
    const r = await call(port, 'POST', '/api/subjects/bulk', H, { items: [
      { subjectCode: 'M1', subjectName: 'ซ้ำของเดิม' },
      { subjectCode: 'N1', subjectName: 'วิทย์' },
      { subjectCode: 'N1', subjectName: 'วิทย์ซ้ำ' },
      { subjectCode: 'N2', subjectName: '' },
      { subjectCode: '', subjectName: 'ไม่มีรหัส' },
      { subjectCode: 'N3', subjectName: 'x', gradeId: gradeB.id },
      { subjectCode: 'N4', subjectName: 'x', teacherId: teacherB.id },
      { subjectCode: 'N5', subjectName: 'x', gradeId: 999999999 },
      { subjectCode: 'N6', subjectName: 'x', academicYearId: 999999999 }] });
    assert.strictEqual(r.status, 201);
    assert.deepStrictEqual(r.body.created.map(s => s.subjectCode), ['N1']);
    const reason = (c) => r.body.skipped.filter(s => s.subjectCode === c).map(s => s.reason);
    assert.deepStrictEqual(reason('M1'), ['มีอยู่แล้ว']);
    assert.deepStrictEqual(reason('N1'), ['ซ้ำในรายการ']);
    assert.strictEqual(reason('N2').length, 1);
    assert.strictEqual(reason('').length, 1);
    assert.match(reason('N3')[0], /^ไม่พบ/);
    assert.match(reason('N4')[0], /^ไม่พบ/);
    assert.match(reason('N5')[0], /^ไม่พบ/);
    assert.match(reason('N6')[0], /^ไม่พบ/);
    // same code in another group is independent
    const other = await call(port, 'POST', '/api/subjects/bulk', { 'x-tenant': B.id, 'x-teacher': String(teacherB.id) }, { items: [{ subjectCode: 'M1', subjectName: 'คณิตบี' }] });
    assert.strictEqual(other.body.created.length, 1);
  });

  await t.test('subjects bulk create: admin without a teacher is skipped unless teacherId given; limits', async () => {
    const r = await call(port, 'POST', '/api/subjects/bulk', HAdmin, { items: [
      { subjectCode: 'AD1', subjectName: 'ไม่มีครู' },
      { subjectCode: 'AD2', subjectName: 'มีครู', teacherId: teacherA.id }] });
    assert.deepStrictEqual(r.body.skipped, [{ subjectCode: 'AD1', reason: 'เลือกครูผู้สอน' }]);
    assert.deepStrictEqual(r.body.created.map(s => s.subjectCode), ['AD2']);
    assert.strictEqual((await call(port, 'POST', '/api/subjects/bulk', H, { items: [] })).status, 400);
    assert.strictEqual((await call(port, 'POST', '/api/subjects/bulk', H, {})).status, 400);
    const many = Array.from({ length: 201 }, (_, i) => ({ subjectCode: `L${i}`, subjectName: 'x' }));
    assert.strictEqual((await call(port, 'POST', '/api/subjects/bulk', H, { items: many })).status, 400);
  });

  await t.test('subjects bulk delete: blocked by task / QR, cross-group fails', async () => {
    const mkS = (code, tenantId, teacherId) => asBypass(base.subject.create({ data: { tenantId, subjectCode: code, subjectName: code, teacherId } }));
    const free = await mkS('D-free', A.id, teacherA.id);
    const withTask = await mkS('D-task', A.id, teacherA.id);
    const withQr = await mkS('D-qr', A.id, teacherA.id);
    const foreign = await mkS('D-foreign', B.id, teacherB.id);
    await asBypass(base.task.create({ data: { tenantId: A.id, subjectId: withTask.id, taskName: 't', taskNumber: 1, createdById: teacherA.id } }));
    await asBypass(base.qRCode.create({ data: { tenantId: A.id, studentId: stuA2.id, subjectId: withQr.id, qrcodeData: `qr-${sfx}-1` } }));

    const r = await call(port, 'POST', '/api/subjects/bulk-delete', H, { ids: [free.id, withTask.id, withQr.id, foreign.id, free.id] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.deleted, 1);
    const f = Object.fromEntries(r.body.failed.map(x => [x.id, x]));
    assert.strictEqual(f[withTask.id].reason, 'มีงานหรือ QR ของวิชานี้อยู่');
    assert.strictEqual(f[withTask.id].name, 'D-task');
    assert.strictEqual(f[withQr.id].reason, 'มีงานหรือ QR ของวิชานี้อยู่');
    assert.strictEqual(f[foreign.id].reason, 'ไม่พบ');
    assert.strictEqual(await base.subject.count({ where: { id: free.id } }), 0);
    assert.strictEqual(await base.subject.count({ where: { id: { in: [withTask.id, withQr.id, foreign.id] } } }), 3);
    assert.strictEqual((await call(port, 'POST', '/api/subjects/bulk-delete', H, { ids: [] })).status, 400);
    assert.strictEqual((await call(port, 'POST', '/api/subjects/bulk-delete', H, { ids: Array.from({ length: 501 }, (_, i) => i + 1) })).status, 400);
  });

  await t.test('students bulk delete: removes QR, submissions, scores; unlinks user; cross-group fails', async () => {
    const subj = await asBypass(base.subject.create({ data: { tenantId: A.id, subjectCode: 'SD', subjectName: 'SD', teacherId: teacherA.id } }));
    const task = await asBypass(base.task.create({ data: { tenantId: A.id, subjectId: subj.id, taskName: 't', taskNumber: 1, createdById: teacherA.id } }));
    await asBypass(base.qRCode.create({ data: { tenantId: A.id, studentId: stuA1.id, subjectId: subj.id, qrcodeData: `qr-${sfx}-s1` } }));
    await asBypass(base.submission.create({ data: { tenantId: A.id, studentId: stuA1.id, taskId: task.id, status: 'PENDING' } }));
    const tpl = await asBypass(base.assessmentTemplate.create({ data: { tenantId: A.id, key: 'k1', name: 'tpl', kind: 'RUBRIC' } }));
    const rec = await asBypass(base.assessmentRecord.create({ data: { tenantId: A.id, templateId: tpl.id, classId: classA.id, name: 'r', kind: 'RUBRIC', templateName: 'tpl' } }));
    await asBypass(base.assessmentScore.create({ data: { tenantId: A.id, recordId: rec.id, studentId: stuA1.id } }));

    const r = await call(port, 'POST', '/api/students/bulk-delete', H, { ids: [stuA1.id, stuB.id, 999999999] });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.deleted, 1);
    assert.deepStrictEqual(r.body.failed.map(x => [x.id, x.reason]).sort(), [[stuB.id, 'ไม่พบ'], [999999999, 'ไม่พบ']].sort());
    assert.strictEqual(await base.student.count({ where: { id: stuA1.id } }), 0);
    assert.strictEqual(await base.qRCode.count({ where: { studentId: stuA1.id } }), 0);
    assert.strictEqual(await base.submission.count({ where: { studentId: stuA1.id } }), 0);
    assert.strictEqual(await base.assessmentScore.count({ where: { studentId: stuA1.id } }), 0);
    assert.strictEqual((await base.user.findUnique({ where: { id: user.id } })).studentId, null);
    // other groups / students untouched
    assert.strictEqual(await base.student.count({ where: { id: { in: [stuA2.id, stuB.id] } } }), 2);
    assert.strictEqual(await base.task.count({ where: { id: task.id } }), 1);
    assert.strictEqual((await call(port, 'POST', '/api/students/bulk-delete', H, { ids: [] })).status, 400);
    const au = await base.auditLog.findMany({ where: { tenantId: A.id, action: 'student.bulk_delete' } });
    assert.strictEqual(au.length, 1);
  });
});
