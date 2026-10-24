import React, { useEffect, useRef, useState } from 'react';
import { assessmentAPI } from '../../services/api';
import WindowModal from '../../components/ui/WindowModal';
import { SmartComboBox } from '../../components/ui';
import { RESPONSE_TYPES, FIELD_TYPES, SCOPE_LABEL, responseOf } from './lessonLogCore';

// popup สร้าง/แก้แบบประเมิน แบ่งเป็นขั้น: เลือกแบบ → ข้อมูลทั่วไป → คำถามระดับห้อง → รายการ → ระดับคุณภาพ

const MAX_CRITERIA = 20;
const MAX_LEVELS = 8;
const MAX_CLASS_FIELDS = 20;
const MAX_OPTIONS = 20;

export const INPUT = 'w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400';
export const BTN_PRIMARY = 'inline-flex items-center justify-center gap-1 min-h-[44px] px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-60';
export const BTN_SECONDARY = 'inline-flex items-center justify-center gap-1 min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60';
export const BTN_ICON = 'inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40';
const CHIP = 'inline-flex items-center justify-center min-h-[44px] px-4 rounded-full border border-gray-300 bg-white text-sm text-gray-800 hover:bg-gray-50';

export const errMsg = (err, fallback) => err?.response?.data?.error || fallback;

let keySeq = 0;
export const nextKey = () => `k${++keySeq}`;

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
// levelsTouched = ครูแก้ระดับเองแล้ว (ถ้ายังไม่แตะ จะคำนวณช่วงคะแนนใหม่ตามจำนวนรายการตอนเปิดขั้นระดับคุณภาพ)
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
    levelsTouched: false,
    classFields: [blankField()],
  };
}

