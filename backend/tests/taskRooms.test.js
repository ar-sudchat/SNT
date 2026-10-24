const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
const { appliesTo, roomIdsOf } = require('../services/taskRooms');
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

const p = require.resolve(path.join('..', 'middleware/auth.js'));
require.cache[p] = { id: p, filename: p, loaded: true, exports: {
  authenticate: (req, res, next) => {
    if (!req.headers['x-tenant']) return res.status(401).json({});
    req.user = { id: 1, role: 'ADMIN', teacherId: req.headers['x-teacher'] ? +req.headers['x-teacher'] : null };
    req.tenantId = req.headers['x-tenant'];
    runWithTenant(req.tenantId, next);
  },
  authorize: () => (req, res, next) => next(),
  isAdmin: (req, res, next) => next(),
  isTeacher: (req, res, next) => next() } };
const tasksRouter = require('../routes/tasks');
const monitorRouter = require('../routes/monitor');

const call = (port, method, url, headers, body) => new Promise((resolve, reject) => {
  const d = body ? Buffer.from(JSON.stringify(body)) : null;
  const r = http.request({ port, method, path: url, headers: { 'content-type': 'application/json', ...(d ? { 'content-length': d.length } : {}), ...headers } },
    res => { let s = ''; res.on('data', c => s += c); res.on('end', () => resolve({ status: res.statusCode, body: s ? JSON.parse(s) : null })); });
  r.on('error', reject); r.end(d);
});

test('appliesTo: no rooms = every room', () => {
  assert.strictEqual(appliesTo({ rooms: [] }, 5), true);
  assert.strictEqual(appliesTo({ rooms: [{ classId: 1 }, { classId: 2 }] }, 2), true);
  assert.strictEqual(appliesTo({ rooms: [{ classId: 1 }] }, 3), false);
  assert.strictEqual(roomIdsOf({ rooms: [] }), null);
});

test('task rooms: one task in several rooms of a grade', async (t) => {
  const sfx = Date.now();
  const A = await base.tenant.create({ data: { slug: `rooms-${sfx}`, name: `ห้องงาน${sfx}` } });
  const year = await asBypass(base.academicYear.create({ data: { tenantId: A.id, year: '2502', isCurrent: true } }));
  const teacher = await asBypass(base.teacher.create({ data: { tenantId: A.id, teacherCode: 'T1', name: 'ครู' } }));
  const g6 = await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: 'ป.6' } }));
  const g5 = await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: 'ป.5' } }));
  const mkClass = (name, gradeId) => asBypass(base.class.create({ data: { tenantId: A.id, className: name, gradeId, academicYearId: year.id } }));
  const c1 = await mkClass('ป.6/1', g6.id), c2 = await mkClass('ป.6/2', g6.id), c3 = await mkClass('ป.6/3', g6.id), c5 = await mkClass('ป.5/1', g5.id);
  const s1 = await asBypass(base.student.create({ data: { tenantId: A.id, studentCode: 'R1', name: 'หนึ่ง', classId: c1.id } }));
  const s3 = await asBypass(base.student.create({ data: { tenantId: A.id, studentCode: 'R3', name: 'สาม', classId: c3.id } }));
  const subject = await asBypass(base.subject.create({ data: { tenantId: A.id, subjectCode: 'ค16101', subjectName: 'คณิต 6', gradeId: g6.id, academicYearId: year.id, teacherId: teacher.id } }));

  const app = express(); app.use(express.json());
  app.use('/api/tasks', tasksRouter); app.use('/api/monitor', monitorRouter);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(async () => {
    server.close();
    for (const m of ['submission', 'taskRoom', 'task', 'subject', 'student', 'class', 'grade', 'teacher', 'academicYear', 'auditLog'])
      await asBypass(base[m].deleteMany({ where: { tenantId: A.id } }));
    await base.tenant.deleteMany({ where: { id: A.id } });
    await base.$disconnect();
  });
  const port = server.address().port;
  const H = { 'x-tenant': A.id, 'x-teacher': String(teacher.id) };
  const task = (n, extra) => ({ subjectId: subject.id, taskName: `งาน ${n}`, taskNumber: n, ...extra });

  let taskId;
  await t.test('create in 6/1 + 6/2', async () => {
    const r = await call(port, 'POST', '/api/tasks', H, task(1, { classIds: [c1.id, c2.id] }));
    assert.strictEqual(r.status, 201, JSON.stringify(r.body));
    assert.deepStrictEqual(r.body.rooms.map(x => x.class.className).sort(), ['ป.6/1', 'ป.6/2']);
    taskId = r.body.id;
  });
  await t.test('room of another grade is rejected', async () => {
    const r = await call(port, 'POST', '/api/tasks', H, task(2, { classIds: [c1.id, c5.id] }));
    assert.strictEqual(r.status, 400);
  });
  await t.test('every room of the grade is stored as "all rooms"', async () => {
    const r = await call(port, 'POST', '/api/tasks', H, task(3, { classIds: [c1.id, c2.id, c3.id] }));
    assert.strictEqual(r.status, 201);
    assert.deepStrictEqual(r.body.rooms, []);
  });
  await t.test('update without classIds keeps rooms', async () => {
    const r = await call(port, 'PUT', `/api/tasks/${taskId}`, H, task(1, { taskName: 'งาน 1 แก้' }));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.rooms.length, 2);
  });
  await t.test('monitor: 6/3 is not assigned task 1 and it does not count as missing', async () => {
    const r = await call(port, 'GET', `/api/monitor/subject/${subject.id}`, H);
    assert.strictEqual(r.status, 200);
    const st3 = r.body.students.find(x => x.id === s3.id);
    const st1 = r.body.students.find(x => x.id === s1.id);
    assert.strictEqual(st3.submissions.find(x => x.taskId === taskId).status, 'NOT_ASSIGNED');
    assert.strictEqual(st3.progress.totalTasks, 1);
    assert.strictEqual(st1.progress.totalTasks, 2);
    const only63 = await call(port, 'GET', `/api/monitor/subject/${subject.id}?classId=${c3.id}`, H);
    assert.ok(!only63.body.tasks.some(x => x.id === taskId));
  });
  await t.test('class monitor of 6/3 hides task 1', async () => {
    const r = await call(port, 'GET', `/api/monitor/class/${c3.id}`, H);
    assert.strictEqual(r.status, 200);
    assert.ok(!JSON.stringify(r.body).includes('งาน 1 แก้'));
  });
});
