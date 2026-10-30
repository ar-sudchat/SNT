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
const router = require('../routes/absenceNotices');
const { noticesForStudent } = require('../services/absenceNotify');

const call = (port, method, url, headers, body) => new Promise((resolve, reject) => {
  const d = body ? Buffer.from(JSON.stringify(body)) : null;
  const r = http.request({ port, method, path: url, headers: { 'content-type': 'application/json', ...(d ? { 'content-length': d.length } : {}), ...headers } },
    res => { const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString() || 'null') })); });
  r.on('error', reject); r.end(d);
});

test('absence notices: notify parents of ABSENT students, idempotent, hidden once corrected', async (t) => {
  const sfx = Date.now();
  const A = await base.tenant.create({ data: { slug: `abn-${sfx}`, name: `แจ้งขาด${sfx}` } });
  const mk = (m, data) => asBypass(base[m].create({ data: { tenantId: A.id, ...data } }));
  const year = await mk('academicYear', { year: '2503', isCurrent: true });
  const mine = await mk('teacher', { teacherCode: 'T1', name: 'ครูฉัน' });
  const other = await mk('teacher', { teacherCode: 'T2', name: 'ครูอื่น' });
  const g = await mk('grade', { gradeName: 'ป.6' });
  const c = await mk('class', { className: 'ป.6/1', gradeId: g.id, academicYearId: year.id });
  const s1 = await mk('student', { studentCode: 'B1', name: 'หนึ่ง', classId: c.id });
  const s2 = await mk('student', { studentCode: 'B2', name: 'สอง', classId: c.id });
  const math = await mk('subject', { subjectCode: 'M', subjectName: 'คณิต', gradeId: g.id, academicYearId: year.id, teacherId: mine.id });
  const foreign = await mk('subject', { subjectCode: 'X', subjectName: 'อื่น', gradeId: g.id, academicYearId: year.id, teacherId: other.id });
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  await mk('attendance', { studentId: s1.id, subjectId: math.id, date, status: 'ABSENT' });
  await mk('attendance', { studentId: s2.id, subjectId: math.id, date, status: 'PRESENT' });

  const app = express(); app.use(express.json()); app.use('/api/absence-notices', router);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => {
    server.close();
    for (const m of ['absenceNotice', 'attendance', 'subject', 'student', 'class', 'grade', 'teacher', 'academicYear'])
      await asBypass(base[m].deleteMany({ where: { tenantId: A.id } }));
    await base.tenant.deleteMany({ where: { id: A.id } });
  });
  const h = { 'x-tenant': A.id, 'x-teacher': String(mine.id) };
  const port = server.address().port;

  let r = await call(port, 'GET', `/api/absence-notices?subjectId=${math.id}&date=${date}`, h);
  assert.deepStrictEqual(r.body, { notified: 0 });

  r = await call(port, 'POST', '/api/absence-notices', h, { subjectId: math.id, date });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual(r.body, { absent: 1, created: 1, notified: 1 });
  r = await call(port, 'POST', '/api/absence-notices', h, { subjectId: math.id, date });
  assert.deepStrictEqual(r.body, { absent: 1, created: 0, notified: 1 });

  // validation + ownership
  assert.strictEqual((await call(port, 'POST', '/api/absence-notices', h, { date })).status, 400);
  assert.strictEqual((await call(port, 'POST', '/api/absence-notices', h, { subjectId: math.id, date: 'x' })).status, 400);
  assert.strictEqual((await call(port, 'POST', '/api/absence-notices', h, { subjectId: foreign.id, date })).status, 403);
  assert.strictEqual((await call(port, 'POST', '/api/absence-notices', {}, { subjectId: math.id, date })).status, 401);

  await runWithTenant(A.id, async () => {
    assert.deepStrictEqual(await noticesForStudent(s1.id), [{ date, subjectName: 'คณิต' }]);
    assert.deepStrictEqual(await noticesForStudent(s2.id), []);
    // ครูแก้เป็น "มา" แล้ว ผู้ปกครองต้องไม่เห็นการแจ้งเดิม
    await prisma.attendance.updateMany({ where: { studentId: s1.id, subjectId: math.id, date }, data: { status: 'PRESENT' } });
    assert.deepStrictEqual(await noticesForStudent(s1.id), []);
  });
});
