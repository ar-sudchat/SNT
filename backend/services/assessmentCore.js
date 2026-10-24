// บันทึกหลังแผน: shared rules for assessment templates and records.
// Every rubric is criteria x scale (1..maxScore) -> total -> quality level; NOTE templates are text only.
// Pure functions except ensureBuiltins() (needs the tenant-scoped prisma client).

const LV_GOOD = [{ min: 0.93, label: 'ดีมาก' }, { min: 0.73, label: 'ดี' }, { min: 0.53, label: 'พอใช้' }, { min: 0, label: 'ปรับปรุง' }];
const LV_PASS = [{ min: 0.99, label: 'ดีเยี่ยม' }, { min: 0.66, label: 'ดี' }, { min: 0.5, label: 'ผ่าน' }, { min: 0, label: 'ไม่ผ่าน' }];

// Taken from the school's own post-lesson documents (แบบบันทึกหลังแผน). Names stay editable per group.
const BUILTINS = [
  { key: 'note', name: 'แบบบันทึกผลหลังการสอน', kind: 'NOTE', maxScore: 0, criteria: [], levels: [] },
  { key: 'behav', name: 'แบบประเมินพฤติกรรมการทำงานรายบุคคล', kind: 'RUBRIC', maxScore: 3, levels: LV_GOOD, criteria: [
    { label: 'ความมีวินัย', short: 'วินัย' }, { label: 'ความมีน้ำใจเอื้อเฟื้อเสียสละ', short: 'น้ำใจ' },
    { label: 'การแสดงความคิดเห็น', short: 'ความเห็น' }, { label: 'การรับฟังความคิดเห็น', short: 'รับฟัง' },
    { label: 'การร่วมมือทำงานส่วนรวม', short: 'ร่วมมือ' }] },
  { key: 'act', name: 'แบบประเมินปฏิบัติการกิจกรรม', kind: 'RUBRIC', maxScore: 4, useAverage: true,
    levels: [{ min: 0.875, label: 'ดีมาก' }, { min: 0.625, label: 'ดี' }, { min: 0.375, label: 'พอใช้' }, { min: 0, label: 'ปรับปรุง' }],
    criteria: [1, 2, 3, 4, 5, 6].map(n => ({ label: `ตัวชี้วัดที่ ${n}`, short: `ข้อ ${n}` })) },
  { key: 'work', name: 'แบบประเมินชิ้นงาน/ภาระงาน', kind: 'RUBRIC', maxScore: 3, levels: LV_GOOD, criteria: [
    { label: 'ความถูกต้องของเนื้อหา', short: 'ถูกต้อง' }, { label: 'ความครบถ้วน', short: 'ครบ' },
    { label: 'ความเป็นระเบียบ', short: 'ระเบียบ' }, { label: 'ความคิดสร้างสรรค์', short: 'สร้างสรรค์' },
    { label: 'ส่งงานตรงเวลา', short: 'ตรงเวลา', source: 'scan' }] },
  { key: 'trait', name: 'แบบประเมินคุณลักษณะอันพึงประสงค์', kind: 'RUBRIC', maxScore: 3, levels: LV_PASS, criteria: [
    { label: 'มีวินัย', short: 'วินัย' }, { label: 'ใฝ่เรียนรู้', short: 'ใฝ่เรียนรู้' }, { label: 'มุ่งมั่นในการทำงาน', short: 'มุ่งมั่น' }] },
  { key: 'comp', name: 'แบบสังเกตสมรรถนะสำคัญของผู้เรียน', kind: 'RUBRIC', maxScore: 3, levels: LV_PASS, criteria: [
    { label: 'ความสามารถในการสื่อสาร', short: 'สื่อสาร' }, { label: 'ความสามารถในการคิด', short: 'การคิด' }] },
];

const PROBLEM_SUGGESTIONS = ['นักเรียนบางคนคุยกันระหว่างทำกิจกรรม', 'บางกลุ่มไม่ช่วยกันทำงาน', 'เวลาไม่พอทำกิจกรรมครบ', 'นักเรียนบางคนยังทำไม่ได้'];
const FIX_SUGGESTIONS = ['ตักเตือนและอธิบายเหตุผลของการทำงานกลุ่ม', 'ให้ทำกิจกรรมเพิ่มเติม', 'จับคู่เพื่อนช่วยเพื่อน', 'สอนซ่อมเสริมนอกเวลา'];

