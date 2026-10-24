const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const express = require('express');

// Stub auth and the controller so no DB / JWT is touched; keep the real multer config.
const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
const pass = (req, res, next) => next();
stub('middleware/auth.js', { authenticate: pass, isAdmin: pass });
const handler = (req, res) => res.json({ ok: true, name: req.file && req.file.originalname });
const ctrl = new Proxy({}, { get: () => handler });
stub('controllers/importController.js', ctrl);

const router = require('../routes/import');

function upload(port, filename, mimetype) {
  return new Promise((resolve, reject) => {
    const b = '----t';
    const body = Buffer.from(
      `--${b}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimetype}\r\n\r\nA,B\r\n1,2\r\n--${b}--\r\n`);
    const req = http.request({ port, method: 'POST', path: '/validate',
      headers: { 'content-type': `multipart/form-data; boundary=${b}`, 'content-length': body.length } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject); req.end(body);
  });
}

test('multer fileFilter', async (t) => {
  const app = express();
  app.use('/', router);
  app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.message }));
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  t.after(() => server.close());
  const port = server.address().port;

  await t.test('accepts by extension when mimetype is odd', async () => {
    for (const [n, m] of [['a.csv', 'application/octet-stream'], ['A.XLSX', 'text/plain'], ['a.json', 'application/octet-stream']]) {
      const r = await upload(port, n, m);
      assert.strictEqual(r.status, 200, `${n} ${m}`);
    }
  });
  await t.test('accepts by mimetype', async () => {
    assert.strictEqual((await upload(port, 'noext', 'text/csv')).status, 200);
  });
  await t.test('rejects .exe with 400 and Thai message', async () => {
    const r = await upload(port, 'virus.exe', 'application/x-msdownload');
    assert.strictEqual(r.status, 400);
    assert.match(JSON.parse(r.body).error, /รองรับเฉพาะไฟล์/);
  });
});
