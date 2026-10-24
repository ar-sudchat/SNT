// บันทึกหลังแผน: Word export (no database needed) — point ranges, document structure, controller validation.
const test = require('node:test');
const assert = require('node:assert');
const JSZip = require('jszip');
const { buildDocx, levelRanges } = require('../services/assessmentDocx');
const { BUILTINS, DEFAULT_SETTINGS, scoreOf, fullValues } = require('../services/assessmentCore');

const lv = (key) => BUILTINS.find(b => b.key === key).levels;

test('levelRanges: 15 points -> 14-15 / 11-13 / 8-10 / ต่ำกว่า 8', () => {
  const r = levelRanges({ levels: lv('behav'), criteriaCount: 5, maxScore: 3, useAverage: false });
  assert.deepStrictEqual(r.map(x => x.range), ['14 – 15', '11 – 13', '8 – 10', 'ต่ำกว่า 8']);
  assert.deepStrictEqual(r.map(x => x.label), ['ดีมาก', 'ดี', 'พอใช้', 'ปรับปรุง']);
});

test('levelRanges: ranges agree with scoreOf for every possible total', () => {
  for (const key of ['behav', 'act', 'trait', 'comp']) {
    const b = BUILTINS.find(x => x.key === key);
    const n = b.criteria.length;
    const rows = levelRanges({ levels: b.levels, criteriaCount: n, maxScore: b.maxScore, useAverage: false });
    for (let t = n; t <= n * b.maxScore; t++) {
      const vals = Array(n).fill(0); let left = t;
      for (let i = 0; i < n; i++) { vals[i] = Math.min(b.maxScore, left - (n - 1 - i)); left -= vals[i]; }
      const level = scoreOf(b, vals).level;
      const row = rows.find(r => r.label === level);
      const m = /^(\d+)(?: – (\d+))?$/.exec(row.range);
      if (m) assert.ok(t >= +m[1] && t <= +(m[2] || m[1]), `${key} total ${t} level ${level} range ${row.range}`);
      else assert.ok(/^ต่ำกว่า (\d+)$/.test(row.range) && t < +/(\d+)/.exec(row.range)[1], `${key} ${t} ${row.range}`);
    }
  }
});

test('levelRanges: average mode shows 2 decimals; pass/fail levels', () => {
  const r = levelRanges({ levels: lv('act'), criteriaCount: 6, maxScore: 4, useAverage: true });
  assert.strictEqual(r[0].range, '3.50 – 4.00');
  assert.ok(r.every(x => /\d\.\d\d/.test(x.range)));
  assert.strictEqual(r[r.length - 1].range, 'ต่ำกว่า 1.50');
  const p = levelRanges({ levels: lv('comp'), criteriaCount: 2, maxScore: 3, useAverage: false });
  assert.strictEqual(p[0].range, '6');
  assert.deepStrictEqual(p.map(x => x.label), ['ดีเยี่ยม', 'ดี', 'ผ่าน', 'ไม่ผ่าน']);
});

function fakeRubric(key, names) {
  const b = BUILTINS.find(x => x.key === key);
  const rec = {
    id: 2, kind: 'RUBRIC', name: 'กิจกรรมทดลอง', templateName: b.name, dateText: '24 มิ.ย. 69',
    criteria: b.criteria, maxScore: b.maxScore, useAverage: !!b.useAverage, levels: b.levels,
    class: { id: 1, className: 'ป.5/1' }, subject: { id: 1, subjectName: 'วิทยาศาสตร์' }, teacherName: 'ครูสมศรี ใจดี',
  };
  rec.students = names.map((name, i) => {
    const values = fullValues(rec); if (i === 1) values[0] = 1;
    return { id: i + 1, studentNumber: i + 1, name, values, ...scoreOf(rec, values) };
  });
  return rec;
}
const fakeNote = () => ({
  id: 1, kind: 'NOTE', name: 'การสังเคราะห์แสง', templateName: 'แบบบันทึกผลหลังการสอน', dateText: '20 มิ.ย. 69',
  header: { planNo: '3', unitNo: '2', unitName: 'พืชรอบตัว' }, class: { id: 1, className: 'ป.5/1' }, subject: { id: 1, subjectName: 'วิทยาศาสตร์' },
  note: { pct: 85, outcome: 'อธิบายได้', problems: ['นักเรียนบางคนคุยกัน'], fixes: ['ตักเตือน', 'ซ่อมเสริม'], extra: 'ติดตามต่อ' },
  criteria: [], students: [], teacherName: null,
});

async function xmlOf(buf) {
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml').async('string');
}