const DEFAULT_SETTINGS = {
  schoolName: '',
  signers: [
    { role: 'หัวหน้างานวิชาการ', name: '' },
    { role: 'รองผู้อำนวยการฝ่ายบริหารงานวิชาการ', name: '' },
    { role: 'ผู้อำนวยการโรงเรียน', name: '' },
  ],
};

// Per-student answer types. Stored value per criterion:
// SCORE 1..maxScore · PASSFAIL 2 = ผ่าน, 1 = ไม่ผ่าน · CHECK 1 = ✓, 0 = blank · TEXT short string.
const RESPONSE_TYPES = ['SCORE', 'PASSFAIL', 'CHECK', 'TEXT'];
// Class-level question types (answered once per record).
const FIELD_TYPES = ['text', 'longtext', 'number', 'choice', 'checklist'];

const responseOf = (r) => (RESPONSE_TYPES.includes(r.responseType) ? r.responseType : 'SCORE');

// Default answer per criterion: full marks / ผ่าน / ✓ / empty text (teacher taps down the exceptions).
function fullValues(record) {
  const t = responseOf(record);
  const v = t === 'SCORE' ? record.maxScore : t === 'PASSFAIL' ? 2 : t === 'CHECK' ? 1 : '';
  return (record.criteria || []).map(() => v);
}

// Points and the most points possible for one student's values.
function points(record, values) {
  const t = responseOf(record);
  const n = (record.criteria || []).length;
  if (t === 'TEXT') return { got: 0, max: 0 };
  const got = (values || []).reduce((a, v) => a + (Number(v) || 0) - (t === 'PASSFAIL' ? 1 : 0), 0);
  return { got, max: n * (t === 'SCORE' ? record.maxScore : 1) };
}

const total = (values) => (values || []).reduce((a, b) => a + (Number(b) || 0), 0);

// { total, average, level } for one student's values against a record (or template) snapshot.
// PASSFAIL/CHECK totals count ผ่าน/✓; TEXT has no score.
function scoreOf(record, values) {
  const n = (record.criteria || []).length;
  const { got, max } = points(record, values);
  const ratio = max ? got / max : 0;
  const levels = record.levels || [];
  const hit = max ? (levels.find(l => ratio >= Number(l.min) - 1e-9) || levels[levels.length - 1]) : null;
  return { total: got, average: n ? Math.round((got / n) * 100) / 100 : 0, level: hit ? hit.label : '' };
}

// One valid answer per criterion for the record's response type.
function validValues(record, values) {
  if (!Array.isArray(values) || values.length !== (record.criteria || []).length) return false;
  const t = responseOf(record);
  if (t === 'TEXT') return values.every(v => typeof v === 'string' && v.length <= 200);
  const lo = t === 'CHECK' ? 0 : 1;
  const hi = t === 'SCORE' ? record.maxScore : t === 'PASSFAIL' ? 2 : 1;
  return values.every(v => Number.isInteger(v) && v >= lo && v <= hi);
}

const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

// Normalize template input from a teacher. Returns { value } or { error } (Thai message).
function cleanTemplateInput(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = clip(body.name, 120);
    if (!out.name) return { error: 'ตั้งชื่อแบบประเมินก่อน' };
  }
  if (!partial || body.kind !== undefined) {
    out.kind = ['NOTE', 'CLASS'].includes(body.kind) ? body.kind : 'RUBRIC';
  }
  const kind = out.kind || body.kind || 'RUBRIC';
  if (!partial || body.responseType !== undefined) {
    out.responseType = RESPONSE_TYPES.includes(body.responseType) ? body.responseType : 'SCORE';
  }
  const rt = out.responseType || body.responseType || 'SCORE';
  if (!partial || body.classFields !== undefined) {
    const r = cleanClassFields(body.classFields);
    if (r.error) return r;
    out.classFields = r.value;
    if (kind === 'CLASS' && !out.classFields.length) return { error: 'เพิ่มคำถามระดับห้องอย่างน้อย 1 ข้อ' };
  }
  if (!partial || body.maxScore !== undefined) {
    const m = Number(body.maxScore);
    const scored = kind === 'RUBRIC' && rt === 'SCORE';
    if (scored && (!Number.isInteger(m) || m < 2 || m > 10)) return { error: 'ระดับคะแนนต้องเป็น 2–10' };
    out.maxScore = scored ? m : kind === 'RUBRIC' && rt === 'PASSFAIL' ? 2 : kind === 'RUBRIC' && rt === 'CHECK' ? 1 : 0;
  }
  if (!partial || body.useAverage !== undefined) out.useAverage = !!body.useAverage;
  if (!partial || body.criteria !== undefined) {
    const list = Array.isArray(body.criteria) ? body.criteria : [];
    out.criteria = list.slice(0, 20).map(c => ({
      label: clip(c && c.label, 120),
      short: clip((c && c.short) || (c && c.label), 16),
      ...(c && c.source === 'scan' ? { source: 'scan' } : {}),
    })).filter(c => c.label);
    if (kind === 'RUBRIC' && !out.criteria.length) return { error: 'เพิ่มรายการประเมินอย่างน้อย 1 รายการ' };
  }
  if (!partial || body.levels !== undefined) {
    const list = Array.isArray(body.levels) ? body.levels : [];
    out.levels = list.slice(0, 8)
      .map(l => ({ min: Math.max(0, Math.min(1, Number(l && l.min) || 0)), label: clip(l && l.label, 40) }))
      .filter(l => l.label)
      .sort((a, b) => b.min - a.min);
    // Levels are required for scores; optional for ผ่าน/ไม่ผ่าน and ✓; ignored for text and class-only forms.
    if (kind === 'RUBRIC' && rt === 'SCORE' && !out.levels.length) return { error: 'กำหนดระดับคุณภาพอย่างน้อย 1 ระดับ' };
    if (out.levels.length && out.levels[out.levels.length - 1].min !== 0) out.levels[out.levels.length - 1].min = 0;
  }
  return { value: out };
}

