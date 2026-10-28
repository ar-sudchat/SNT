const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

const p = require.resolve(path.join('..', 'middleware/auth.js'));
require.cache[p] = { id: p, filename: p, loaded: true, exports: {
  authenticate: (req, res, next) => {
    if (!req.headers['x-tenant']) return res.status(401).json({});
    req.user = { id: 1, role: 'TEACHER', teacherId: +req.headers['x-teacher'] };
    req.tenantId = req.headers['x-tenant'];
    runWithTenant(req.tenantId, next);
  },
  authorize: () => (req, res, next) => next(),
  isAdmin: (req, res, next) => next(),
  isTeacher: (req, res, next) => next() } };
const attendanceRouter = require('../routes/attendance');
const reportsRouter = require('../routes/reports');
const submissionsRouter = require('../routes/submissions');

const call = (port, method, url, headers, body) => new Promise((resolve, reject) => {
  const d = body ? Buffer.from(JSON.stringify(body)) : null;
  const r = http.request({ port, method, path: url, headers: { 'content-type': 'application/json', ...(d ? { 'content-length': d.length } : {}), ...headers } },
    res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => {
      const buf = Buffer.concat(chunks); const ct = res.headers['content-type'] || '';
      resolve({ status: res.statusCode, type: ct, raw: buf, body: ct.includes('json') && buf.length ? JSON.parse(buf.toString()) : null }); }); });
  r.on('error', reject); r.end(d);
});

