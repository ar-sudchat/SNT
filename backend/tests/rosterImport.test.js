const test = require('node:test');
const assert = require('node:assert/strict');
const dbPath = require.resolve('../config/database');
require.cache[dbPath] = { exports: {} };
const ai = require('../services/aiProvider');
const r = require('../services/rosterImport');
const csv = text => r.readTable({ originalname: 'students.csv', buffer: Buffer.from(text) });
test('Windows-874 template preserves Thai names and classes', () => {
  const text = 'StudentCode,StudentNumber,Name,ClassName,Email,Status\n01234,1,สมชาย ใจดี,ป.4/1,,ACTIVE';
  const buffer = Buffer.from([...text].map(c => c.charCodeAt(0) >= 0x0e01 ? c.charCodeAt(0) - 0x0e00 + 0xa0 : c.charCodeAt(0)));
  const { rows } = r.readTable({ originalname: 'list.csv', buffer });
  const { mapping } = r.guessMapping(rows[0], rows.slice(1));
  const { students } = r.buildStudents(rows.slice(1), mapping);
  assert.equal(students[0].name, 'สมชาย ใจดี'); assert.equal(students[0].studentCode, '01234'); assert.equal(students[0].className, 'ป.4/1');
});
test('title, blank row, split names and original row numbers', () => {
  const { rows } = csv('รายชื่อนักเรียนชั้นประถมศึกษาปีที่ 4/1\n\nเลขที่,เลขประจำตัว,คำนำหน้า,ชื่อ,นามสกุล\n1,12345,ด.ช.,สมชาย,ใจดี');
  const h = r.findHeaderRow(rows); assert.equal(rows[h].fileRow - 1, 2);
  const defaultClass = r.classFromContext(rows.slice(0, h), ''); assert.equal(defaultClass, 'ป.4/1');
  const { students } = r.buildStudents(rows.slice(h + 1), r.guessMapping(rows[h], rows.slice(h + 1)).mapping, { defaultClass });
  assert.equal(students[0].name, 'ด.ช.สมชาย ใจดี'); assert.equal(students[0].row, 4);
});
test('unknown headers inferred from shapes', () => {
  const { mapping, confidence } = r.guessMapping(['A','B','C','D'], [['12345','1','ด.ญ.สมใจ ใจดี','ม.2/3'],['12346','2','ด.ช.สมชาย ใจดี','ม.2/3']]);
  assert.equal(mapping.studentCode, 0); assert.equal(mapping.studentNumber, 1); assert.equal(mapping.fullName, 2); assert.equal(mapping.className, 3); assert.equal(confidence, 'high');
});
test('grade and numeric room combine; canonical forms', () => {
  const rows = [['สมใจ','ป.5','2']]; const { mapping } = r.guessMapping(['ชื่อ','ชั้น','ห้อง'], rows);
  assert.equal(r.buildStudents(rows, mapping).students[0].className, 'ป.5/2');
  for (const value of ['ม1/2','ม. 1 / 2','มัธยมศึกษาปีที่ 1/2']) assert.equal(r.normalizeClassName(value), 'ม.1/2');
  assert.equal(r.normalizeClassName('', '4', '1'), 'ป.4/1');
});
test('generated codes, duplicate and missing names', () => {
  const mapping = r.guessMapping(['ชื่อ','เลขที่','รหัส'], []).mapping;
  const result = r.buildStudents([['สมชาย','1',''],['สมใจ','1',''],['','3','55555']], mapping, { defaultClass: 'ป.4/1' });
  assert.equal(result.students.length, 1); assert.equal(result.students[0].studentCode, 'ป41-01'); assert.equal(result.students[0].codeGenerated, true);
  assert.deepEqual(result.issues.map(i => i.message), ['รหัสซ้ำในไฟล์','ไม่มีชื่อ']);
});
test('AI only receives safe metadata, including headerless student data', async () => {
  const original = ai.generate; let prompt;
  ai.generate = async args => { prompt = args.prompt; return '{"mapping":{"fullName":0,"studentCode":1}}'; };
  try {
    const headers = ['ด.ญ.ลับสุด ใจดี','123456789'];
    const mapping = await r.aiMapping(headers, r.columnProfiles(headers, [['ด.ญ.สมใจ ใจดี','987654321']]));
    assert.equal(mapping.fullName, 0);
    for (const secret of [...headers,'ด.ญ.สมใจ ใจดี','987654321']) assert.ok(!prompt.includes(secret));
    ai.generate = async () => '{"mapping":{"fullName":999}}'; assert.equal(await r.aiMapping(headers, []), null);
  } finally { ai.generate = original; }
});
test('term/year in a title is not a class', () => {
  assert.equal(r.classFromContext([['รายชื่อนักเรียน ภาคเรียนที่ 1/2569']], ''), null);
  assert.equal(r.classFromContext([['ภาคเรียนที่ 1/2569 ชั้นประถมศึกษาปีที่ 4/1']], ''), 'ป.4/1');
  assert.equal(r.classFromContext([['ห้อง 5/2 ปีการศึกษา 2569']], ''), 'ป.5/2');
  assert.equal(r.normalizeClassName('1/2569'), '1/2569');
});
test('quoted CSV and empty rows', () => { const { rows } = csv('Name,ClassName\n"สมชาย, ใจดี",ป.4/1\n\n'); assert.equal(rows.length, 2); assert.equal(rows[1][0], 'สมชาย, ใจดี'); });