test('buildDocx: NOTE + RUBRIC records produce a valid docx with Thai content', async () => {
  const settings = { ...DEFAULT_SETTINGS, teacherName: 'ครูสมชาย', signers: [{ role: 'ผู้อำนวยการโรงเรียน', name: 'นายใหญ่ ใจกว้าง' }] };
  const buf = await buildDocx({
    records: [fakeNote(), fakeRubric('behav', ['ด.ช.ก้อง สุข', 'ด.ญ.ใบเตย ดี']), fakeRubric('act', ['ด.ช.ตัวอย่าง'])],
    settings, teacherNameFor: (r) => r.teacherName || settings.teacherName,
  });
  assert.strictEqual(buf.slice(0, 2).toString(), 'PK');
  const xml = await xmlOf(buf);
  for (const s of ['แบบบันทึกผลหลังการสอน', 'ผลการเรียนรู้', 'ข้อเสนอแนะ แนวทางแก้ไข', 'ครูสมชาย', 'นายใหญ่ ใจกว้าง', 'ผู้อำนวยการโรงเรียน',
    'แบบประเมินพฤติกรรมการทำงานรายบุคคล', 'ด.ญ.ใบเตย ดี', 'ระดับคุณภาพ', 'ช่วงคะแนน', '14 – 15', 'ครูสมศรี ใจดี', '✓', 'TH SarabunPSK', 'เฉลี่ย']) {
    assert.ok(xml.includes(s), `missing ${s}`);
  }
  assert.ok(/w:cs="TH SarabunPSK"/.test(xml) || /TH SarabunPSK/.test(await (await JSZip.loadAsync(buf)).file('word/styles.xml').async('string')));
  assert.ok(xml.includes('w:pgSz'));
  assert.strictEqual((xml.match(/<w:sectPr/g) || []).length, 3);
});

test('buildDocx: many criteria switches to landscape and still builds', async () => {
  const rec = fakeRubric('act', ['ด.ช.ก']); // 6 x 4 = 24 sub-columns
  const xml = await xmlOf(await buildDocx({ records: [rec], settings: DEFAULT_SETTINGS }));
  assert.ok(/w:orient="landscape"/.test(xml));
});

// ----- v2: class questions and response types -----
const LV_PF = [{ min: 0.66, label: 'ผ่านเกณฑ์' }, { min: 0, label: 'ต้องซ่อม' }];
const CRIT3 = [{ label: 'ตั้งใจเรียน', short: 'ตั้งใจ' }, { label: 'ส่งงานครบ', short: 'ส่งงาน' }, { label: 'ร่วมกิจกรรม', short: 'ร่วม' }];
const FIELDS = [
  { key: 'f1', label: 'จำนวนนักเรียนที่มาเรียน', type: 'number' },
  { key: 'f2', label: 'บรรยากาศในชั้นเรียน', type: 'longtext' },
  { key: 'f3', label: 'สื่อที่ใช้', type: 'checklist', options: ['ใบงาน', 'วิดีโอ', 'ของจริง'] },
  { key: 'f4', label: 'ผู้สังเกตการณ์', type: 'text' },
  { key: 'f5', label: 'ระดับความพึงพอใจ', type: 'choice', options: ['มาก', 'น้อย'] },
];
const base = (o) => ({
  id: 9, name: 'กิจกรรมเสริม', templateName: 'แบบทดสอบ', dateText: '1 ก.ค. 69', criteria: [], levels: [], maxScore: 0, useAverage: false,
  class: { id: 1, className: 'ป.5/1' }, subject: { id: 1, subjectName: 'วิทยาศาสตร์' }, teacherName: 'ครูสมศรี ใจดี',
  classFields: [], classAnswers: {}, students: [], ...o,
});
function withStudents(rec, valueSets) {
  rec.students = valueSets.map((values, i) => ({ id: i + 1, studentNumber: i + 1, name: `ด.ช.นักเรียน${i + 1}`, values, ...scoreOf(rec, values) }));
  return rec;
}
const fakeClass = () => base({
  kind: 'CLASS', templateName: 'แบบบันทึกกิจกรรมระดับห้อง', responseType: 'SCORE', classFields: FIELDS,
  classAnswers: { f1: 28, f2: 'บรรยากาศดี\nเด็กสนใจมาก', f3: ['ใบงาน', 'ของจริง'] },
});
const fakePassFail = (extra = {}) => withStudents(base({
  kind: 'RUBRIC', responseType: 'PASSFAIL', criteria: CRIT3, maxScore: 2, levels: LV_PF, ...extra,
}), [[2, 2, 2], [2, 1, 1], [1, 1, 1]]);
const fakeCheck = (extra = {}) => withStudents(base({
  kind: 'RUBRIC', responseType: 'CHECK', criteria: CRIT3, maxScore: 1, levels: [], ...extra,
}), [[1, 1, 1], [1, 0, 1]]);
const fakeText = (extra = {}) => withStudents(base({
  kind: 'RUBRIC', responseType: 'TEXT', criteria: CRIT3, maxScore: 0, levels: [], ...extra,
}), [['อธิบายได้ดี', 'ครบ', ''], ['ต้องช่วยเหลือ', '', 'ร่วมน้อย']]);

