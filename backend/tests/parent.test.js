const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
process.env.PARENT_LINK_SECRET = 'test-secret';
const authorize = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'no' });
const authenticate = (req, res, next) => {
  const role = req.headers['x-role'];
  if (!role) return res.status(401).json({ error: 'no token' });
  req.user = { role, teacherId: Number(req.headers['x-teacher'] || 0) || null }; next();
};
stub('middleware/auth.js', { authenticate, authorize });

// Student 1: class home teacher 9, grade 2, year 1. Teacher 5 teaches a grade-2 subject.
const db = {
  student: {
    findUnique: async ({ where }) => where.id === 1 ? {
      id: 1, name: 'เด็กชายสมชาย ใจดี', status: 'ACTIVE', studentCode: 'S1', email: 'x@y.z',
      class: { teacherId: 9, gradeId: 2, academicYearId: 1, className: 'ม.1/1', academicYear: { year: '2568', name: null } }
    } : null
  },
  subject: {
    count: async ({ where }) => (where.teacherId === 5 && where.gradeId === 2 ? 1 : 0),
    findMany: async () => [{ id: 1, subjectName: 'คณิต', tasks: [
      { id: 10, taskName: 'งาน 1', taskNumber: 1, deadline: new Date(Date.now() - 86400000) },
      { id: 11, taskName: 'งาน 2', taskNumber: 2, deadline: null }] }]
  },
  submission: { findMany: async () => [{ taskId: 11, status: 'PENDING' }] }
};
stub('config/database.js', db);

const ctrl = require('../controllers/parentController');
const { linksRouter, publicRouter } = require('../routes/parent');

function req(port, method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const r = http.request({ port, method, path: p, headers: { 'content-type': 'application/json', ...(data ? { 'content-length': data.length } : {}), ...headers } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject); r.end(data);
  });
}

test('sign/verify roundtrip, tamper, expiry', () => {
  const { token } = ctrl.signToken(1);
  assert.strictEqual(ctrl.verifyToken(token).sid, 1);
  const [p, s] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ sid: 2, exp: 9999999999 })).toString('base64url');
  assert.strictEqual(ctrl.verifyToken(`${forged}.${s}`), null);
  assert.strictEqual(ctrl.verifyToken(`${p}.${s.slice(0, -2)}xx`), null);
  assert.strictEqual(ctrl.verifyToken(ctrl.signToken(1, -1).token), null);
  assert.strictEqual(ctrl.verifyToken('garbage'), null);
});

test('parent routes', async (t) => {
  const app = express();
  app.use(express.json());
  app.use('/api/parent-links', linksRouter);
  app.use('/api/public/parent', publicRouter);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(() => server.close());
  const port = server.address().port;

  await t.test('create requires auth and role', async () => {
    assert.strictEqual((await req(port, 'POST', '/api/parent-links', { studentId: 1 })).status, 401);
    assert.strictEqual((await req(port, 'POST', '/api/parent-links', { studentId: 1 }, { 'x-role': 'STUDENT' })).status, 403);
  });
  await t.test('teacher without ownership -> 403', async () => {
    const r = await req(port, 'POST', '/api/parent-links', { studentId: 1 }, { 'x-role': 'TEACHER', 'x-teacher': '7' });
    assert.strictEqual(r.status, 403);
  });
  let token;
  await t.test('subject teacher / home teacher / admin can create', async () => {
    for (const h of [{ 'x-role': 'TEACHER', 'x-teacher': '5' }, { 'x-role': 'TEACHER', 'x-teacher': '9' }, { 'x-role': 'ADMIN' }]) {
      const r = await req(port, 'POST', '/api/parent-links', { studentId: 1 }, h);
      assert.strictEqual(r.status, 200);
      const b = JSON.parse(r.body);
      assert.ok(b.url.endsWith('/p/' + b.token) && b.expiresAt);
      token = b.token;
    }
  });
  await t.test('public view returns minimal data', async () => {
    const r = await req(port, 'GET', '/api/public/parent/' + token);
    assert.strictEqual(r.status, 200);
    const b = JSON.parse(r.body);
    assert.strictEqual(b.student.firstName, 'สมชาย');
    assert.deepStrictEqual(Object.keys(b.student).sort(), ['className', 'firstName']);
    assert.ok(!r.body.includes('S1') && !r.body.includes('x@y.z'));
    assert.strictEqual(b.summary.total, 2);
    assert.strictEqual(b.summary.missing, 1);
    assert.strictEqual(b.summary.overdue, 1);
  });
  await t.test('tampered / expired -> 401 Thai', async () => {
    const r = await req(port, 'GET', '/api/public/parent/' + token.slice(0, -3) + 'abc');
    assert.strictEqual(r.status, 401);
    assert.strictEqual(JSON.parse(r.body).error, 'ลิงก์หมดอายุหรือไม่ถูกต้อง');
    assert.strictEqual((await req(port, 'GET', '/api/public/parent/' + ctrl.signToken(1, -1).token)).status, 401);
  });
});