test('attendance: scan by chosen subject or by QR subject, close, summary, export', async (t) => {
  const sfx = Date.now();
  const A = await base.tenant.create({ data: { slug: `att-${sfx}`, name: `เช็คชื่อ${sfx}` } });
  const mk = (m, data) => asBypass(base[m].create({ data: { tenantId: A.id, ...data } }));
  const year = await mk('academicYear', { year: '2502', isCurrent: true });
  const mine = await mk('teacher', { teacherCode: 'T1', name: 'ครูฉัน' });
  const other = await mk('teacher', { teacherCode: 'T2', name: 'ครูอื่น' });
  const g6 = await mk('grade', { gradeName: 'ป.6' });
  const g5 = await mk('grade', { gradeName: 'ป.5' });
  const c1 = await mk('class', { className: 'ป.6/1', gradeId: g6.id, academicYearId: year.id });
  const c5 = await mk('class', { className: 'ป.5/1', gradeId: g5.id, academicYearId: year.id });
  const s1 = await mk('student', { studentCode: 'A1', name: 'หนึ่ง', classId: c1.id, studentNumber: 1 });
  const s2 = await mk('student', { studentCode: 'A2', name: 'สอง', classId: c1.id, studentNumber: 2 });
  const s5 = await mk('student', { studentCode: 'A5', name: 'ห้า', classId: c5.id });
  const math = await mk('subject', { subjectCode: 'M6', subjectName: 'คณิต', gradeId: g6.id, academicYearId: year.id, teacherId: mine.id });
  const thai = await mk('subject', { subjectCode: 'T6', subjectName: 'ไทย', gradeId: g6.id, academicYearId: year.id, teacherId: mine.id });
  const foreign = await mk('subject', { subjectCode: 'X6', subjectName: 'ของครูอื่น', gradeId: g6.id, academicYearId: year.id, teacherId: other.id });
  await mk('qRCode', { studentId: s1.id, subjectId: math.id, qrcodeData: `SNT-${sfx}-1-1` });
  await mk('qRCode', { studentId: s1.id, subjectId: thai.id, qrcodeData: `SNT-${sfx}-1-2` });
  await mk('qRCode', { studentId: s2.id, subjectId: math.id, qrcodeData: `SNT-${sfx}-2-1` });
  const task = await mk('task', { subjectId: math.id, taskName: 'ใบงาน 1', taskNumber: 1, createdById: mine.id });
  await mk('submission', { studentId: s1.id, taskId: task.id, status: 'PENDING', submitDate: new Date() });

  const app = express(); app.use(express.json());
  app.use('/api/attendance', attendanceRouter); app.use('/api/reports', reportsRouter); app.use('/api/submissions', submissionsRouter);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => {
    server.close();
    for (const m of ['dayAttendance', 'attendance', 'submission', 'task', 'qRCode', 'subject', 'student', 'class', 'grade', 'teacher', 'academicYear', 'auditLog'])
      await asBypass(base[m].deleteMany({ where: { tenantId: A.id } }));
    await base.tenant.deleteMany({ where: { id: A.id } });
  });
  const h = { 'x-tenant': A.id, 'x-teacher': String(mine.id) };
  const date = '2026-10-28';

  // วิธีที่ 1: เลือกวิชาไทย แล้วยิง QR เล่มคณิตของ s1 (เล่มไหนก็ได้)
  let r = await call(server.address().port, 'POST', '/api/attendance/scan', h, { qrcodeData: `SNT-${sfx}-1-1`, subjectId: thai.id, date });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.strictEqual(r.body.subject.id, thai.id);
  assert.strictEqual(r.body.alreadyMarked, false);
  assert.deepStrictEqual(r.body.counts, { present: 1, total: 2 });

  // ยิงซ้ำ = บอกว่าเช็คแล้ว ไม่นับซ้ำ
  r = await call(server.address().port, 'POST', '/api/attendance/scan', h, { qrcodeData: `SNT-${sfx}-1-1`, subjectId: thai.id, date });
  assert.strictEqual(r.body.alreadyMarked, true);
  assert.strictEqual(r.body.counts.present, 1);

  // วิธีที่ 2: ไม่เลือกวิชา ใช้วิชาของ QR (คณิต)
  r = await call(server.address().port, 'POST', '/api/attendance/scan', h, { qrcodeData: `SNT-${sfx}-2-1`, date });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.subject.id, math.id);

  // พิมพ์รหัสนักเรียน + ต้องเลือกวิชา
  r = await call(server.address().port, 'POST', '/api/attendance/scan', h, { studentCode: 'A1', date });
  assert.strictEqual(r.status, 400);
  // นักเรียนต่างชั้น / วิชาของครูคนอื่น ถูกปฏิเสธ
  r = await call(server.address().port, 'POST', '/api/attendance/scan', h, { studentCode: 'A5', subjectId: thai.id, date });
  assert.strictEqual(r.status, 400);
  const own = require('../middleware/ownership');
  const denied = await runWithTenant(A.id, () => own.assertTeacherOwnsSubject({ user: { role: 'TEACHER', teacherId: mine.id } }, foreign.id));
  assert.strictEqual(denied.status, 403);

  // กระดาน + ปิดคาบ (ที่เหลือ = ไม่มา)
  r = await call(server.address().port, 'GET', `/api/attendance/sheet?subjectId=${thai.id}&date=${date}`, h);
  assert.deepStrictEqual(r.body.counts, { present: 1, absent: 0, unchecked: 1, total: 2 });
  r = await call(server.address().port, 'POST', '/api/attendance/close', h, { subjectId: thai.id, date });
  assert.strictEqual(r.body.absentMarked, 1);
  r = await call(server.address().port, 'PUT', '/api/attendance/mark', h, { subjectId: thai.id, studentId: s2.id, date, status: 'PRESENT' });
  assert.strictEqual(r.body.counts.present, 2);

  // สรุป: ไทย 1 คาบ (มา 2) · คณิต 1 คาบ (มา 1 ไม่มา 1)
  r = await call(server.address().port, 'GET', '/api/attendance/summary?from=2026-10-01&to=2026-10-31', h);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const day = (id) => r.body.days.find(d => d.subjectId === id);
  assert.deepStrictEqual([day(thai.id).present, day(thai.id).absent], [2, 0]);
  assert.deepStrictEqual([day(math.id).present, day(math.id).absent], [1, 1]);
  const st = (id) => r.body.students.find(s => s.id === id);
  assert.deepStrictEqual([st(s1.id).present, st(s1.id).absent, st(s1.id).classDays, st(s1.id).percent], [1, 1, 2, 50]);
  assert.deepStrictEqual([st(s2.id).present, st(s2.id).absent, st(s2.id).percent], [2, 0, 100]);

  r = await call(server.address().port, 'GET', '/api/attendance/summary?subjectId=' + math.id + '&from=2026-11-01', h);
  assert.strictEqual(r.body.days.length, 0);

  r = await call(server.address().port, 'GET', '/api/attendance/export?from=2026-10-01&to=2026-10-31', h);
  assert.strictEqual(r.status, 200);
  assert.match(r.type, /spreadsheetml/);
  assert.strictEqual(r.raw.slice(0, 2).toString(), 'PK');

  // แบบมาเรียนรายวัน: สแกนเล่มวิชาไหนก็ได้ ไม่ผูกวิชา
  r = await call(server.address().port, 'POST', '/api/attendance/day/scan', h, { qrcodeData: `SNT-${sfx}-1-2`, date });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual([r.body.alreadyMarked, r.body.counts.present, r.body.counts.total], [false, 1, 2]);
  r = await call(server.address().port, 'POST', '/api/attendance/day/scan', h, { studentCode: 'A1', date });
  assert.strictEqual(r.body.alreadyMarked, true);
  r = await call(server.address().port, 'GET', `/api/attendance/day/sheet?classId=${c1.id}&date=${date}`, h);
  assert.deepStrictEqual(r.body.students.map(s => s.status), ['PRESENT', null]);
  r = await call(server.address().port, 'PUT', '/api/attendance/day/mark', h, { studentId: s2.id, date, present: true });
  assert.strictEqual(r.body.counts.present, 2);
  r = await call(server.address().port, 'PUT', '/api/attendance/day/mark', h, { studentId: s2.id, date, present: false });
  assert.strictEqual(r.body.counts.present, 1);
  r = await call(server.address().port, 'GET', '/api/attendance/day/summary?from=2026-10-01&to=2026-10-31', h);
  assert.deepStrictEqual([r.body.days.length, r.body.days[0].present, r.body.days[0].absent], [1, 1, 1]);
  const d1 = r.body.students.find(x => x.id === s1.id), d2 = r.body.students.find(x => x.id === s2.id);
  assert.deepStrictEqual([d1.percent, d2.percent], [100, 0]);
  r = await call(server.address().port, 'GET', '/api/attendance/day/export?from=2026-10-01&to=2026-10-31', h);
  assert.strictEqual(r.status, 200);

  // สรุปการส่งงานวันนี้ แยกวิชา/งาน
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  r = await call(server.address().port, 'GET', `/api/reports/teacher/day-submissions?date=${today}`, h);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const m = r.body.subjects.find(s => s.subjectId === math.id);
  assert.strictEqual(m.students, 1);
  assert.deepStrictEqual([m.tasks[0].count, m.tasks[0].total], [1, 2]);
  r = await call(server.address().port, 'GET', `/api/reports/teacher/day-submissions?date=2000-01-01`, h);
  assert.strictEqual(r.body.totals.pieces, 0);
  r = await call(server.address().port, 'GET', `/api/reports/teacher/day-submissions/export?date=${today}`, h);
  assert.strictEqual(r.status, 200);

  // สแกนตรวจงานต่อเนื่อง: เลือกงานก่อน สแกนเล่มไหนก็ผ่าน
  r = await call(server.address().port, 'POST', '/api/submissions/scan-check', h, { taskId: task.id, qrcodeData: `SNT-${sfx}-2-1` });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual([r.body.status, r.body.previousStatus, r.body.alreadyChecked], ['APPROVED', 'NOT_SUBMITTED', false]);
  assert.deepStrictEqual([r.body.progress.total, r.body.progress.checked], [2, 1]);
  r = await call(server.address().port, 'POST', '/api/submissions/scan-check', h, { taskId: task.id, qrcodeData: `SNT-${sfx}-2-1` });
  assert.strictEqual(r.body.alreadyChecked, true);
  assert.strictEqual(r.body.progress.checked, 1);
  // s1 ส่งแล้ว (PENDING) → สแกน = ผ่าน, เก็บ previousStatus ไว้ให้ย้อนกลับ
  r = await call(server.address().port, 'POST', '/api/submissions/scan-check', h, { taskId: task.id, studentCode: 'A1' });
  assert.deepStrictEqual([r.body.previousStatus, r.body.status, r.body.progress.checked], ['PENDING', 'APPROVED', 2]);
  // ต่างชั้น/ไม่เลือกงาน ถูกปฏิเสธ
  r = await call(server.address().port, 'POST', '/api/submissions/scan-check', h, { taskId: task.id, studentCode: 'A5' });
  assert.strictEqual(r.status, 400);
  r = await call(server.address().port, 'POST', '/api/submissions/scan-check', h, { studentCode: 'A1' });
  assert.strictEqual(r.status, 400);
  r = await call(server.address().port, 'GET', `/api/submissions/task-progress?taskId=${task.id}`, h);
  assert.deepStrictEqual([r.body.progress.total, r.body.progress.approved], [2, 2]);
  r = await call(server.address().port, 'GET', `/api/submissions/task-sheet?taskId=${task.id}`, h);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.students.map(x => [x.studentNumber, x.status]), [[1, 'APPROVED'], [2, 'APPROVED']]);
  assert.strictEqual(r.body.task.scoringType, 'SUBMISSION_ONLY');

  // งานให้คะแนน: สแกน = คะแนนเต็ม · สแกนซ้ำไม่ทับ · ปรับคะแนน · undo คืน status+score · ช่วงคะแนน
  const sc = await mk('task', { subjectId: math.id, taskName: 'คะแนน 1', taskNumber: 2, createdById: mine.id, scoringType: 'SCORED', maxScore: 5 });
  const nomax = await mk('task', { subjectId: math.id, taskName: 'ไม่มีเต็ม', taskNumber: 3, createdById: mine.id, scoringType: 'SCORED' });
  const scan = (body) => call(server.address().port, 'POST', '/api/submissions/scan-check', h, body);
  r = await scan({ taskId: sc.id, studentCode: 'A1' });
  assert.deepStrictEqual([r.body.status, r.body.score, r.body.previousScore, r.body.maxScore, r.body.alreadyChecked], ['APPROVED', 5, null, 5, false]);
  r = await scan({ taskId: sc.id, studentCode: 'A1', status: 'APPROVED', score: 4 });
  assert.deepStrictEqual([r.body.score, r.body.previousScore, r.body.alreadyChecked], [4, 5, false]);
  r = await scan({ taskId: sc.id, studentCode: 'A1' }); // สแกนซ้ำ ไม่ทับ
  assert.deepStrictEqual([r.body.score, r.body.alreadyChecked], [4, true]);
  r = await scan({ taskId: sc.id, studentCode: 'A1', score: 0 });
  assert.deepStrictEqual([r.body.score, r.body.status], [0, 'APPROVED']);
  for (const bad of [6, -1, 'abc', {}, true]) {
    r = await scan({ taskId: sc.id, studentCode: 'A1', score: bad });
    assert.strictEqual(r.status, 400, String(bad));
  }
  r = await scan({ taskId: sc.id, studentCode: 'A1', status: 'NOT_SUBMITTED', score: null }); // undo คืนของเดิม
  assert.deepStrictEqual([r.body.status, r.body.score], ['NOT_SUBMITTED', null]);
  r = await call(server.address().port, 'GET', `/api/submissions/task-sheet?taskId=${sc.id}`, h);
  assert.strictEqual(r.body.students.find(x => x.studentCode === 'A1').score, null);
  r = await scan({ taskId: nomax.id, studentCode: 'A2' });
  assert.deepStrictEqual([r.body.status, r.body.score, r.body.noMaxScore], ['APPROVED', null, true]);
  // งานผ่าน/ไม่ผ่าน ไม่แตะคะแนน
  r = await scan({ taskId: task.id, studentCode: 'A2', score: 3 });
  assert.strictEqual(r.body.score, null);
});
