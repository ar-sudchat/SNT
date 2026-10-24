import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assessmentAPI } from '../../services/api';
import PaperPreview from './PaperPreview';

const card = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm';
const chipBase = 'min-h-[44px] rounded-full border px-4 py-2 text-left text-sm transition-colors disabled:cursor-default';
const chipOn = 'border-brand-600 bg-brand-600 text-white';
const chipOff = 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50';
const inputCls = 'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 read-only:bg-gray-50';

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// Keep only answers for known fields and drop empties, so "dirty" and the saved payload agree.
const compact = (fields, answers) => {
  const out = {};
  (fields || []).forEach((f) => {
    const v = answers?.[f.key];
    if (!isEmpty(v)) out[f.key] = v;
  });
  return out;
};

function FieldInput({ field, value, disabled, onChange }) {
  const id = `ll-ca-${field.key}`;
  const options = field.options || [];

  if (field.type === 'choice') {
    return (
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o;
          return (
            <button key={o} type="button" role="radio" aria-checked={on} disabled={disabled}
              onClick={() => onChange(on ? '' : o)}
              className={`${chipBase} ${on ? chipOn : chipOff}`}>
              {on && <span aria-hidden="true">{'✓ '}</span>}{o}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === 'checklist') {
    const list = Array.isArray(value) ? value : [];
    return (
      <div role="group" aria-labelledby={`${id}-label`} className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = list.includes(o);
          return (
            <button key={o} type="button" aria-pressed={on} disabled={disabled}
              onClick={() => onChange(on ? list.filter((x) => x !== o) : options.filter((x) => x === o || list.includes(x)))}
              className={`${chipBase} ${on ? chipOn : chipOff}`}>
              {on && <span aria-hidden="true">{'✓ '}</span>}{o}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === 'longtext') {
    return (
      <textarea id={id} rows={3} maxLength={3000} readOnly={disabled} value={value ?? ''}
        onChange={(e) => onChange(e.target.value)} className={inputCls} />
    );
  }

  if (field.type === 'number') {
    return (
      <input id={id} type="text" inputMode="decimal" readOnly={disabled} value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value.replace(',', '.');
          if (v === '' || /^-?\d*\.?\d*$/.test(v)) onChange(v);
        }}
        className={`${inputCls} sm:max-w-xs`} />
    );
  }

  return (
    <input id={id} type="text" maxLength={500} readOnly={disabled} value={value ?? ''}
      onChange={(e) => onChange(e.target.value)} className={inputCls} />
  );
}

export default function ClassAnswersEditor({ record, canEdit, onSaved, standalone = false, settings }) {
  const fields = useMemo(() => record?.classFields || [], [record?.classFields]);
  const [answers, setAnswers] = useState(() => compact(fields, record?.classAnswers));
  const [baseline, setBaseline] = useState(() => JSON.stringify(compact(fields, record?.classAnswers)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPaper, setShowPaper] = useState(false);
  const recordKey = useRef(record?.id);
  const msgTimer = useRef(null);

  // เปลี่ยนไปเปิดบันทึกอื่น -> เริ่มใหม่จากข้อมูลของบันทึกนั้น
  useEffect(() => {
    if (recordKey.current === record?.id) return;
    recordKey.current = record?.id;
    const a = compact(record?.classFields, record?.classAnswers);
    setAnswers(a);
    setBaseline(JSON.stringify(a));
    setError('');
    setMessage('');
  }, [record]);

  useEffect(() => () => clearTimeout(msgTimer.current), []);

  const payload = useMemo(() => compact(fields, answers), [fields, answers]);
  const dirty = useMemo(() => JSON.stringify(payload) !== baseline, [payload, baseline]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setValue = useCallback((key, value) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    setMessage('');
  }, []);

  const save = async () => {
    if (saving || !canEdit) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = standalone ? { classAnswers: payload, status: 'DONE' } : { classAnswers: payload };
      const { data } = await assessmentAPI.updateRecord(record.id, body);
      setBaseline(JSON.stringify(payload));
      setMessage('บันทึกแล้ว');
      clearTimeout(msgTimer.current);
      msgTimer.current = setTimeout(() => setMessage(''), 4000);
      if (onSaved) onSaved(data);
    } catch (e) {
      setError(e?.response?.data?.error || 'บันทึกไม่สำเร็จ ลองอีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  if (!record || !fields.length) return null;
  const disabled = !canEdit;
  const live = { ...record, classAnswers: payload };

  const questions = fields.map((f) => (
    <div key={f.key}>
      {f.type === 'choice' || f.type === 'checklist' ? (
        <p id={`ll-ca-${f.key}-label`} className="text-sm font-medium text-gray-700">{f.label}</p>
      ) : (
        <label htmlFor={`ll-ca-${f.key}`} className="block text-sm font-medium text-gray-700">{f.label}</label>
      )}
      <FieldInput field={f} value={answers[f.key]} disabled={disabled} onChange={(v) => setValue(f.key, v)} />
    </div>
  ));

  const readOnlyNote = disabled && (
    <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">ดูได้อย่างเดียว — แก้ไขได้เฉพาะครูเจ้าของบันทึกหรือผู้ดูแล</div>
  );
  const errorBox = error && (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
  );

  if (!standalone) {
    return (
      <section className={`${card} space-y-4`} aria-labelledby="ll-class-questions">
        <h2 id="ll-class-questions" className="text-base font-semibold text-gray-900">คำถามระดับห้อง</h2>
        {readOnlyNote}
        {questions}
        {errorBox}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={saving || !dirty}
              className="min-h-[44px] rounded-lg border border-brand-600 bg-white px-5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
              {saving ? 'กำลังบันทึก…' : 'บันทึกคำตอบระดับห้อง'}
            </button>
            {message && <span role="status" className="text-sm text-green-700">{message}</span>}
            {!message && dirty && <span className="text-sm text-gray-600">ยังไม่ได้บันทึก</span>}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="pb-24 lg:pb-0">
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>
          <div className="space-y-4">
            {readOnlyNote}
            <section className={`${card} space-y-4`} aria-label="คำตอบระดับห้อง">
              {questions}
            </section>
            {errorBox}
          </div>

          <div className="mt-4 lg:hidden">
            <button type="button" aria-expanded={showPaper} onClick={() => setShowPaper((v) => !v)}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
              {showPaper ? 'ซ่อนหน้ากระดาษ' : 'ดูหน้ากระดาษ'}
            </button>
            {showPaper && (
              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-100 p-2">
                <PaperPreview record={live} settings={settings} />
              </div>
            )}
          </div>

          {canEdit && (
            <div className="mt-4 hidden items-center gap-3 lg:flex">
              <button type="button" onClick={save} disabled={saving}
                className="min-h-[44px] rounded-lg bg-brand-600 px-6 font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
              {message && <span role="status" className="text-sm text-green-700">{message}</span>}
              {!message && dirty && <span className="text-sm text-gray-600">ยังไม่ได้บันทึก</span>}
            </div>
          )}
        </div>

        <div className="hidden lg:sticky lg:top-4 lg:block">
          <div className="rounded-xl border border-gray-200 bg-gray-100 p-3">
            <PaperPreview record={live} settings={settings} />
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 pt-3 shadow-lg lg:hidden"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          {message && <p role="status" className="mb-2 text-center text-sm text-green-700">{message}</p>}
          <button type="button" onClick={save} disabled={saving}
            className="min-h-[48px] w-full rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      )}
    </div>
  );
}
