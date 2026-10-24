// บันทึกหลังแผน: client-side mirror of backend/services/assessmentCore.js so screens recompute instantly.
// The server stays the source of truth (it recomputes on save).

export const KIND_LABEL = { NOTE: 'บันทึกหลังสอน', RUBRIC: 'ประเมินรายคน' };

// Short names for filter chips and list rows, by built-in template key.
export const SHORT_NAME = {
  note: 'บันทึกหลังสอน', behav: 'พฤติกรรมการทำงาน', act: 'ปฏิบัติกิจกรรม',
  work: 'ชิ้นงาน/ภาระงาน', trait: 'คุณลักษณะฯ', comp: 'สมรรถนะ'
};
export const shortName = (t) => SHORT_NAME[t.key] || t.name || t.templateName || '';

export const STATUS_LABEL = { DRAFT: 'ยังไม่เสร็จ', DONE: 'บันทึกแล้ว' };

export const PROBLEM_SUGGESTIONS = ['นักเรียนบางคนคุยกันระหว่างทำกิจกรรม', 'บางกลุ่มไม่ช่วยกันทำงาน', 'เวลาไม่พอทำกิจกรรมครบ', 'นักเรียนบางคนยังทำไม่ได้'];
export const FIX_SUGGESTIONS = ['ตักเตือนและอธิบายเหตุผลของการทำงานกลุ่ม', 'ให้ทำกิจกรรมเพิ่มเติม', 'จับคู่เพื่อนช่วยเพื่อน', 'สอนซ่อมเสริมนอกเวลา'];

// Per-student answer types (see backend assessmentCore): SCORE 1..max · PASSFAIL 2/1 · CHECK 1/0 · TEXT string.
export const RESPONSE_TYPES = [
  { id: 'SCORE', label: 'ให้คะแนน 1–N' },
  { id: 'PASSFAIL', label: 'ผ่าน / ไม่ผ่าน' },
  { id: 'CHECK', label: 'เช็ก ✓' },
  { id: 'TEXT', label: 'เขียนสั้นๆ' }
];
// Class-level question types.
export const FIELD_TYPES = [
  { id: 'text', label: 'ข้อความสั้น' },
  { id: 'longtext', label: 'ข้อความยาว' },
  { id: 'number', label: 'ตัวเลข' },
  { id: 'choice', label: 'เลือก 1 ข้อ' },
  { id: 'checklist', label: 'เลือกได้หลายข้อ' }
];
// How the form is done: class only / students only / class + students.
export const scopeOf = (t) => (t.kind === 'NOTE' || t.kind === 'CLASS' ? 'CLASS'
  : (t.classFields || []).length ? 'BOTH' : 'STUDENT');
export const SCOPE_LABEL = { CLASS: 'ระดับห้อง', STUDENT: 'รายนักเรียน', BOTH: 'ระดับห้อง + รายนักเรียน' };

export const responseOf = (r) => (RESPONSE_TYPES.some(x => x.id === r.responseType) ? r.responseType : 'SCORE');

export const total = (values) => (values || []).reduce((a, b) => a + (Number(b) || 0), 0);

function points(record, values) {
  const t = responseOf(record);
  const n = (record.criteria || []).length;
  if (t === 'TEXT') return { got: 0, max: 0 };
  const got = (values || []).reduce((a, v) => a + (Number(v) || 0) - (t === 'PASSFAIL' ? 1 : 0), 0);
  return { got, max: n * (t === 'SCORE' ? record.maxScore : 1) };
}

// { total, average, level } — same rule as the server. PASSFAIL/CHECK count ผ่าน/✓; TEXT has no score.
export function scoreOf(record, values) {
  const n = (record.criteria || []).length;
  const { got, max } = points(record, values);
  const ratio = max ? got / max : 0;
  const levels = record.levels || [];
  const hit = max ? (levels.find(l => ratio >= Number(l.min) - 1e-9) || levels[levels.length - 1]) : null;
  return { total: got, average: n ? Math.round((got / n) * 100) / 100 : 0, level: hit ? hit.label : '' };
}

// Most points one student can get (for "12/15").
export const maxPoints = (record) => {
  const t = responseOf(record);
  const n = (record.criteria || []).length;
  return t === 'TEXT' ? 0 : n * (t === 'SCORE' ? record.maxScore : 1);
};

// Weak levels get the warning colour.
export const isWeakLevel = (label) => /ปรับปรุง|ไม่ผ่าน/.test(label || '');

// Tone of one answer cell: best / worst / in between.
export function toneOf(record, v) {
  const t = responseOf(record);
  if (t === 'PASSFAIL') return v === 2 ? 'hi' : 'lo';
  if (t === 'CHECK') return v === 1 ? 'hi' : 'lo';
  return v === record.maxScore ? 'hi' : v === 1 ? 'lo' : 'mid';
}

// Next value when an answer cell is tapped: SCORE max -> ... -> 1 -> max · PASSFAIL/CHECK toggle.
export function cycleDown(record, v) {
  const t = responseOf(record);
  if (t === 'PASSFAIL') return v === 2 ? 1 : 2;
  if (t === 'CHECK') return v === 1 ? 0 : 1;
  return v <= 1 ? record.maxScore : v - 1;
}

// What to print in a cell: "3" / "ผ่าน" / "✓" / text.
export function answerText(record, v) {
  const t = responseOf(record);
  if (t === 'PASSFAIL') return v === 2 ? 'ผ่าน' : 'ไม่ผ่าน';
  if (t === 'CHECK') return v === 1 ? '✓' : '–';
  return v == null ? '' : String(v);
}

// "นักเรียนได้เรียนรู้เกี่ยวกับ<name> โดยนักเรียนร้อยละ <pct> สามารถ<outcome>" as printed on the form.
export const outcomeSentence = (name, note) =>
  `นักเรียนได้เรียนรู้เกี่ยวกับ${name || ''} โดยนักเรียนร้อยละ ${note?.pct ?? 0} สามารถ${note?.outcome || '…'}`;

// Today's date written the Thai-school way, e.g. "24 มิ.ย. 69".
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export function thaiShortDate(d = new Date()) {
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`;
}
