import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';
import WindowModal from '../../components/ui/WindowModal';
import { RESPONSE_TYPES, FIELD_TYPES, SCOPE_LABEL, scopeOf, responseOf } from './lessonLogCore';

// จัดการแบบประเมินของบันทึกหลังแผน + ข้อมูลที่พิมพ์ลงไฟล์ Word (ชื่อโรงเรียน/ผู้ลงนาม)

const MAX_CRITERIA = 20;
const MAX_LEVELS = 8;
const MAX_SIGNERS = 6;
const MAX_CLASS_FIELDS = 20;
const MAX_OPTIONS = 20;

const INPUT = 'w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400';
const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1 min-h-[44px] px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-60';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-1 min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60';
const BTN_ICON = 'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40';
const CHIP = 'inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-gray-300 bg-white text-sm text-gray-800 hover:bg-gray-50';

const errMsg = (err, fallback) => err?.response?.data?.error || fallback;

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

const responseLabel = (id) => (RESPONSE_TYPES.find(r => r.id === id) || RESPONSE_TYPES[0]).label;

// ทำแบบไหน: ระดับห้อง / รายนักเรียน / ทั้งสองอย่าง (NOTE = บันทึกข้อความแบบเดิม)
const SCOPE_OPTIONS = [
  { value: 'CLASS', title: SCOPE_LABEL.CLASS, sub: 'ตอบครั้งเดียวทั้งห้อง เช่น สรุปการสอน ปัญหาที่พบ' },
  { value: 'STUDENT', title: SCOPE_LABEL.STUDENT, sub: 'ให้คะแนนหรือเช็กนักเรียนทีละคน' },
  { value: 'BOTH', title: SCOPE_LABEL.BOTH, sub: 'ตอบทั้งห้องก่อน แล้วประเมินนักเรียนทีละคน' },
];

// ---- ระดับคุณภาพ: ครูกรอกเป็นคะแนนเริ่มต้น แปลงเป็นสัดส่วน (min) ตอนบันทึก ----

const PRESETS = [
  { name: 'ดีมาก / ดี / พอใช้ / ปรับปรุง', labels: ['ดีมาก', 'ดี', 'พอใช้', 'ปรับปรุง'], fractions: [0.9, 0.7, 0.5] },
  { name: 'ดีเยี่ยม / ดี / ผ่าน / ไม่ผ่าน', labels: ['ดีเยี่ยม', 'ดี', 'ผ่าน', 'ไม่ผ่าน'], fractions: [0.8, 0.65, 0.5] },
];

function presetLevels(preset, total) {
  const rows = [];
  let prev = null;
  preset.fractions.forEach((f, i) => {
    let p = Math.round(f * total);
    if (prev !== null) p = Math.min(p, prev - 1);
    rows.push({ _k: nextKey(), label: preset.labels[i], points: String(Math.max(p, 1)) });
    prev = p;
  });
  rows.push({ _k: nextKey(), label: preset.labels[preset.labels.length - 1], points: '0' });
  return rows;
}

// ค่าเริ่มต้นเมื่อเปิด "แบ่งระดับคุณภาพ" ของแบบผ่าน/ไม่ผ่าน และเช็ก ✓
function simpleLevels(total) {
  return [
    { _k: nextKey(), label: 'ผ่าน', points: String(Math.max(1, Math.ceil(total * 0.5))) },
    { _k: nextKey(), label: 'ไม่ผ่าน', points: '0' },
  ];
}

const blankField = () => ({ _k: nextKey(), key: '', label: '', type: 'text', options: [] });

// form.scope: CLASS | STUDENT | BOTH | NOTE
function blankForm() {
  return {
    name: '',
    scope: 'STUDENT',
    isBuiltIn: false,
    responseType: 'SCORE',
    maxScore: 3,
    useAverage: false,
    useLevels: false,
    criteria: [0, 1, 2].map(() => ({ _k: nextKey(), label: '', short: '' })),
    levels: presetLevels(PRESETS[0], 3 * 3),
    classFields: [blankField()],
  };
}

function formFromTemplate(t) {
  const base = { ...blankForm(), name: t.name, isBuiltIn: !!t.isBuiltIn };
  if (t.kind === 'NOTE') return { ...base, scope: 'NOTE', criteria: [], levels: [] };
  const classFields = (t.classFields || []).map(f => ({
    _k: nextKey(), key: f.key || '', label: f.label || '', type: f.type || 'text', options: [...(f.options || [])],
  }));
  if (t.kind === 'CLASS') {
    return { ...base, scope: 'CLASS', criteria: [], levels: [], classFields: classFields.length ? classFields : [blankField()] };
  }
  const rt = responseOf(t);
  const n = (t.criteria || []).length;
  const total = n * (rt === 'SCORE' ? t.maxScore : 1);
  const levels = [...(t.levels || [])].sort((a, b) => b.min - a.min).map(l => ({
    _k: nextKey(), label: l.label, points: String(Math.round(Number(l.min) * total)),
  }));
  return {
    ...base,
    scope: classFields.length ? 'BOTH' : 'STUDENT',
    responseType: rt,
    maxScore: rt === 'SCORE' ? t.maxScore : 3,
    useAverage: rt === 'SCORE' && !!t.useAverage,
    useLevels: rt !== 'SCORE' && rt !== 'TEXT' && levels.length > 0,
    criteria: (t.criteria || []).map(c => ({ ...c, _k: nextKey() })),
    levels,
    classFields: classFields.length ? classFields : [blankField()],
  };
}