function formFromTemplate(t) {
  const base = { ...blankForm(), name: t.name, isBuiltIn: !!t.isBuiltIn, levelsTouched: true };
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

// คืน { step, msg } (ข้อความภาษาครู + ขั้นที่ต้องแก้) หรือ null ถ้าผ่าน
function validate(form) {
  const fail = (step, msg) => ({ step, msg });
  if (!form.name.trim()) return fail('basic', 'ตั้งชื่อแบบประเมินก่อน');
  if (form.scope === 'NOTE') return null;
  if (hasClassQs(form)) {
    if (!form.classFields.length) return fail('class', 'เพิ่มคำถามระดับห้องอย่างน้อย 1 ข้อ');
    for (let i = 0; i < form.classFields.length; i++) {
      const f = form.classFields[i];
      if (!f.label.trim()) return fail('class', `พิมพ์คำถามข้อที่ ${i + 1} หรือเอาข้อนั้นออก`);
      if (hasChoices(f.type) && !f.options.length) return fail('class', `ใส่ตัวเลือกให้คำถามข้อที่ ${i + 1} อย่างน้อย 1 ตัว`);
    }
  }
  if (!hasStudents(form)) return null;
  const n = filledCount(form.criteria);
  const text = form.responseType === 'TEXT';
  if (!n) return fail('items', text ? 'เพิ่มหัวข้อที่ให้เขียนอย่างน้อย 1 รายการ' : 'เพิ่มรายการประเมินอย่างน้อย 1 รายการ');
  if (form.responseType === 'SCORE') {
    const max = Number(form.maxScore);
    if (!Number.isInteger(max) || max < 2 || max > 10) return fail('basic', 'ระดับคะแนนต้องเป็น 2–10');
  }
  if (!levelsOn(form)) return null;
  const total = totalPoints(form);
  if (!form.levels.length) return fail('levels', 'กำหนดระดับคุณภาพอย่างน้อย 1 ระดับ');
  if (form.levels.some(l => !l.label.trim())) return fail('levels', 'ตั้งชื่อระดับคุณภาพให้ครบทุกแถว');
  const pts = form.levels.slice(0, -1).map(l => parseInt(l.points, 10));
  const bad = pts.some(p => !Number.isInteger(p) || p < 1 || p > total);
  if (bad) return fail('levels', `คะแนนเริ่มต้นของแต่ละระดับต้องอยู่ระหว่าง 1–${total}`);
  if (new Set(pts).size !== pts.length) return fail('levels', 'คะแนนเริ่มต้นของแต่ละระดับต้องไม่ซ้ำกัน');
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

// ขั้นที่ต้องแสดงตามแบบที่เลือก
function stepsOf(form, isEdit) {
  const steps = isEdit ? [] : ['type'];
  steps.push('basic');
  if (form.scope === 'NOTE') return steps;
  if (hasClassQs(form)) steps.push('class');
  if (hasStudents(form)) {
    steps.push('items');
    const rt = form.responseType;
    const optional = rt === 'PASSFAIL' || rt === 'CHECK';
    if (rt === 'SCORE' || (optional && (!form.isBuiltIn || form.useLevels))) steps.push('levels');
  }
  return steps;
}

const stepLabel = (step, form) => ({
  type: 'เลือกแบบ',
  basic: 'ข้อมูลทั่วไป',
  class: 'คำถามระดับห้อง',
  items: form.responseType === 'TEXT' ? 'หัวข้อที่ให้เขียน' : 'รายการประเมิน',
  levels: 'ระดับคุณภาพ',
}[step]);

// ---- ส่วนย่อย ----

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-800 mb-1">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
  </div>
);

function RadioCard({ checked, onClick, title, sub, big }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`text-left min-h-[44px] rounded-lg border px-3 ${big ? 'py-4' : 'py-2'} ${checked
        ? 'border-brand-600 bg-brand-100 ring-1 ring-brand-600' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
    >
      <span className={`block font-medium text-gray-900 ${big ? 'text-base' : 'text-sm'}`}>{title}</span>
      <span className="block text-xs text-gray-600 mt-0.5">{sub}</span>
    </button>
  );
}

const StepHead = ({ title, sub }) => (
  <div className="mb-3">
    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
    {sub && <p className="text-sm text-gray-600">{sub}</p>}
  </div>
);

// แถบขั้นด้านบน: จอเล็กแสดงชื่อเฉพาะขั้นปัจจุบัน
function Stepper({ steps, current, form, onPick }) {
  const at = steps.indexOf(current);
  return (
    <nav aria-label="ขั้นตอน" className="sticky top-0 z-10 border-b border-gray-200 bg-white px-2 py-1">
      <ol className="flex items-center gap-1 overflow-x-auto">
        {steps.map((s, i) => {
          const active = s === current;
          return (
            <li key={s} className="shrink-0">
              <button
                type="button"
                aria-current={active ? 'step' : undefined}
                onClick={() => onPick(s)}
                className={`inline-flex items-center gap-2 min-h-[44px] rounded-lg px-2 text-sm ${active
                  ? 'font-semibold text-brand-800' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${active
                  ? 'bg-brand-600 text-white' : i < at ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-600'}`}
                >{i + 1}</span>
                <span className={active ? '' : 'hidden sm:inline'}>{stepLabel(s, form)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
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

// ปุ่มเลื่อนขึ้น/ลง/เอาออก ของแถวในรายการ
function RowTools({ index, count, onMove, onRemove, removeLabel }) {
  return (
    <div className="flex gap-1 ml-auto">
      <button type="button" className={BTN_ICON} disabled={index === 0} aria-label="เลื่อนขึ้น" onClick={() => onMove(-1)}>▲</button>
      <button type="button" className={BTN_ICON} disabled={index === count - 1} aria-label="เลื่อนลง" onClick={() => onMove(1)}>▼</button>
      <button type="button" className={`${BTN_ICON} text-red-700`} aria-label={removeLabel} onClick={onRemove}>✕</button>
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
        <SmartComboBox
          options={FIELD_TYPES}
          value={field.type}
          onChange={(v) => v && onChange({ type: v })}
          valueKey="id"
          searchable={false}
          clearable={false}
          ariaLabel={`ชนิดคำตอบของข้อที่ ${index + 1}`}
          className="w-44"
        />
        <RowTools index={index} count={count} onMove={onMove} onRemove={onRemove} removeLabel={`เอาคำถามข้อที่ ${index + 1} ออก`} />
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

const responseLabel = (id) => (RESPONSE_TYPES.find(r => r.id === id) || RESPONSE_TYPES[0]).label;

// ---- ขั้นที่ 1 (สร้างใหม่): เลือกแบบ ----

function TypeStep({ form, onPick }) {
  return (
    <div>
      <StepHead title="จะประเมินแบบไหน" sub="แตะเลือก 1 แบบ แล้วไปตั้งชื่อต่อ" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="ทำแบบไหน">
        {SCOPE_OPTIONS.map(o => (
          <RadioCard big key={o.value} checked={form.scope === o.value} onClick={() => onPick(o.value)} title={o.title} sub={o.sub} />
        ))}
      </div>
      <p className="mt-4 mb-1 text-xs text-gray-500">แบบอื่น</p>
      <div role="radiogroup" aria-label="แบบอื่น">
        <RadioCard
          checked={form.scope === 'NOTE'}
          onClick={() => onPick('NOTE')}
          title="บันทึกข้อความหลังสอน"
          sub="เขียนบันทึกรวมของห้อง แบบเดิมที่มีช่องลงชื่อ"
        />
      </div>
    </div>
  );
}

// ---- ขั้นข้อมูลทั่วไป: ชื่อ + รูปแบบการตอบ ----

function BasicStep({ form, set, isEdit, pickScope, changeResponse, goType }) {
  const rt = form.responseType;
  const max = Number(form.maxScore) || 0;
  const canSwitchScope = isEdit && !form.isBuiltIn && (form.scope === 'STUDENT' || form.scope === 'BOTH');
  const scopeTitle = form.scope === 'NOTE' ? 'บันทึกข้อความหลังสอน' : SCOPE_LABEL[form.scope];
  const nameRef = useRef(null);
  const [advOpen] = useState(form.useAverage); // เปิดไว้ตั้งแต่แรกถ้าเคยตั้งค่าไว้

  // เข้าขั้นนี้แล้วพร้อมพิมพ์ชื่อทันที
  useEffect(() => { if (!isEdit && nameRef.current) nameRef.current.focus({ preventScroll: true }); }, [isEdit]);

  return (
    <div className="space-y-5">
      {!isEdit && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
          <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-800">{scopeTitle}</span>
          <button type="button" className="min-h-[44px] px-1 text-brand-700 underline" onClick={goType}>เปลี่ยนแบบ</button>
        </p>
      )}

      <Field label="ชื่อแบบประเมิน">
        <input
          ref={nameRef}
          data-autofocus
          className={INPUT}
          value={form.name}
          maxLength={120}
          placeholder="เช่น การทำงานกลุ่ม"
          onChange={(e) => set({ name: e.target.value })}
        />
      </Field>

      {canSwitchScope && (
        <Field label="ทำแบบไหน">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="ทำแบบไหน">
            {SCOPE_OPTIONS.filter(o => o.value !== 'CLASS').map(o => (
              <RadioCard key={o.value} checked={form.scope === o.value} onClick={() => pickScope(o.value)} title={o.title} sub={o.sub} />
            ))}
          </div>
        </Field>
      )}

      {hasStudents(form) && !form.isBuiltIn && (
        <Field label="นักเรียนแต่ละคนตอบแบบไหน">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="รูปแบบการตอบ">
            {RESPONSE_TYPES.map(r => (
              <RadioCard key={r.id} checked={rt === r.id} onClick={() => changeResponse(r.id)} title={r.label} sub={RESPONSE_HINT[r.id]} />
            ))}
          </div>
        </Field>
      )}
      {hasStudents(form) && form.isBuiltIn && (
        <p className="text-sm text-gray-600">รูปแบบการตอบ: <span className="text-gray-900">{responseLabel(rt)}</span> (แบบสำเร็จรูปเปลี่ยนไม่ได้)</p>
      )}

      {hasStudents(form) && rt === 'SCORE' && (
        <div className="space-y-3">
          <Field label="ระดับคะแนน" hint={`ให้คะแนนรายการละ 1–${max || '…'}`}>
            <SmartComboBox
              options={[2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => ({ value: v, label: `1–${v} (${v} ระดับ)` }))}
              value={Number(form.maxScore)}
              onChange={(v) => v && set({ maxScore: Number(v) })}
              placeholder="เลือกระดับคะแนน"
              searchable={false}
              clearable={false}
              ariaLabel="ระดับคะแนน"
            />
          </Field>
          <details className="rounded-lg border border-gray-200" open={advOpen}>
            <summary className="flex items-center min-h-[44px] cursor-pointer px-3 text-sm text-gray-700">ตัวเลือกเพิ่มเติม</summary>
            <label className="flex items-center gap-3 min-h-[44px] cursor-pointer px-3 pb-2">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-gray-300 accent-brand-600"
                checked={form.useAverage}
                onChange={(e) => set({ useAverage: e.target.checked })}
              />
              <span className="text-sm text-gray-800">แสดงเป็นค่าเฉลี่ย</span>
            </label>
          </details>
        </div>
      )}
    </div>
  );
}

// ---- ขั้นคำถามระดับห้อง ----

function ClassStep({ form, setForm }) {
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

  return (
    <section>
      <StepHead title="คำถามระดับห้อง" sub="ตอบครั้งเดียวต่อหนึ่งบันทึก ไม่ต้องตอบทีละคน" />
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
  );
}

// ---- ขั้นรายการประเมิน (ชื่อสั้นซ่อนไว้ เปิดเมื่อต้องการ) ----

function ItemsStep({ form, setForm, showShort, setShowShort }) {
  const rt = form.responseType;
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

  const title = rt === 'TEXT' ? 'หัวข้อที่ให้เขียน' : 'รายการประเมิน';
  const placeholder = rt === 'TEXT' ? 'เช่น ข้อสังเกต' : 'เช่น มีความรับผิดชอบต่อหน้าที่';
  const sub = rt === 'TEXT' ? 'นักเรียนแต่ละคนจะมีช่องเขียนตามหัวข้อเหล่านี้'
    : rt === 'SCORE' ? `ให้คะแนนรายการละ 1–${Number(form.maxScore) || '…'}` : RESPONSE_HINT[rt];

  return (
    <section>
      <StepHead title={title} sub={sub} />
      <ul className="space-y-3">
        {form.criteria.map((c, i) => (
          <li key={c._k} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-6 shrink-0 text-center text-sm text-gray-500">{i + 1}</span>
              <input
                className={`${INPUT} !w-auto flex-1 min-w-[12rem]`}
                value={c.label}
                maxLength={120}
                placeholder={placeholder}
                aria-label={`รายการที่ ${i + 1}`}
                onChange={(e) => setCriterion(i, { label: e.target.value })}
                onBlur={() => { if (c.label.trim() && !c.short.trim()) setCriterion(i, { short: c.label.trim().slice(0, 10) }); }}
              />
              <RowTools
                index={i}
                count={form.criteria.length}
                onMove={(d) => moveCriterion(i, d)}
                onRemove={() => removeCriterion(i)}
                removeLabel={`เอารายการที่ ${i + 1} ออก`}
              />
            </div>
            {showShort && (
              <div className="flex items-center gap-2 pl-8">
                <span className="text-xs text-gray-500 whitespace-nowrap">ชื่อสั้น</span>
                <input
                  className={`${INPUT} !w-40`}
                  value={c.short}
                  maxLength={16}
                  placeholder={c.label.trim().slice(0, 10) || 'ชื่อสั้น'}
                  aria-label={`ชื่อสั้นของรายการที่ ${i + 1}`}
                  onChange={(e) => setCriterion(i, { short: e.target.value })}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className={BTN_SECONDARY} disabled={form.criteria.length >= MAX_CRITERIA} onClick={addCriterion}>+ เพิ่มรายการ</button>
        <span className="text-xs text-gray-500">{form.criteria.length}/{MAX_CRITERIA} รายการ</span>
      </div>
      <label className="mt-3 flex items-center gap-3 min-h-[44px] cursor-pointer">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-gray-300 accent-brand-600"
          checked={showShort}
          onChange={(e) => setShowShort(e.target.checked)}
        />
        <span className="text-sm text-gray-800">แก้ชื่อสั้น (หัวคอลัมน์)</span>
      </label>
      <p className="text-xs text-gray-500">ถ้าเว้นไว้จะตัดจาก 10 ตัวอักษรแรกของรายการ</p>
    </section>
  );
}

// ---- ขั้นระดับคุณภาพ ----

function LevelsStep({ form, setForm }) {
  const n = filledCount(form.criteria);
  const max = Number(form.maxScore) || 0;
  const rt = form.responseType;
  const total = totalPoints(form);
  const unit = rt === 'SCORE' ? 'คะแนน' : 'ข้อ';
  const showLevels = levelsOn(form);
  const touch = (f, patch) => ({ ...f, ...patch, levelsTouched: true });

  const toggleLevels = (on) => setForm(f => ({
    ...f, useLevels: on, levels: on ? simpleLevels(filledCount(f.criteria) || 1) : [],
  }));
  const setLevel = (i, patch) => setForm(f => touch(f, {
    levels: f.levels.map((l, j) => (j === i ? { ...l, ...patch } : l)),
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
    return touch(f, { levels: [...head, row, f.levels[f.levels.length - 1]] });
  });
  const removeLevel = (i) => setForm(f => (f.levels.length <= 1 ? f : touch(f, { levels: f.levels.filter((_, j) => j !== i) })));
  const applyPreset = (p) => setForm(f => touch(f, { levels: presetLevels(p, total || 1) }));

  const preview = rangesText(form.levels, total);

  return (
    <section>
      <StepHead
        title="ระดับคุณภาพ"
        sub={!n ? 'เพิ่มรายการประเมินก่อน จึงจะคำนวณช่วงคะแนนได้'
          : rt === 'SCORE' ? `คะแนนรวมเต็ม ${total} (${n} รายการ × ${max})`
            : `นับจำนวนรายการที่${rt === 'PASSFAIL' ? 'ผ่าน' : 'ติ๊ก ✓'} เต็ม ${total} ข้อ`}
      />

      {(rt === 'PASSFAIL' || rt === 'CHECK') && !form.isBuiltIn && (
        <label className="flex items-center gap-3 min-h-[44px] cursor-pointer mb-2">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-gray-300 accent-brand-600"
            checked={form.useLevels}
            onChange={(e) => toggleLevels(e.target.checked)}
          />
          <span className="text-sm text-gray-800">แบ่งระดับคุณภาพ (ไม่บังคับ)</span>
        </label>
      )}
      {!showLevels && <p className="text-sm text-gray-500">ไม่แบ่งระดับ ข้ามขั้นนี้แล้วกดบันทึกได้เลย</p>}

      {showLevels && (
        <>
          <p className="text-xs text-gray-500 mb-1">ใช้ชุดสำเร็จรูป</p>
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
                    className={`${INPUT} !w-auto flex-1 min-w-[8rem]`}
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
        </>
      )}
    </section>
  );
}

// ---- popup หลัก ----
// template = null → สร้างใหม่ · onSaved เรียกหลังบันทึกสำเร็จ (หน้าแม่โหลดรายการใหม่และปิด popup)

export default function TemplateEditorModal({ template, onClose, onSaved }) {
  const isEdit = !!template;
  const [form, setFormState] = useState(() => (template ? formFromTemplate(template) : blankForm()));
  const [step, setStep] = useState(isEdit ? 'basic' : 'type');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showShort, setShowShort] = useState(isEdit);
  const bodyRef = useRef(null);

  const setForm = (updater) => setFormState(f => (typeof updater === 'function' ? updater(f) : updater));
  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const steps = stepsOf(form, isEdit);
  const cur = steps.includes(step) ? step : steps[steps.length - 1];
  const at = steps.indexOf(cur);
  const isLast = at === steps.length - 1;

  // เปลี่ยนขั้นแล้วเลื่อนกลับบนสุด
  useEffect(() => {
    const scroller = bodyRef.current && bodyRef.current.parentElement;
    if (scroller) scroller.scrollTop = 0;
  }, [cur]);

  const pickScope = (scope) => setForm(f => {
    if (f.scope === scope) return f;
    const next = { ...f, scope };
    if ((scope === 'CLASS' || scope === 'BOTH') && !f.classFields.length) next.classFields = [blankField()];
    if (scope === 'NOTE') next.criteria = [];
    // กลับจากบันทึกข้อความมาแบบรายนักเรียน: เติมช่องว่างให้ใหม่
    if ((scope === 'STUDENT' || scope === 'BOTH') && !f.criteria.length) {
      next.criteria = [0, 1, 2].map(() => ({ _k: nextKey(), label: '', short: '' }));
    }
    return next;
  });

  const changeResponse = (next) => setForm(f => {
    if (f.responseType === next) return f;
    const count = filledCount(f.criteria) || 1;
    return {
      ...f,
      responseType: next,
      useLevels: false,
      levelsTouched: false,
      levels: next === 'SCORE' ? presetLevels(PRESETS[0], count * (Number(f.maxScore) || 3)) : [],
    };
  });

  // เปิดขั้นระดับคุณภาพครั้งแรก: คำนวณช่วงคะแนนใหม่ตามจำนวนรายการจริง (ถ้าครูยังไม่ได้แก้เอง)
  const goTo = (s) => {
    setError('');
    if (s === 'levels') {
      setForm(f => {
        if (f.levelsTouched) return f;
        if (f.responseType === 'SCORE') return { ...f, levels: presetLevels(PRESETS[0], totalPoints(f) || 1) };
        if (f.useLevels) return { ...f, levels: simpleLevels(filledCount(f.criteria) || 1) };
        return f;
      });
    }
    setStep(s);
  };

  const pickType = (scope) => { pickScope(scope); goTo('basic'); };

  // ถัดไป: ตรวจเฉพาะขั้นที่ผ่านมาแล้ว
  const next = () => {
    const problem = validate(form);
    if (problem && steps.indexOf(problem.step) !== -1 && steps.indexOf(problem.step) <= at) {
      setError(problem.msg);
      setStep(problem.step);
      return;
    }
    goTo(steps[at + 1]);
  };

  const close = () => { if (!saving) onClose(); };

  const save = async () => {
    const problem = validate(form);
    if (problem) {
      setError(problem.msg);
      if (steps.includes(problem.step)) setStep(problem.step);
      return;
    }
    setError('');
    setSaving(true);
    try {
      const payload = buildPayload(form, isEdit);
      if (isEdit) await assessmentAPI.updateTemplate(template.id, payload);
      else await assessmentAPI.createTemplate(payload);
      setSaving(false);
      await onSaved();
    } catch (err) {
      setError(errMsg(err, 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'));
      setSaving(false);
    }
  };

  // สร้างใหม่: ทำทีละขั้นจนขั้นสุดท้ายจึงมีปุ่มบันทึก · แก้ไข: บันทึกได้ทุกขั้น ใช้แถบขั้นด้านบนสลับ
  const footer = (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <div className="flex items-center gap-2">
        {!isEdit && at > 0 && (
          <button type="button" className={`${BTN_SECONDARY} !px-3`} disabled={saving} onClick={() => goTo(steps[at - 1])}>‹ ย้อนกลับ</button>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" className={BTN_SECONDARY} disabled={saving} onClick={close}>ยกเลิก</button>
          {!isEdit && !isLast && (
            <button type="button" className={BTN_PRIMARY} onClick={next}>ถัดไป ›</button>
          )}
          {(isEdit || isLast) && (
            <button type="button" className={BTN_PRIMARY} disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <WindowModal
      open
      title={isEdit ? `แก้ไข: ${template.name}` : 'สร้างแบบประเมินใหม่'}
      onClose={close}
      id="lesson-log-template"
      initialWidth="max-w-3xl"
      footer={footer}
    >
      <div ref={bodyRef}>
        <Stepper steps={steps} current={cur} form={form} onPick={goTo} />
        <div className="p-4">
          {cur === 'type' && <TypeStep form={form} onPick={pickType} />}
          {cur === 'basic' && (
            <BasicStep
              form={form}
              set={set}
              isEdit={isEdit}
              pickScope={pickScope}
              changeResponse={changeResponse}
              goType={() => goTo('type')}
            />
          )}
          {cur === 'class' && <ClassStep form={form} setForm={setForm} />}
          {cur === 'items' && <ItemsStep form={form} setForm={setForm} showShort={showShort} setShowShort={setShowShort} />}
          {cur === 'levels' && <LevelsStep form={form} setForm={setForm} />}
        </div>
      </div>
    </WindowModal>
  );
}