const build = async (records) => xmlOf(await buildDocx({ records, settings: DEFAULT_SETTINGS }));

test('levelRanges: PASSFAIL/CHECK use criteria x 1 points', () => {
  const r = levelRanges({ levels: LV_PF, criteriaCount: 3, maxScore: 1, useAverage: false });
  assert.deepStrictEqual(r.map(x => x.range), ['2 – 3', 'ต่ำกว่า 2']);
});

test('buildDocx: CLASS record prints questions, checklist ☑/☐, "-" for empty, signature', async () => {
  const xml = await build([fakeClass()]);
  for (const s of ['แบบบันทึกกิจกรรมระดับห้อง', 'เรื่อง กิจกรรมเสริม', 'วันที่ 1 ก.ค. 69', 'ระดับชั้น ป.5/1', 'วิชา วิทยาศาสตร์',
    'จำนวนนักเรียนที่มาเรียน', '28', 'บรรยากาศดี', 'เด็กสนใจมาก', 'สื่อที่ใช้', '☑', '☐', 'ใบงาน', 'วิดีโอ', 'ของจริง',
    'ผู้สังเกตการณ์', 'ลงชื่อ.................ผู้บันทึก', '(ครูสมศรี ใจดี)']) {
    assert.ok(xml.includes(s), `missing ${s}`);
  }
  assert.strictEqual((xml.match(/☑/g) || []).length, 2);
  assert.strictEqual((xml.match(/☐/g) || []).length, 1);
  assert.ok(xml.includes('<w:br/>'), 'longtext keeps line breaks');
  assert.ok(xml.includes('>-<'), 'empty answers print -');
  assert.ok(!xml.includes('<w:tbl>'), 'no student table for CLASS');
  assert.ok(!xml.includes('ผู้ประเมิน'));
});

test('buildDocx: RUBRIC with class questions puts them before the student table', async () => {
  const rec = fakePassFail({ classFields: FIELDS, classAnswers: { f1: 28, f3: ['วิดีโอ'] } });
  const xml = await build([rec]);
  assert.ok(xml.indexOf('จำนวนนักเรียนที่มาเรียน') > -1 && xml.indexOf('จำนวนนักเรียนที่มาเรียน') < xml.indexOf('<w:tbl>'));
  assert.ok(xml.indexOf('☑') < xml.indexOf('<w:tbl>'));
});

test('buildDocx: PASSFAIL has ผ่าน/ไม่ผ่าน sub-columns, ✓, รวม, level column and range table', async () => {
  const xml = await build([fakePassFail()]);
  for (const s of ['ผ่าน', 'ไม่ผ่าน', '✓', 'รวม', 'ระดับคุณภาพ', 'ผ่านเกณฑ์', 'ต้องซ่อม', 'ช่วงคะแนน', '2 – 3', 'ต่ำกว่า 2', 'ผู้ประเมิน']) {
    assert.ok(xml.includes(s), `missing ${s}`);
  }
  assert.ok(!xml.includes('เฉลี่ย'));
  assert.strictEqual((xml.match(/✓/g) || []).length, 9, 'one ✓ per criterion per student');
  assert.ok(/w:gridSpan w:val="2"/.test(xml));
});

test('buildDocx: PASSFAIL without levels drops ระดับคุณภาพ and the range table', async () => {
  const xml = await build([fakePassFail({ levels: [] })]);
  assert.ok(xml.includes('รวม') && !xml.includes('ระดับคุณภาพ') && !xml.includes('ช่วงคะแนน'));
});

test('buildDocx: CHECK has one ✓ column per criterion and รวม', async () => {
  const xml = await build([fakeCheck()]);
  assert.ok(xml.includes('ตั้งใจเรียน') || xml.includes('ตั้งใจ'));
  assert.ok(xml.includes('รวม'));
  assert.strictEqual((xml.match(/✓/g) || []).length, 5);
  assert.ok(!xml.includes('ไม่ผ่าน') && !xml.includes('ระดับคุณภาพ') && !/w:gridSpan/.test(xml));
  const withLv = await build([fakeCheck({ levels: LV_PF })]);
  assert.ok(withLv.includes('ระดับคุณภาพ') && withLv.includes('ต่ำกว่า 2'));
});