const filledCount = (criteria) => criteria.filter(c => c.label.trim()).length;
const hasClassQs = (form) => form.scope === 'CLASS' || form.scope === 'BOTH';
const hasStudents = (form) => form.scope === 'STUDENT' || form.scope === 'BOTH';
const hasChoices = (type) => type === 'choice' || type === 'checklist';
// แบบแบ่งระดับคุณภาพ: ให้คะแนนต้องมีเสมอ · ผ่าน/ไม่ผ่าน และ ✓ เลือกเปิดได้ · เขียนสั้นๆ ไม่มี
const levelsOn = (form) => hasStudents(form) && (form.responseType === 'SCORE'
  || ((form.responseType === 'PASSFAIL' || form.responseType === 'CHECK') && form.useLevels));
// คะแนนเต็มของนักเรียนหนึ่งคน: ให้คะแนน = รายการ × คะแนนเต็ม, ผ่าน/ไม่ผ่านและ ✓ = นับจำนวนรายการที่ผ่าน/ติ๊ก
const totalPoints = (form) => filledCount(form.criteria) * (form.responseType === 'SCORE' ? (Number(form.maxScore) || 0) : 1);

// "14–15 = ดีมาก, 11–13 = ดี, 8–10 = พอใช้, ต่ำกว่า 8 = ปรับปรุง"
function rangesText(levels, total) {
  if (!levels.length || total < 1) return '';
  const head = levels.slice(0, -1).map(l => ({ label: l.label.trim() || '(ยังไม่ตั้งชื่อ)', p: parseInt(l.points, 10) }));
  const last = levels[levels.length - 1];
  const lastLabel = last.label.trim() || '(ยังไม่ตั้งชื่อ)';
  if (head.some(h => !Number.isInteger(h.p))) return '';
  head.sort((a, b) => b.p - a.p);
  const parts = head.map((h, i) => {
    const hi = i === 0 ? total : head[i - 1].p - 1;
    return `${h.p === hi ? h.p : `${h.p}–${hi}`} = ${h.label}`;
  });
  if (head.length) parts.push(`ต่ำกว่า ${head[head.length - 1].p} = ${lastLabel}`);
  else parts.push(`ทุกคะแนน = ${lastLabel}`);
  return parts.join(', ');
}

// คืนข้อความ error ภาษาครู หรือ null ถ้าผ่าน
function validate(form) {
  if (!form.name.trim()) return 'ตั้งชื่อแบบประเมินก่อน';
  if (form.scope === 'NOTE') return null;
  if (hasClassQs(form)) {
    if (!form.classFields.length) return 'เพิ่มคำถามระดับห้องอย่างน้อย 1 ข้อ';
    for (let i = 0; i < form.classFields.length; i++) {
      const f = form.classFields[i];
      if (!f.label.trim()) return `พิมพ์คำถามข้อที่ ${i + 1} หรือเอาข้อนั้นออก`;
      if (hasChoices(f.type) && !f.options.length) return `ใส่ตัวเลือกให้คำถามข้อที่ ${i + 1} อย่างน้อย 1 ตัว`;
    }
  }
  if (!hasStudents(form)) return null;
  const n = filledCount(form.criteria);
  const text = form.responseType === 'TEXT';
  if (!n) return text ? 'เพิ่มหัวข้อที่ให้เขียนอย่างน้อย 1 รายการ' : 'เพิ่มรายการประเมินอย่างน้อย 1 รายการ';
  if (form.responseType === 'SCORE') {
    const max = Number(form.maxScore);
    if (!Number.isInteger(max) || max < 2 || max > 10) return 'ระดับคะแนนต้องเป็น 2–10';
  }
  if (!levelsOn(form)) return null;
  const total = totalPoints(form);
  if (!form.levels.length) return 'กำหนดระดับคุณภาพอย่างน้อย 1 ระดับ';
  if (form.levels.some(l => !l.label.trim())) return 'ตั้งชื่อระดับคุณภาพให้ครบทุกแถว';
  const pts = form.levels.slice(0, -1).map(l => parseInt(l.points, 10));
  const bad = pts.some(p => !Number.isInteger(p) || p < 1 || p > total);
  if (bad) return `คะแนนเริ่มต้นของแต่ละระดับต้องอยู่ระหว่าง 1–${total}`;
  if (new Set(pts).size !== pts.length) return 'คะแนนเริ่มต้นของแต่ละระดับต้องไม่ซ้ำกัน';
  return null;
}

