const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const XLSX = require('xlsx');
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

const call = (port, url, headers) => new Promise((resolve, reject) => {
  http.request({ port, method: 'GET', path: url, headers }, res => {
    const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => {
      const buf = Buffer.concat(chunks); const ct = res.headers['content-type'] || '';
      resolve({ status: res.statusCode, type: ct, raw: buf, body: ct.includes('json') && buf.length ? JSON.parse(buf.toString()) : null });
    });
  }).on('error', reject).end();
});

test('attendance report: monthly summary, frequent absentees, pp5 export', async (t) => {
  const sfx = Date.now();
  const A = await base.tenant.create({ data: { slug: `attr-${sfx}`, name: `โรงเรียนทดสอบ${sfx}` } });
  const mk = (m, data) => asBypass(base[m].create({ data: { tenantId: A.id, ...data } }));
  const year = await mk('academicYear', { year: '2569', isCurrent: true });
  const mine = await mk('teacher', { teacherCode: 'T1', name: 'ครูฉัน' });
  const other = await mk('teacher', { teacherCode: 'T2', name: 'ครูอื่น' });
  const g6 = await mk('grade', { gradeName: 'ป.6' });
  const c1 = await mk('class', { className: 'ป.6/1', gradeId: g6.id, academicYearId: year.id });
  const s1 = await mk('student', { studentCode: 'R1', name: 'หนึ่ง', classId: c1.id, studentNumber: 1 });
  const s2 = await mk('student', { studentCode: 'R2', name: 'สอง', classId: c1.id, studentNumber: 2 });
  const math = await mk('subject', { subjectCode: 'M6', subjectName: 'คณิต', gradeId: g6.id, academicYearId: year.id, teacherId: mine.id });
  const foreign = await mk('subject', { subjectCode: 'X6', subjectName: 'ครูอื่น', gradeId: g6.id, academicYearId: year.id, teacherId: other.id });
  const dates = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
  // s1 มาวันแรกแล้วขาดติดกัน 3 วัน · s2 มาครบ
  for (const [i, d] of dates.entries()) {
    await mk('attendance', { studentId: s1.id, subjectId: math.id, date: d, status: i === 0 ? 'PRESENT' : 'ABSENT' });
    await mk('attendance', { studentId: s2.id, subjectId: math.id, date: d, status: 'PRESENT' });
  }
  await mk('attendance', { studentId: s2.id, subjectId: math.id, date: '2026-11-02', status: 'PRESENT' });

  const app = express(); app.use(express.json());
  app.use('/api/attendance', attendanceRouter);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => {
    server.close();
    for (const m of ['attendance', 'subject', 'student', 'class', 'grade', 'teacher', 'academicYear', 'auditLog'])
      await asBypass(base[m].deleteMany({ where: { tenantId: A.id } }));
    await base.tenant.deleteMany({ where: { id: A.id } });
  });
  const h = { 'x-tenant': A.id, 'x-teacher': String(mine.id) };
  const port = server.address().port;

  let r = await call(port, '/api/attendance/monthly?month=2026-10', h);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual(r.body.subjects.map(s => [s.id, s.classDays, s.present, s.absent, s.percent]), [[math.id, 4, 5, 3, 62.5]]);
  const st = (id) => r.body.students.find(s => s.id === id);
  assert.deepStrictEqual([st(s1.id).present, st(s1.id).absent, st(s1.id).percent, st(s1.id).maxStreak], [1, 3, 25, 3]);
  assert.deepStrictEqual([st(s1.id).low, st(s1.id).frequent, st(s2.id).low, st(s2.id).frequent], [true, true, false, false]);
  assert.deepStrictEqual(r.body.frequentAbsent.map(s => s.id), [s1.id]);
  assert.deepStrictEqual(r.body.days.map(d => [d.date, d.present, d.total]), [[dates[0], 2, 2], [dates[1], 1, 2], [dates[2], 1, 2], [dates[3], 1, 2]]);

  // เกณฑ์ปรับได้: ขาดติดกัน 4 วันขึ้นไปจึงจะ "ขาดบ่อย" (s1 ยังต่ำกว่า 80% จึงติดธง low)
  r = await call(port, '/api/attendance/monthly?month=2026-10&streak=4&threshold=20', h);
  assert.deepStrictEqual([st(s1.id).low, st(s1.id).frequent], [false, false]);
  assert.strictEqual(r.body.frequentAbsent.length, 0);

  r = await call(port, '/api/attendance/monthly?month=2026-12', h);
  assert.deepStrictEqual([r.body.subjects.length, r.body.students.length], [0, 0]);
  r = await call(port, '/api/attendance/monthly?month=bad', h);
  assert.strictEqual(r.status, 400);
  r = await call(port, `/api/attendance/monthly?month=2026-10&subjectId=${foreign.id}`, h);
  assert.strictEqual(r.body.subjects.length, 0);

  // ปพ.5: 1 ชีตต่อห้อง×เดือน
  r = await call(port, `/api/attendance/pp5-export?subjectId=${math.id}&month=2026-10`, h);
  assert.strictEqual(r.status, 200);
  assert.match(r.type, /spreadsheetml/);
  const wb = XLSX.read(r.raw, { type: 'buffer' });
  assert.strictEqual(wb.SheetNames.length, 1);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  assert.match(rows[0][0], /ปพ\.5/);
  assert.match(rows[1][0], /โรงเรียนทดสอบ/);
  assert.match(rows[2][0], /M6 คณิต.*ป\.6\/1.*2569/);
  assert.deepStrictEqual(rows[5].slice(3, 7), [5, 6, 7, 8]);
  assert.deepStrictEqual(rows[6].slice(3, 10), ['/', 'ข', 'ข', 'ข', 1, 3, 25]);
  assert.deepStrictEqual(rows[7].slice(3, 10), ['/', '/', '/', '/', 4, 0, 100]);

  // หลายเดือนในช่วงวันที่ = หลายชีต · ไม่มีข้อมูล = 404 · วิชาครูอื่น = 404
  r = await call(port, `/api/attendance/pp5-export?subjectId=${math.id}&from=2026-10-01&to=2026-11-30`, h);
  assert.strictEqual(XLSX.read(r.raw, { type: 'buffer' }).SheetNames.length, 2);
  r = await call(port, `/api/attendance/pp5-export?subjectId=${math.id}&month=2026-12`, h);
  assert.strictEqual(r.status, 404);
  r = await call(port, `/api/attendance/pp5-export?subjectId=${foreign.id}&month=2026-10`, h);
  assert.strictEqual(r.status, 404);
  r = await call(port, '/api/attendance/pp5-export?month=2026-10', h);
  assert.strictEqual(r.status, 400);
});