test('buildDocx: TEXT prints the typed text, no รวม / ระดับคุณภาพ / range table', async () => {
  const xml = await build([fakeText({ levels: LV_PF })]);
  for (const s of ['อธิบายได้ดี', 'ต้องช่วยเหลือ', 'ร่วมน้อย', 'ด.ช.นักเรียน2', 'ผู้ประเมิน']) assert.ok(xml.includes(s), `missing ${s}`);
  for (const s of ['ระดับคุณภาพ', 'รวม', 'ช่วงคะแนน', '✓']) assert.ok(!xml.includes(s), `unexpected ${s}`);
});

test('buildDocx: landscape follows column count for each type', async () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ label: `ข้อ ${i + 1}`, short: `ข้อ ${i + 1}` }));
  const orient = async (rec) => /w:orient="landscape"/.test(await build([rec]));
  assert.strictEqual(await orient(fakePassFail()), false);
  assert.strictEqual(await orient(fakePassFail({ criteria: many })), true);
  assert.strictEqual(await orient(fakeCheck()), false);
  assert.strictEqual(await orient(fakeCheck({ criteria: Array.from({ length: 9 }, (_, i) => ({ label: `ข้อ ${i}`, short: `ข้อ ${i}` })) })), true);
  assert.strictEqual(await orient(fakeText()), false);
  assert.strictEqual(await orient(fakeText({ criteria: [...CRIT3, ...many.slice(0, 2)] })), true);
  assert.strictEqual(await orient(fakeClass()), false);
});

// ----- controller (stubbed prisma/recordDetail; no real database) -----
const path = require('node:path');
const stub = (rel, exports) => { const p = require.resolve(path.join('..', rel)); require.cache[p] = { id: p, filename: p, loaded: true, exports }; };
const resp = () => { const r = { headers: {}, code: 200 }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; }; r.send = (b) => { r.sent = b; return r; }; return r; };

test('export controller: validation, 404, headers, settings merge', async () => {
  const store = { tenant: { id: 'g1', docSettings: null } };
  stub('config/database.js', { tenant: {
    findUnique: async () => store.tenant,
    update: async ({ data }) => { store.tenant = { ...store.tenant, ...data }; return store.tenant; },
  } });
  const recs = { 1: fakeNote(), 2: fakeRubric('behav', ['ด.ช.ก้อง']) };
  recs[1].assessedOn = '2026-06-20'; recs[2].assessedOn = '2026-06-10';
  stub('services/assessmentRecords.js', { recordDetail: async (id) => recs[id] || null });
  delete require.cache[require.resolve('../controllers/assessmentExportController')];
  const X = require('../controllers/assessmentExportController');
  const user = { tid: 'g1', teacher: { name: 'ครูเอ' }, displayName: 'x' };

  let r = resp(); await X.getSettings({ user }, r);
  assert.deepStrictEqual(r.body.signers, DEFAULT_SETTINGS.signers);
  assert.strictEqual(r.body.teacherName, 'ครูเอ');

  r = resp(); await X.updateSettings({ user, body: { schoolName: 'โรงเรียนทดสอบ', signers: [{ role: 'ผอ.', name: 'นาย ก' }] } }, r);
  assert.strictEqual(r.body.schoolName, 'โรงเรียนทดสอบ'); assert.strictEqual(r.body.signers.length, 1);
  r = resp(); await X.updateSettings({ user, body: { schoolName: 'x'.repeat(201), signers: [] } }, r); assert.strictEqual(r.code, 400);
  r = resp(); await X.updateSettings({ user, body: { signers: Array(7).fill({ role: 'a', name: 'b' }) } }, r); assert.strictEqual(r.code, 400);

  for (const ids of [undefined, '', 'a,b', '1,-2', Array.from({ length: 61 }, (_, i) => i + 1).join(',')]) {
    r = resp(); await X.exportDocx({ user, query: { ids } }, r); assert.strictEqual(r.code, 400, String(ids));
  }
  r = resp(); await X.exportDocx({ user, query: { ids: '1,99' } }, r); assert.strictEqual(r.code, 404);

  r = resp(); await X.exportDocx({ user, query: { ids: '1,2' } }, r);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.headers['Content-Type'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  assert.ok(r.headers['Content-Disposition'].includes(`filename*=UTF-8''${encodeURIComponent('บันทึกหลังแผน-ป.5/1.docx')}`));
  assert.ok(r.headers['Content-Disposition'].startsWith('attachment; filename="lesson-log.docx"'));
  const xml = await xmlOf(r.sent);
  assert.ok(xml.indexOf('แบบประเมินพฤติกรรม') < xml.indexOf('ผลการเรียนรู้'), 'sorted by assessedOn');
  assert.ok(xml.includes('โรงเรียนทดสอบ') || xml.includes('ครูเอ'));
});
