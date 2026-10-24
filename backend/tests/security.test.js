const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
// Real authorize logic; authenticate takes the role from a header (no DB/JWT)
const realAuthorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'no' });
const authenticate = (req, res, next) => {
  const role = req.headers['x-role'];
  if (!role) return res.status(401).json({ error: 'no token' });
  req.user = { role }; next();
};
const isAdmin = (req, res, next) => req.user.role === 'ADMIN' ? next() : res.status(403).end();
const isTeacher = (req, res, next) => ['ADMIN', 'TEACHER'].includes(req.user.role) ? next() : res.status(403).end();
stub('middleware/auth.js', { authenticate, authorize: realAuthorize, isAdmin, isTeacher });

let loginStatus = 401;
const ctrl = (extra = {}) => new Proxy(extra, { get: (t, k) => t[k] || ((req, res) => res.json({ ok: true })) });
stub('controllers/authController.js', ctrl({ login: (req, res) => res.status(loginStatus).json({ error: 'x' }) }));
stub('controllers/studentController.js', ctrl());

const loginRateLimit = require('../middleware/loginRateLimit');
const authRouter = require('../routes/auth');
const studentRouter = require('../routes/students');
const { csvSafe } = (() => { stub('config/database.js', {}); return require('../controllers/reportController'); })();

function req(port, method, p, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const r = http.request({ port, method, path: p, headers: { 'content-type': 'application/json', ...(data ? { 'content-length': data.length } : {}), ...headers } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject); r.end(data);
  });
}

test('security', async (t) => {
  const app = express();
  app.use(express.json());
  app.use(require('../middleware/securityHeaders'));
  app.use('/auth', authRouter);
  app.use('/students', studentRouter);
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(() => server.close());
  const port = server.address().port;
  const reg = { email: 'x@example.com', password: 'secret12', role: 'ADMIN' };

  await t.test('register blocked without token / for non-admin', async () => {
    assert.strictEqual((await req(port, 'POST', '/auth/register', reg)).status, 401);
    assert.strictEqual((await req(port, 'POST', '/auth/register', reg, { 'x-role': 'STUDENT' })).status, 403);
    assert.strictEqual((await req(port, 'POST', '/auth/register', reg, { 'x-role': 'TEACHER' })).status, 403);
  });
  await t.test('register cannot create ADMIN even as admin', async () => {
    assert.strictEqual((await req(port, 'POST', '/auth/register', reg, { 'x-role': 'ADMIN' })).status, 400);
    const ok = await req(port, 'POST', '/auth/register', { ...reg, role: 'TEACHER' }, { 'x-role': 'ADMIN' }); assert.strictEqual(ok.status, 200, ok.body);
  });
  await t.test('login rate limit: 5 fails then 429, other user unaffected', async () => {
    loginRateLimit._reset(); loginStatus = 401;
    for (let i = 0; i < 5; i++) assert.strictEqual((await req(port, 'POST', '/auth/login', { username: 'T001', password: 'bad' })).status, 401);
    const r = await req(port, 'POST', '/auth/login', { username: 'T001', password: 'bad' });
    assert.strictEqual(r.status, 429);
    assert.match(JSON.parse(r.body).error, /หลายครั้ง/);
    assert.strictEqual((await req(port, 'POST', '/auth/login', { username: 'T002', password: 'bad' })).status, 401);
  });
  await t.test('successful login clears the counter', async () => {
    loginRateLimit._reset();
    for (let i = 0; i < 4; i++) await req(port, 'POST', '/auth/login', { username: 'S1', password: 'bad' });
    loginStatus = 200; await req(port, 'POST', '/auth/login', { username: 'S1', password: 'ok' });
    loginStatus = 401;
    for (let i = 0; i < 4; i++) assert.strictEqual((await req(port, 'POST', '/auth/login', { username: 'S1', password: 'bad' })).status, 401);
  });
  await t.test('GET /students requires staff role', async () => {
    assert.strictEqual((await req(port, 'GET', '/students', null, { 'x-role': 'STUDENT' })).status, 403);
    assert.strictEqual((await req(port, 'GET', '/students/1', null, { 'x-role': 'STUDENT' })).status, 403);
    assert.strictEqual((await req(port, 'GET', '/students', null, { 'x-role': 'TEACHER' })).status, 200);
    assert.strictEqual((await req(port, 'GET', '/students', null, { 'x-role': 'ADMIN' })).status, 200);
  });
  await t.test('security headers present', async () => {
    const r = await new Promise(res => http.get({ port, path: '/students', headers: { 'x-role': 'ADMIN' } }, res));
    assert.strictEqual(r.headers['x-frame-options'], 'DENY');
    assert.strictEqual(r.headers['x-content-type-options'], 'nosniff');
    r.resume();
  });
  await t.test('csvSafe neutralises formulas', () => {
    assert.strictEqual(csvSafe('=HYPERLINK("x")'), `'=HYPERLINK("x")`);
    assert.strictEqual(csvSafe('+1'), "'+1");
    assert.strictEqual(csvSafe('-2'), "'-2");
    assert.strictEqual(csvSafe('@a'), "'@a");
    assert.strictEqual(csvSafe('สมชาย'), 'สมชาย');
    assert.strictEqual(csvSafe(null), '');
    assert.strictEqual(csvSafe(5), '5');
  });
});
