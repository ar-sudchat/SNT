const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const xlsx = require('xlsx');
const stub = (name, exports) => { const p = require.resolve(name); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const pass = (req, res, next) => next();
stub('../middleware/auth', { authenticate: pass, isAdmin: pass, authorize: () => pass });
stub('../middleware/tenant', { restoreTenant: pass });
let year = { id: 1, year: '2569' }, writes = [], quotaAdding;
const db = { student: { findMany: async () => [], upsert: async args => { writes.push(args); } }, class: { findMany: async () => [], findUnique: async () => null, upsert: async () => ({ id: 3 }) }, grade: { findMany: async () => [], findUnique: async () => null, upsert: async () => ({ id: 2 }) }, academicYear: { findFirst: async () => year } };
stub('../config/database', db);
stub('../services/audit', { log: async () => {} });
stub('../middleware/planLimit', { enforceAiQuota: async () => false, enforceStudentQuota: async (req, res, adding) => { quotaAdding = adding; return true; } });
stub('../services/aiProvider', { getConfig: () => ({ apiKey: null }) });
const router = require('../routes/import');
test('smart import preview and commit validation', async t => {
  const app = express(); app.use(router);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(() => server.close()); const url = `http://127.0.0.1:${server.address().port}`;
  await t.test('xlsx preview returns mapping, students and plan', async () => {
    const book = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([['เลขที่','ชื่อ','ชั้น','ห้อง'],[1,'สมชาย','ป.5',2]]), 'รายชื่อ');
    const form = new FormData(); form.append('file', new Blob([xlsx.write(book, { type: 'buffer', bookType: 'xlsx' })]), 'roster.xlsx');
    const res = await fetch(url + '/smart/preview', { method: 'POST', body: form }); const data = await res.json();
    assert.equal(res.status, 200); assert.equal(data.mapping.firstName, 1); assert.equal(data.students[0].className, 'ป.5/2'); assert.equal(data.plan.create, 1);
  });
  const post = students => fetch(url + '/smart/commit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students }) });
  const student = { studentCode: '12345', name: 'สมชาย', className: 'ป.4/1', studentNumber: 1 };
  await t.test('invalid and duplicate students rejected before writes', async () => { assert.equal((await post([{ ...student, name: '' }])).status, 400); assert.equal((await post([student, student])).status, 400); assert.equal(writes.length, 0); });
  await t.test('requires current year', async () => { year = null; assert.equal((await post([student])).status, 400); year = { id: 1, year: '2569' }; });
  await t.test('commit creates class and grade, checks new student quota and upserts', async () => { const res = await post([student]); assert.equal(res.status, 200); assert.deepEqual(await res.json(), { created: 1, updated: 0, classesCreated: 1, gradesCreated: 1 }); assert.equal(quotaAdding, 1); assert.equal(writes[0].update.status, 'ACTIVE'); });
});

test('smart controllers without network: preview, overrides, limits, quota and commit', async t => {
  const controller = require('../controllers/smartImportController');
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } });
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, xlsx.utils.aoa_to_sheet([['รายชื่อนักเรียนชั้นประถมศึกษาปีที่ 4/1'],[],['เลขที่','ชื่อ','นามสกุล'],[1,'สมชาย','ใจดี']]), 'รายชื่อ');
  const file = { originalname: 'roster.xlsx', buffer: xlsx.write(book, { type: 'buffer', bookType: 'xlsx' }) };
  const res = response(); await controller.preview({ file, body: {} }, res);
  assert.equal(res.code, 200); assert.equal(res.data.headerRow, 2); assert.equal(res.data.students[0].name, 'สมชาย ใจดี'); assert.equal(res.data.students[0].row, 4); assert.equal(res.data.students[0].className, 'ป.4/1');
  const corrected = response(); await controller.preview({ file, body: { headerRow: '2', mapping: JSON.stringify(res.data.mapping), defaultClass: 'ม.2/3' } }, corrected);
  assert.equal(corrected.data.mappingSource, 'user'); assert.equal(corrected.data.students[0].className, 'ม.2/3');
  const invalid = response(); await controller.preview({ file, body: { mapping: '{' } }, invalid); assert.equal(invalid.code, 400);
  const large = response(); await controller.preview({ file: { originalname: 'large.csv', buffer: Buffer.from('ชื่อ,ห้อง\n' + 'สมชาย,ป.4/1\n'.repeat(3001)) }, body: {} }, large); assert.equal(large.code, 400);
  const students = corrected.data.students;
  const missingYear = response(); year = null; await controller.commit({ body: { students } }, missingYear); assert.equal(missingYear.code, 400); year = { id: 1, year: '2569' };
  const duplicate = response(); await controller.commit({ body: { students: [...students, ...students] } }, duplicate); assert.equal(duplicate.code, 400);
  writes = []; const saved = response(); await controller.commit({ body: { students } }, saved); assert.equal(saved.code, 200); assert.equal(saved.data.created, 1); assert.equal(quotaAdding, 1); assert.equal(writes[0].update.status, 'ACTIVE');
});