const classFieldsPayload = (form) => form.classFields.map(f => ({
  ...(f.key ? { key: f.key } : {}),
  label: f.label.trim(),
  type: f.type,
  ...(hasChoices(f.type) ? { options: f.options } : {}),
}));

function buildPayload(form, isEdit) {
  const name = form.name.trim();
  if (form.scope === 'NOTE') {
    return isEdit ? { name } : { name, kind: 'NOTE', maxScore: 0, useAverage: false, criteria: [], levels: [] };
  }
  if (form.scope === 'CLASS') {
    const body = { name, classFields: classFieldsPayload(form) };
    return isEdit ? body : { ...body, kind: 'CLASS', maxScore: 0, useAverage: false, criteria: [], levels: [] };
  }
  const criteria = form.criteria
    .filter(c => c.label.trim())
    .map(({ _k, ...c }) => ({ ...c, label: c.label.trim(), short: (c.short || '').trim() || c.label.trim().slice(0, 10) }));
  const rt = form.responseType;
  const max = rt === 'SCORE' ? Number(form.maxScore) : rt === 'PASSFAIL' ? 2 : rt === 'CHECK' ? 1 : 0;
  const total = criteria.length * (rt === 'SCORE' ? max : 1);
  const levels = levelsOn(form)
    ? form.levels.map((l, i) => ({
      label: l.label.trim(),
      min: i === form.levels.length - 1 ? 0 : Math.min(1, Math.max(0, parseInt(l.points, 10) / total)),
    }))
    : [];
  if (form.isBuiltIn) return { name, maxScore: max, useAverage: !!form.useAverage, criteria, levels };
  const body = {
    name, responseType: rt, maxScore: max, useAverage: rt === 'SCORE' && !!form.useAverage, criteria, levels,
    classFields: form.scope === 'BOTH' ? classFieldsPayload(form) : [],
  };
  return isEdit ? body : { ...body, kind: 'RUBRIC' };
}

// ---- ส่วนย่อย ----

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
);