// Class-level questions from the template builder. Keys are stable ids for answers ("f1", "f2", …).
function cleanClassFields(list) {
  if (list === undefined || list === null) return { value: [] };
  if (!Array.isArray(list)) return { error: 'คำถามระดับห้องไม่ถูกต้อง' };
  const used = new Set();
  const value = list.slice(0, 20).map((f, i) => {
    const type = FIELD_TYPES.includes(f && f.type) ? f.type : 'text';
    let key = clip(f && f.key, 20).replace(/[^a-zA-Z0-9_-]/g, '') || `f${i + 1}`;
    while (used.has(key)) key = `${key}_${i + 1}`;
    used.add(key);
    const field = { key, label: clip(f && f.label, 120), type };
    if (type === 'choice' || type === 'checklist') {
      field.options = [...new Set((Array.isArray(f.options) ? f.options : []).map(o => clip(o, 60)).filter(Boolean))].slice(0, 20);
    }
    return field;
  }).filter(f => f.label);
  const noOptions = value.find(f => (f.type === 'choice' || f.type === 'checklist') && !f.options.length);
  if (noOptions) return { error: `ใส่ตัวเลือกให้คำถาม "${noOptions.label}"` };
  return { value };
}

// Answers to a record's class questions, keyed by field key. Unknown keys dropped, values clipped/validated.
function cleanClassAnswers(record, answers) {
  const src = answers && typeof answers === 'object' && !Array.isArray(answers) ? answers : {};
  const out = {};
  for (const f of record.classFields || []) {
    const v = src[f.key];
    if (v === undefined || v === null || v === '') continue;
    if (f.type === 'text') out[f.key] = clip(v, 500);
    else if (f.type === 'longtext') out[f.key] = clip(v, 3000);
    else if (f.type === 'number') { const n = Number(v); if (Number.isFinite(n)) out[f.key] = n; }
    else if (f.type === 'choice') { if ((f.options || []).includes(v)) out[f.key] = v; }
    else if (f.type === 'checklist' && Array.isArray(v)) out[f.key] = v.filter(o => (f.options || []).includes(o));
  }
  return out;
}

// Seed the six built-ins for the current group once (idempotent; safe under concurrent first requests).
async function ensureBuiltins(prisma) {
  const have = await prisma.assessmentTemplate.findMany({ where: { isBuiltIn: true }, select: { key: true } });
  const keys = new Set(have.map(t => t.key));
  for (const b of BUILTINS) {
    if (keys.has(b.key)) continue;
    try {
      await prisma.assessmentTemplate.create({ data: { ...b, useAverage: !!b.useAverage, isBuiltIn: true } });
    } catch (e) {
      if (e.code !== 'P2002') throw e; // another request seeded it first
    }
  }
}

module.exports = {
  BUILTINS, PROBLEM_SUGGESTIONS, FIX_SUGGESTIONS, DEFAULT_SETTINGS, RESPONSE_TYPES, FIELD_TYPES,
  fullValues, total, points, scoreOf, validValues, cleanTemplateInput, cleanClassFields, cleanClassAnswers, ensureBuiltins, clip, responseOf,
};
