const xlsx = require('xlsx');
const { decodeText } = require('../controllers/importController');
const ai = require('./aiProvider');
const synonyms = {
  studentCode: ['เลขประจำตัว','เลขประจำตัวนักเรียน','เลขประจำตัวผู้เรียน','รหัส','รหัสนักเรียน','studentcode','studentid','id','code'],
  studentNumber: ['เลขที่','ลำดับ','ลำดับที่','no','number','studentnumber'],
  prefix: ['คำนำหน้า','คำนำหน้าชื่อ','prefix','title'], firstName: ['ชื่อ','firstname'],
  lastName: ['นามสกุล','สกุล','lastname','surname'], fullName: ['ชื่อสกุล','ชื่อนามสกุล','ชื่อนักเรียน','name','fullname','studentname'],
  className: ['ห้อง','ห้องเรียน','class','classname','ชั้นห้อง'], grade: ['ชั้น','ระดับชั้น','grade'], room: ['ห้องที่','room']
};
const fields = Object.keys(synonyms);
const clean = v => String(v ?? '').trim();
const normalizeHeader = s => clean(s).toLowerCase().replace(/[\s.\-_/()]/g, '');
const known = s => fields.find(f => synonyms[f].includes(normalizeHeader(s)));
const prefixRE = /^(เด็กชาย|เด็กหญิง|นางสาว|ด\.ช\.|ด\.ญ\.|น\.ส\.|นาย|นาง)/;
function readTable(file) {
  let raw, sheetName = '';
  if (/\.csv$/i.test(file.originalname || '') || file.mimetype === 'text/csv') {
    const text = decodeText(file.buffer); raw = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
      else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
        row.push(cell); cell = '';
        if (c !== ',') { raw.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; }
      } else cell += c;
    }
    row.push(cell); raw.push(row);
  } else {
    const book = xlsx.read(file.buffer, { type: 'buffer' }); sheetName = book.SheetNames[0];
    raw = xlsx.utils.sheet_to_json(book.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: true });
  }
  const rows = raw.map((r, i) => { const a = Array.from(r, clean); Object.defineProperty(a, 'fileRow', { value: i + 1 }); return a; }).filter(r => r.some(Boolean));
  return { sheetName, rows };
}
function findHeaderRow(rows) {
  let best = 0, score = 0;
  rows.slice(0, 15).forEach((r, i) => { const n = r.filter(known).length; if (n > score) { best = i; score = n; } }); return best;
}
function normalizeClassName(v, gradeV, roomV) {
  let s = clean(v);
  if (!s) s = [clean(gradeV), clean(roomV)].filter(Boolean).join('/');
  const compact = s.replace(/\s/g, '').replace(/ประถมศึกษาปีที่/g, 'ป.').replace(/มัธยมศึกษาปีที่/g, 'ม.');
  // Room is 1–2 digits so "1/2569" (term/year) never reads as a class.
  const m = compact.match(/^([ปม])\.?([1-6])(?:\/(\d{1,2}))?$/) || compact.match(/^()([1-6])\/(\d{1,2})$/);
  return m ? `${m[1] || 'ป'}.${m[2]}${m[3] ? '/' + Number(m[3]) : ''}` : s;
}
function gradeOf(v) { return normalizeClassName(v).match(/^([ปม]\.[1-6])(?:\/\d+)?$/)?.[1] || null; }
function classFromContext(rows, sheetName) {
  for (const s of [...rows.flat(), sheetName || '']) {
    // A bare "4/1" counts only after ชั้น/ห้อง; titles often carry "ภาคเรียนที่ 1/2569".
    const m = s.match(/(?:ประถมศึกษาปีที่|มัธยมศึกษาปีที่|[ปม]\.?)\s*[1-6]\s*\/\s*\d{1,2}(?!\d)/)
      || s.match(/(?<=(?:ชั้น|ห้อง)\s*)[1-6]\s*\/\s*\d{1,2}(?!\d)/);
    if (m) return normalizeClassName(m[0]);
  } return null;
}
function shapeOf(values) {
  if (!values.length) return 'ว่าง';
  if (values.every(v => /^\d{4,}$/.test(v)) && new Set(values).size === values.length) return 'ตัวเลข 4 หลักขึ้นไป ไม่ซ้ำ';
  if (values.every(v => /^\d+$/.test(v) && +v > 0 && +v <= values.length + 5) && new Set(values).size === values.length) return 'เลขลำดับ 1..N';
  if (values.every(v => prefixRE.test(v) && v.replace(prefixRE, '').trim())) return 'ข้อความไทย ขึ้นต้นด้วยคำนำหน้าชื่อ';
  if (values.every(v => prefixRE.test(v) && !v.replace(prefixRE, '').trim())) return 'คำนำหน้าเท่านั้น';
  if (values.every(v => /^[ปม]\.[1-6]\/\d+$/.test(normalizeClassName(v)))) return 'รูปแบบห้อง เช่น ป.4/1';
  if (values.every(v => /^[ก-๙\s]+$/.test(v))) return 'ข้อความไทย (น่าจะเป็นชื่อ/นามสกุล)';
  return 'อื่นๆ';
}
function columnProfiles(headers, rows) {
  return headers.map((header, index) => { const values = rows.slice(0, 30).map(r => clean(r[index])).filter(Boolean); return { index, header, shape: shapeOf(values), distinct: new Set(values).size }; });
}
function guessMapping(headers, rows) {
  const mapping = Object.fromEntries(fields.map(f => [f, null]));
  headers.forEach((h, i) => { const f = known(h); if (f && mapping[f] === null) mapping[f] = i; });
  const shapes = columnProfiles(headers, rows);
  const infer = { 'ตัวเลข 4 หลักขึ้นไป ไม่ซ้ำ': 'studentCode', 'เลขลำดับ 1..N': 'studentNumber', 'ข้อความไทย ขึ้นต้นด้วยคำนำหน้าชื่อ': 'fullName', 'คำนำหน้าเท่านั้น': 'prefix', 'รูปแบบห้อง เช่น ป.4/1': 'className' };
  shapes.forEach(p => { const f = infer[p.shape]; if (f && mapping[f] === null && !Object.values(mapping).includes(p.index)) mapping[f] = p.index; });
  if (mapping.firstName !== null && mapping.lastName === null) {
    const i = mapping.firstName + 1;
    if (!Object.values(mapping).includes(i) && shapes[i]?.shape === 'ข้อความไทย (น่าจะเป็นชื่อ/นามสกุล)') mapping.lastName = i;
  }
  if (mapping.grade !== null && mapping.className !== null && rows.some(r => clean(r[mapping.className])) && rows.every(r => !clean(r[mapping.className]) || /^\d+$/.test(clean(r[mapping.className])))) {
    mapping.room = mapping.className; mapping.className = null;
  }
  return { mapping, confidence: confidenceOf(mapping) };
}
function confidenceOf(m, defaultClass) { return (m.fullName !== null || m.firstName !== null) && (m.className !== null || (m.grade !== null && m.room !== null) || defaultClass) ? 'high' : 'low'; }
function validateMapping(input, count) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  if (Object.values(input).some(v => v !== null && (!Number.isInteger(v) || v < 0 || v >= count))) return null;
  return Object.fromEntries(fields.map(f => [f, input[f] ?? null]));
}
function buildStudents(rows, mapping, { defaultClass = '', startRow = 2 } = {}) {
  const students = [], issues = [], seen = new Set();
  rows.forEach((r, i) => {
    const row = r.fileRow || startRow + i, get = f => mapping[f] == null ? '' : clean(r[mapping[f]]);
    const name = (get('fullName') || (get('firstName') ? get('prefix') + get('firstName') + ' ' + get('lastName') : '')).replace(/\s+/g, ' ').trim();
    if (!name) { issues.push({ row, message: 'ไม่มีชื่อ' }); return; }
    const className = normalizeClassName(get('className')) || normalizeClassName('', get('grade'), get('room')) || normalizeClassName(defaultClass);
    if (!className) issues.push({ row, message: 'ไม่มีห้อง' });
    const number = get('studentNumber');
    const studentNumber = /^\d+$/.test(number) && +number > 0 && +number <= 2147483647 ? +number : null;
    const codeGenerated = !get('studentCode');
    const studentCode = get('studentCode') || `${className.replace(/[./\s]/g, '')}-${String(studentNumber ?? i + 1).padStart(2, '0')}`;
    if (seen.has(studentCode)) { issues.push({ row, message: 'รหัสซ้ำในไฟล์' }); return; }
    seen.add(studentCode); students.push({ row, studentCode, studentNumber, name, className, codeGenerated });
  }); return { students, issues };
}
async function aiMapping(headers, profiles) {
  // Unknown headers may themselves contain student data (e.g. a headerless file).
  // Only allow recognized header vocabulary and fixed, locally computed shapes out.
  const allowedShapes = new Set(['ว่าง','ตัวเลข 4 หลักขึ้นไป ไม่ซ้ำ','เลขลำดับ 1..N','ข้อความไทย ขึ้นต้นด้วยคำนำหน้าชื่อ','คำนำหน้าเท่านั้น','รูปแบบห้อง เช่น ป.4/1','ข้อความไทย (น่าจะเป็นชื่อ/นามสกุล)','อื่นๆ']);
  const safe = headers.map((h, index) => ({ index, header: known(h) ? normalizeHeader(h) : 'ไม่ทราบ', shape: allowedShapes.has(profiles[index]?.shape) ? profiles[index].shape : 'อื่นๆ', distinct: Number.isInteger(profiles[index]?.distinct) ? profiles[index].distinct : 0 }));
  try {
    const result = await ai.generate({ system: 'จับคู่คอลัมน์รายชื่อนักเรียน ตอบ JSON เท่านั้น', prompt: `ตอบ {"mapping":{${fields.map(f => `"${f}":null`).join(',')}},"notes":"..."} ใช้ index หรือ null\n${JSON.stringify(safe)}`, json: true, maxTokens: 1000 });
    return validateMapping(JSON.parse(result).mapping, headers.length);
  } catch (_) { return null; }
}
async function planImport(students) {
  const prisma = require('../config/database');
  const names = [...new Set(students.map(s => s.className).filter(Boolean))];
  const grades = [...new Set(names.map(gradeOf).filter(Boolean))];
  const [existing, classes, foundGrades, year] = await Promise.all([
    prisma.student.findMany({ where: { studentCode: { in: students.map(s => s.studentCode) } }, select: { studentCode: true } }),
    prisma.class.findMany({ where: { className: { in: names } }, select: { className: true } }),
    prisma.grade.findMany({ where: { gradeName: { in: grades } }, select: { gradeName: true } }),
    prisma.academicYear.findFirst({ where: { isCurrent: true } })
  ]);
  const codes = new Set(existing.map(s => s.studentCode)); const update = students.filter(s => codes.has(s.studentCode)).length;
  return { create: students.length - update, update, newClasses: names.filter(n => !classes.some(c => c.className === n)), newGrades: grades.filter(n => !foundGrades.some(g => g.gradeName === n)), currentYear: year?.year || null };
}
module.exports = { readTable, findHeaderRow, normalizeHeader, guessMapping, classFromContext, normalizeClassName, gradeOf, buildStudents, aiMapping, columnProfiles, validateMapping, confidenceOf, planImport };