function RadioCard({ checked, onClick, title, sub, small }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`text-left min-h-[44px] rounded-lg border px-3 ${small ? 'py-1.5' : 'py-2'} ${checked
        ? 'border-brand-600 bg-brand-100 ring-1 ring-brand-600' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
    >
      <span className={`block font-medium text-gray-900 ${small ? 'text-sm' : ''}`}>{title}</span>
      <span className="block text-xs text-gray-600">{sub}</span>
    </button>
  );
}

// ตัวเลือกของคำถามเลือก 1 ข้อ / เลือกได้หลายข้อ: ชิป + ช่องเพิ่ม
function OptionsEditor({ options, onChange, index }) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim().slice(0, 60);
    setDraft('');
    if (!v || options.includes(v) || options.length >= MAX_OPTIONS) return;
    onChange([...options, v]);
  };
  return (
    <div className="pl-8 space-y-2">
      <p className="text-xs text-gray-500">ตัวเลือก (ใส่ได้ถึง {MAX_OPTIONS} ตัว)</p>
      {options.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <li key={o} className="inline-flex items-center min-h-[44px] rounded-full border border-gray-300 bg-white pl-3 text-sm text-gray-800">
              <span className="break-words">{o}</span>
              <button
                type="button"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-red-700"
                aria-label={`เอาตัวเลือก ${o} ออก`}
                onClick={() => onChange(options.filter((_, j) => j !== i))}
              >✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <input
          className={INPUT}
          value={draft}
          maxLength={60}
          placeholder="พิมพ์ตัวเลือกแล้วกด เพิ่ม"
          aria-label={`ตัวเลือกใหม่ของคำถามข้อที่ ${index + 1}`}
          disabled={options.length >= MAX_OPTIONS}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
          onBlur={commit}
        />
        <button type="button" className={`${BTN_SECONDARY} shrink-0`} disabled={!draft.trim() || options.length >= MAX_OPTIONS} onClick={commit}>เพิ่ม</button>
      </div>
    </div>
  );
}

function ClassFieldRow({ field, index, count, onChange, onMove, onRemove }) {
  return (
    <li className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-6 shrink-0 text-center text-sm text-gray-500">{index + 1}</span>
        <input
          className={INPUT}
          value={field.label}
          maxLength={120}
          placeholder="เช่น ปัญหาที่พบในการสอน"
          aria-label={`คำถามข้อที่ ${index + 1}`}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-8">
        <select
          className={`${INPUT} !w-auto min-w-[10rem]`}
          value={field.type}
          aria-label={`ชนิดคำตอบของข้อที่ ${index + 1}`}
          onChange={(e) => onChange({ type: e.target.value })}
        >
          {FIELD_TYPES.map(ft => <option key={ft.id} value={ft.id}>{ft.label}</option>)}
        </select>
        <div className="flex gap-1 ml-auto">
          <button type="button" className={BTN_ICON} disabled={index === 0} aria-label="เลื่อนขึ้น" onClick={() => onMove(-1)}>▲</button>
          <button type="button" className={BTN_ICON} disabled={index === count - 1} aria-label="เลื่อนลง" onClick={() => onMove(1)}>▼</button>
          <button type="button" className={`${BTN_ICON} text-red-700`} aria-label={`เอาคำถามข้อที่ ${index + 1} ออก`} onClick={onRemove}>✕</button>
        </div>
      </div>
      {hasChoices(field.type) && (
        <OptionsEditor options={field.options} index={index} onChange={(options) => onChange({ options })} />
      )}
    </li>
  );
}

const RESPONSE_HINT = {
  SCORE: 'ให้คะแนนแต่ละรายการเป็นตัวเลข แล้วรวมเป็นระดับคุณภาพ',
  PASSFAIL: 'แตะเลือก ผ่าน หรือ ไม่ผ่าน ในแต่ละรายการ',
  CHECK: 'แตะติ๊ก ✓ รายการที่นักเรียนทำได้',
  TEXT: 'เขียนข้อความสั้นๆ ของนักเรียนแต่ละคนในแต่ละหัวข้อ ไม่มีคะแนน',
};

function TemplateForm({ form, setForm, isEdit }) {
  const n = filledCount(form.criteria);
  const max = Number(form.maxScore) || 0;
  const rt = form.responseType;
  const total = totalPoints(form);
  const unit = rt === 'SCORE' ? 'คะแนน' : 'ข้อ';
  const set = (patch) => setForm(f => ({ ...f, ...patch }));
  const showLevels = levelsOn(form);
  const canSwitchScope = isEdit && !form.isBuiltIn && (form.scope === 'STUDENT' || form.scope === 'BOTH');

  const setCriterion = (i, patch) => setForm(f => ({
    ...f, criteria: f.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)),
  }));
  const moveCriterion = (i, d) => setForm(f => {
    const list = [...f.criteria];
    const j = i + d;
    if (j < 0 || j >= list.length) return f;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...f, criteria: list };
  });
  const removeCriterion = (i) => setForm(f => ({ ...f, criteria: f.criteria.filter((_, j) => j !== i) }));
  const addCriterion = () => setForm(f => (f.criteria.length >= MAX_CRITERIA ? f
    : { ...f, criteria: [...f.criteria, { _k: nextKey(), label: '', short: '' }] }));

  const setField = (i, patch) => setForm(f => ({
    ...f, classFields: f.classFields.map((x, j) => (j === i ? { ...x, ...patch } : x)),
  }));
  const moveField = (i, d) => setForm(f => {
    const list = [...f.classFields];
    const j = i + d;
    if (j < 0 || j >= list.length) return f;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...f, classFields: list };
  });
  const removeField = (i) => setForm(f => ({ ...f, classFields: f.classFields.filter((_, j) => j !== i) }));
  const addField = () => setForm(f => (f.classFields.length >= MAX_CLASS_FIELDS ? f
    : { ...f, classFields: [...f.classFields, blankField()] }));

  const pickScope = (scope) => setForm(f => {
    if (f.scope === scope) return f;
    const next = { ...f, scope };
    if ((scope === 'CLASS' || scope === 'BOTH') && !f.classFields.length) next.classFields = [blankField()];
    if (scope === 'NOTE') next.criteria = [];
    return next;
  });

  const changeResponse = (next) => setForm(f => {
    if (f.responseType === next) return f;
    const count = filledCount(f.criteria) || 1;
    return {
      ...f,
      responseType: next,
      useLevels: false,
      levels: next === 'SCORE' ? presetLevels(PRESETS[0], count * (Number(f.maxScore) || 3)) : [],
    };
  });
  const toggleLevels = (on) => setForm(f => ({
    ...f, useLevels: on, levels: on ? simpleLevels(filledCount(f.criteria) || 1) : [],
  }));

  const setLevel = (i, patch) => setForm(f => ({
    ...f, levels: f.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)),
  }));
  // เรียงระดับบน ๆ ตามคะแนนเริ่มต้นเมื่อพิมพ์เสร็จ (แถวสุดท้าย = ที่เหลือทั้งหมด คงไว้ท้ายเสมอ)
  const sortLevels = () => setForm(f => {
    if (f.levels.length < 3) return f;
    const head = f.levels.slice(0, -1);
    const sorted = [...head].sort((a, b) => (parseInt(b.points, 10) || 0) - (parseInt(a.points, 10) || 0));
    const same = sorted.every((l, i) => l === head[i]);
    return same ? f : { ...f, levels: [...sorted, f.levels[f.levels.length - 1]] };
  });
  const addLevel = () => setForm(f => {
    if (f.levels.length >= MAX_LEVELS) return f;
    const head = f.levels.slice(0, -1);
    const lowest = head.length ? Math.min(...head.map(l => parseInt(l.points, 10) || 1)) : (total || 1) + 1;
    const row = { _k: nextKey(), label: '', points: String(Math.max(1, lowest - 1)) };
    return { ...f, levels: [...head, row, f.levels[f.levels.length - 1]] };
  });
  const removeLevel = (i) => setForm(f => (f.levels.length <= 1 ? f : { ...f, levels: f.levels.filter((_, j) => j !== i) }));
  const applyPreset = (p) => set({ levels: presetLevels(p, total || 1) });

  const preview = rangesText(form.levels, total);
  const itemsTitle = rt === 'TEXT' ? 'หัวข้อที่ให้เขียน' : 'รายการประเมิน';
  const itemPlaceholder = rt === 'TEXT' ? 'เช่น ข้อสังเกต' : 'เช่น มีความรับผิดชอบต่อหน้าที่';

  return (
    <div className="space-y-5">
      {!isEdit && (
        <Field label="ทำแบบไหน">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="ทำแบบไหน">
            {SCOPE_OPTIONS.map(o => (
              <RadioCard key={o.value} checked={form.scope === o.value} onClick={() => pickScope(o.value)} title={o.title} sub={o.sub} />
            ))}
          </div>
          <div className="mt-2" role="radiogroup" aria-label="แบบอื่น">
            <RadioCard
              small
              checked={form.scope === 'NOTE'}
              onClick={() => pickScope('NOTE')}
              title="บันทึกข้อความหลังสอน"
              sub="เขียนบันทึกรวมของห้อง แบบเดิมที่มีช่องลงชื่อ"
            />
          </div>
        </Field>
      )}

      {canSwitchScope && (
        <Field label="ทำแบบไหน">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="ทำแบบไหน">
            {SCOPE_OPTIONS.filter(o => o.value !== 'CLASS').map(o => (
              <RadioCard key={o.value} checked={form.scope === o.value} onClick={() => pickScope(o.value)} title={o.title} sub={o.sub} />
            ))}
          </div>
        </Field>
      )}

      <Field label="ชื่อแบบประเมิน">
        <input
          data-autofocus
          className={INPUT}
          value={form.name}
          maxLength={120}
          placeholder="เช่น การทำงานกลุ่ม"
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>

      {hasClassQs(form) && (
        <section>
          <h3 className="text-sm font-medium text-gray-800">คำถามระดับห้อง</h3>
          <p className="text-xs text-gray-500 mb-2">ตอบครั้งเดียวต่อหนึ่งบันทึก ไม่ต้องตอบทีละคน</p>
          <ul className="space-y-3">
            {form.classFields.map((f, i) => (
              <ClassFieldRow
                key={f._k}
                field={f}
                index={i}
                count={form.classFields.length}
                onChange={(patch) => setField(i, patch)}
                onMove={(d) => moveField(i, d)}
                onRemove={() => removeField(i)}
              />
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" className={BTN_SECONDARY} disabled={form.classFields.length >= MAX_CLASS_FIELDS} onClick={addField}>+ เพิ่มคำถาม</button>
            <span className="text-xs text-gray-500">{form.classFields.length}/{MAX_CLASS_FIELDS} ข้อ</span>
          </div>
        </section>
      )}

      {hasStudents(form) && (
        <>
          <section className="space-y-4">
            <h3 className="text-sm font-medium text-gray-800">ตอบรายนักเรียน</h3>
            {!form.isBuiltIn && (
              <Field label="รูปแบบการตอบ" hint={RESPONSE_HINT[rt]}>
                <select className={INPUT} value={rt} onChange={(e) => changeResponse(e.target.value)}>
                  {RESPONSE_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </Field>
            )}
            {rt === 'SCORE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <Field label="ระดับคะแนน" hint={`ให้คะแนนรายการละ 1–${max || '…'}`}>
                  <select
                    className={INPUT}
                    value={form.maxScore}
                    onChange={(e) => set({ maxScore: Number(e.target.value) })}
                  >
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => <option key={v} value={v}>1–{v} ({v} ระดับ)</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-gray-300 accent-brand-600"
                    checked={form.useAverage}
                    onChange={(e) => set({ useAverage: e.target.checked })}
                  />
                  <span className="text-sm text-gray-800">แสดงเป็นค่าเฉลี่ย</span>
                </label>
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium text-gray-800 mb-2">{itemsTitle}</h3>
            <ul className="space-y-3">
              {form.criteria.map((c, i) => (
                <li key={c._k} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-center text-sm text-gray-500">{i + 1}</span>
                    <input
                      className={INPUT}
                      value={c.label}
                      maxLength={120}
                      placeholder={itemPlaceholder}
                      aria-label={`รายการที่ ${i + 1}`}
                      onChange={(e) => setCriterion(i, { label: e.target.value })}
                      onBlur={() => { if (c.label.trim() && !c.short.trim()) setCriterion(i, { short: c.label.trim().slice(0, 10) }); }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-8">
                    <input
                      className={`${INPUT} !w-40`}
                      value={c.short}
                      maxLength={16}
                      placeholder={c.label.trim().slice(0, 10) || 'ชื่อสั้น'}
                      aria-label={`ชื่อสั้นของรายการที่ ${i + 1}`}
                      onChange={(e) => setCriterion(i, { short: e.target.value })}
                    />
                    <div className="flex gap-1 ml-auto">
                      <button type="button" className={BTN_ICON} disabled={i === 0} aria-label="เลื่อนขึ้น" onClick={() => moveCriterion(i, -1)}>▲</button>
                      <button type="button" className={BTN_ICON} disabled={i === form.criteria.length - 1} aria-label="เลื่อนลง" onClick={() => moveCriterion(i, 1)}>▼</button>
                      <button type="button" className={`${BTN_ICON} text-red-700`} aria-label={`เอารายการที่ ${i + 1} ออก`} onClick={() => removeCriterion(i)}>✕</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-3">
              <button type="button" className={BTN_SECONDARY} disabled={form.criteria.length >= MAX_CRITERIA} onClick={addCriterion}>+ เพิ่มรายการ</button>
              <span className="text-xs text-gray-500">ชื่อสั้นใช้เป็นหัวคอลัมน์ ถ้าเว้นไว้จะตัดจาก 10 ตัวอักษรแรก</span>
            </div>
          </section>

          {(rt === 'PASSFAIL' || rt === 'CHECK') && !form.isBuiltIn && (
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 accent-brand-600"
                checked={form.useLevels}
                onChange={(e) => toggleLevels(e.target.checked)}
              />
              <span className="text-sm text-gray-800">แบ่งระดับคุณภาพ (ไม่บังคับ)</span>
            </label>
          )}

          {showLevels && (
            <section>
              <h3 className="text-sm font-medium text-gray-800">ระดับคุณภาพ</h3>
              <p className="text-xs text-gray-500 mb-2">
                {!n ? 'เพิ่มรายการประเมินก่อน จึงจะคำนวณช่วงคะแนนได้'
                  : rt === 'SCORE' ? `คะแนนรวมเต็ม ${total} (${n} รายการ × ${max})`
                    : `นับจำนวนรายการที่${rt === 'PASSFAIL' ? 'ผ่าน' : 'ติ๊ก ✓'} เต็ม ${total} ข้อ`}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map(p => (
                  <button key={p.name} type="button" className={CHIP} onClick={() => applyPreset(p)}>{p.name}</button>
                ))}
              </div>
              <ul className="space-y-2">
                {form.levels.map((l, i) => {
                  const isLast = i === form.levels.length - 1;
                  return (
                    <li key={l._k} className="flex flex-wrap items-center gap-2">
                      <input
                        className={`${INPUT} flex-1 min-w-[8rem]`}
                        value={l.label}
                        maxLength={40}
                        placeholder="ชื่อระดับ"
                        aria-label={`ชื่อระดับที่ ${i + 1}`}
                        onChange={(e) => setLevel(i, { label: e.target.value })}
                      />
                      {isLast ? (
                        <span className="text-sm text-gray-600 w-40">{unit}ที่เหลือ</span>
                      ) : (
                        <div className="flex items-center gap-2 w-40">
                          <span className="text-sm text-gray-600 whitespace-nowrap">เริ่มที่</span>
                          <input
                            className={`${INPUT} !w-16 text-center`}
                            inputMode="numeric"
                            value={l.points}
                            aria-label={`${unit}เริ่มต้นของระดับที่ ${i + 1}`}
                            onChange={(e) => setLevel(i, { points: e.target.value.replace(/[^0-9]/g, '') })}
                            onBlur={sortLevels}
                          />
                          <span className="text-sm text-gray-600">{unit}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        className={`${BTN_ICON} text-red-700`}
                        disabled={form.levels.length <= 1}
                        aria-label={`เอาระดับที่ ${i + 1} ออก`}
                        onClick={() => removeLevel(i)}
                      >✕</button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className={`${BTN_SECONDARY} mt-2`} disabled={form.levels.length >= MAX_LEVELS} onClick={addLevel}>+ เพิ่มระดับ</button>
              {preview && (
                <p className="mt-3 rounded-lg bg-brand-100 px-3 py-2 text-sm text-brand-800" aria-live="polite">{preview}</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ---- การ์ดข้อมูลในไฟล์ Word ----

function DocSettingsCard({ canManage }) {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [signers, setSigners] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);

  const apply = useCallback((data) => {
    setSchoolName(data.schoolName || '');
    setSigners((data.signers || []).map(s => ({ _k: nextKey(), role: s.role || '', name: s.name || '' })));
  }, []);

  useEffect(() => {
    let alive = true;
    assessmentAPI.settings()
      .then(res => { if (alive) { apply(res.data); setLoaded(true); } })
      .catch(err => { if (alive) setLoadError(errMsg(err, 'โหลดข้อมูลไม่สำเร็จ')); });
    return () => { alive = false; clearTimeout(timer.current); };
  }, [apply]);

  const setSigner = (i, patch) => { setSaved(false); setSigners(list => list.map((s, j) => (j === i ? { ...s, ...patch } : s))); };

  const save = async () => {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const res = await assessmentAPI.saveSettings({
        schoolName: schoolName.trim(),
        signers: signers.map(s => ({ role: s.role.trim(), name: s.name.trim() })).filter(s => s.role || s.name),
      });
      apply(res.data);
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(errMsg(err, 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">ข้อมูลในไฟล์ Word</h2>
      <p className="text-sm text-gray-600 mb-3">ชื่อโรงเรียนและผู้ลงนามที่พิมพ์ท้ายแบบบันทึกเมื่อส่งออก</p>

      {loadError && <p className="text-sm text-red-700" role="alert">{loadError}</p>}
      {!loaded && !loadError && <p className="text-sm text-gray-500">กำลังโหลด…</p>}

      {loaded && !canManage && (
        <div className="space-y-2 text-sm text-gray-800">
          <p><span className="text-gray-500">โรงเรียน </span>{schoolName || '—'}</p>
          {signers.length > 0 ? (
            <ul className="space-y-1">
              {signers.map(s => (
                <li key={s._k}><span className="text-gray-500">{s.role || '—'} </span>{s.name || '—'}</li>
              ))}
            </ul>
          ) : <p className="text-gray-500">ยังไม่มีผู้ลงนาม</p>}
          <p className="pt-1 text-gray-600">แจ้งผู้ดูแลกลุ่มเพื่อแก้ไข</p>
        </div>
      )}

      {loaded && canManage && (
        <div className="space-y-4">
          <Field label="ชื่อโรงเรียน">
            <input className={INPUT} value={schoolName} maxLength={120} onChange={(e) => { setSaved(false); setSchoolName(e.target.value); }} />
          </Field>
          <div>
            <h3 className="text-sm font-medium text-gray-800 mb-2">ผู้ลงนาม</h3>
            {signers.length === 0 && <p className="text-sm text-gray-500 mb-2">ยังไม่มีผู้ลงนาม</p>}
            <ul className="space-y-3">
              {signers.map((s, i) => (
                <li key={s._k} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <input
                    className={INPUT}
                    value={s.role}
                    maxLength={80}
                    placeholder="ตำแหน่ง เช่น หัวหน้ากลุ่มสาระฯ"
                    aria-label={`ตำแหน่งผู้ลงนามที่ ${i + 1}`}
                    onChange={(e) => setSigner(i, { role: e.target.value })}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      className={INPUT}
                      value={s.name}
                      maxLength={80}
                      placeholder="ชื่อ-สกุล"
                      aria-label={`ชื่อ-สกุลผู้ลงนามที่ ${i + 1}`}
                      onChange={(e) => setSigner(i, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      className={`${BTN_ICON} text-red-700 shrink-0`}
                      aria-label={`เอาผู้ลงนามที่ ${i + 1} ออก`}
                      onClick={() => { setSaved(false); setSigners(list => list.filter((_, j) => j !== i)); }}
                    >✕</button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`${BTN_SECONDARY} mt-2`}
              disabled={signers.length >= MAX_SIGNERS}
              onClick={() => { setSaved(false); setSigners(list => [...list, { _k: nextKey(), role: '', name: '' }]); }}
            >+ เพิ่มผู้ลงนาม</button>
          </div>
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}</button>
            {saved && <span className="text-sm text-green-700" role="status">บันทึกแล้ว</span>}
          </div>
        </div>
      )}
    </section>
  );
}

// ---- หน้าหลัก ----

export default function TemplatesPage() {
  const dialog = useDialog();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editor, setEditor] = useState(null); // { id|null, form }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await assessmentAPI.templates();
      setTemplates(res.data || []);
      setLoadError('');
    } catch (err) {
      setLoadError(errMsg(err, 'โหลดแบบประเมินไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setFormError(''); setEditor({ id: null, form: blankForm() }); };
  const openEdit = (t) => { setFormError(''); setEditor({ id: t.id, form: formFromTemplate(t) }); };
  const closeEditor = () => { if (!saving) setEditor(null); };
  const setForm = useCallback((updater) => {
    setEditor(ed => (ed ? { ...ed, form: typeof updater === 'function' ? updater(ed.form) : updater } : ed));
  }, []);

  const save = async () => {
    if (!editor) return;
    const problem = validate(editor.form);
    if (problem) { setFormError(problem); return; }
    setFormError('');
    setSaving(true);
    try {
      const isEdit = editor.id !== null;
      const payload = buildPayload(editor.form, isEdit);
      if (isEdit) await assessmentAPI.updateTemplate(editor.id, payload);
      else await assessmentAPI.createTemplate(payload);
      setEditor(null);
      await load();
    } catch (err) {
      setFormError(errMsg(err, 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    const ok = await dialog.confirm({
      title: 'ลบแบบประเมิน',
      message: `ลบ "${t.name}" ใช่ไหม`,
      confirmText: 'ลบแบบประเมิน',
      type: 'danger',
    });
    if (!ok) return;
    try {
      const res = await assessmentAPI.deleteTemplate(t.id);
      if (res.data?.deactivated) {
        await dialog.alert({ title: 'ซ่อนแบบประเมินแล้ว', message: 'มีบันทึกที่ใช้แบบนี้อยู่ จึงซ่อนไว้แทนการลบ', type: 'info' });
      }
      await load();
    } catch (err) {
      await dialog.alert({ title: 'ลบไม่สำเร็จ', message: errMsg(err, 'ลองใหม่อีกครั้ง'), type: 'danger' });
    }
  };

  const isEdit = editor && editor.id !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-4 pb-24 sm:pb-6">
      <div>
        <Link to="/lesson-log" className="inline-flex items-center min-h-[44px] text-sm text-brand-700 hover:underline">‹ บันทึกหลังแผน</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900">แบบประเมิน</h1>
          <button type="button" className={BTN_PRIMARY} onClick={openCreate}>+ สร้างแบบประเมินใหม่</button>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">กำลังโหลด…</p>}
      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {loadError}{' '}
          <button type="button" className="min-h-[44px] underline" onClick={() => { setLoading(true); load(); }}>ลองใหม่</button>
        </div>
      )}

      {!loading && !loadError && templates.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-600">
          ยังไม่มีแบบประเมิน กด "+ สร้างแบบประเมินใหม่" เพื่อเริ่ม
        </p>
      )}

      <ul className="space-y-3">
        {templates.map(t => {
          const isNote = t.kind === 'NOTE';
          const isStudent = t.kind === 'RUBRIC';
          const rt = responseOf(t);
          const nQ = (t.classFields || []).length;
          const levels = (t.levels || []).map(l => l.label).join(' / ');
          return (
            <li key={t.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-gray-900 break-words">{t.name}</h2>
                {t.isBuiltIn && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">สำเร็จรูป</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {SCOPE_LABEL[scopeOf(t)]}
                {isNote && ' · บันทึกข้อความหลังสอน'}
                {nQ > 0 && ` · ${nQ} คำถาม`}
                {isStudent && ` · ${(t.criteria || []).length} รายการ · ${rt === 'SCORE' ? `ให้คะแนน 1–${t.maxScore}` : responseLabel(rt)}`}
              </p>
              {isStudent && levels && <p className="text-sm text-gray-600">{levels}</p>}
              {t.canEdit && (
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" className={BTN_SECONDARY} onClick={() => openEdit(t)}>แก้ไข</button>
                  {!t.isBuiltIn && (
                    <button type="button" className="min-h-[44px] px-3 text-sm text-red-700 hover:underline" onClick={() => remove(t)}>ลบ</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Every teacher of the group may edit the school name and signers. */}
      <DocSettingsCard canManage />

      <WindowModal
        open={!!editor}
        title={isEdit ? 'แก้ไขแบบประเมิน' : 'สร้างแบบประเมินใหม่'}
        onClose={closeEditor}
        id="lesson-log-template"
        initialWidth="max-w-2xl"
        footer={editor && (
          <div className="space-y-2">
            {formError && <p className="text-sm text-red-700" role="alert">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={closeEditor}>ยกเลิก</button>
              <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
            </div>
          </div>
        )}
      >
        {editor && (
          <div className="p-4">
            <TemplateForm form={editor.form} setForm={setForm} isEdit={isEdit} />
          </div>
        )}
      </WindowModal>
    </div>
  );
}
