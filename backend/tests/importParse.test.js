const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const xlsx = require('xlsx');
const importController = require('../controllers/importController');

const REAL_CSV = '/Users/artit/SNT/student_template (4).csv';
const parse = (buf, originalname, mimetype) => importController.parseFile({ buffer: buf, originalname, mimetype });

test('UTF-8 CSV', async () => {
  const rows = await parse(Buffer.from('StudentCode,Name\n001,สมชาย\n', 'utf8'), 'a.csv', 'text/csv');
  assert.deepStrictEqual(rows, [{ StudentCode: '001', Name: 'สมชาย' }]);
});

test('UTF-8 CSV with BOM: first header is exactly StudentCode', async () => {
  const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('StudentCode,Name\n001,สมชาย\n', 'utf8')]);
  const rows = await parse(buf, 'a.csv', 'text/csv');
  assert.strictEqual(Object.keys(rows[0])[0], 'StudentCode');
  assert.strictEqual(rows[0].Name, 'สมชาย');
});

test('Windows-874 CSV (real template file)', { skip: !fs.existsSync(REAL_CSV) && 'real file missing' }, async () => {
  const rows = await parse(fs.readFileSync(REAL_CSV), 'student_template (4).csv', 'application/vnd.ms-excel');
  assert.strictEqual(rows.length, 35);
  assert.strictEqual(rows[0].Name, 'เด็กชายนนทพัทธ์ สังข์อุไร');
  assert.strictEqual(Object.keys(rows[0])[0], 'StudentCode');
});

test('decodeText falls back to windows-874 and strips BOM', () => {
  assert.strictEqual(importController.decodeText(Buffer.from([0xca, 0xc7, 0xd1, 0xca, 0xb4, 0xd5])), 'สวัสดี');
  assert.strictEqual(importController.decodeText(Buffer.from('﻿abc', 'utf8')), 'abc');
});

test('octet-stream mimetype with .CSV extension is parsed as CSV', async () => {
  const rows = await parse(Buffer.from('A,B\n1,2\n'), 'DATA.CSV', 'application/octet-stream');
  assert.deepStrictEqual(rows, [{ A: '1', B: '2' }]);
});

test('header whitespace is trimmed', async () => {
  const rows = await parse(Buffer.from(' A , B \n1,2\n'), 'a.csv', 'text/csv');
  assert.deepStrictEqual(Object.keys(rows[0]), ['A', 'B']);
});

test('xlsx buffer', async () => {
  const ws = xlsx.utils.aoa_to_sheet([[' StudentCode ', 'Name'], ['001', 'สมหญิง']]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'S1');
  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const rows = await parse(buf, 'a.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.deepStrictEqual(rows, [{ StudentCode: '001', Name: 'สมหญิง' }]);
});

test('JSON by mimetype and by extension', async () => {
  const buf = Buffer.from(JSON.stringify([{ a: 'ก' }]));
  assert.deepStrictEqual(await parse(buf, 'x.bin', 'application/json'), [{ a: 'ก' }]);
  assert.deepStrictEqual(await parse(buf, 'x.JSON', 'application/octet-stream'), [{ a: 'ก' }]);
});
