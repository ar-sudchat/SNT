import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assessmentAPI } from '../../services/api';
import { useDialog } from '../ui/DialogProvider';
import PaperPreview from './PaperPreview';
import { PROBLEM_SUGGESTIONS, FIX_SUGGESTIONS, outcomeSentence } from '../../pages/lessonlog/lessonLogCore';

const MAX_TEXT = 500;
const MAX_ITEMS = 20;

const normalize = (n) => ({
  pct: Number.isFinite(Number(n?.pct)) ? Math.max(0, Math.min(100, Math.round(Number(n.pct)))) : 80,
  outcome: n?.outcome || '',
  problems: Array.isArray(n?.problems) ? n.problems : [],
  fixes: Array.isArray(n?.fixes) ? n.fixes : [],
  extra: n?.extra || ''
});

const card = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm';
const chipBase = 'min-h-[44px] rounded-full border px-4 py-2 text-left text-sm transition-colors disabled:cursor-default';
const chipOn = 'border-brand-600 bg-brand-600 text-white';
const chipOff = 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50';

function ChipGroup({ suggestions, selected, onToggle, onAdd, disabled, addLabel }) {
  const custom = selected.filter((s) => !suggestions.includes(s));
  return (
    <div className="flex flex-wrap gap-2">
      {[...suggestions, ...custom].map((s) => {
        const on = selected.includes(s);
        return (
          <button key={s} type="button" aria-pressed={on} disabled={disabled} onClick={() => onToggle(s)}
            className={`${chipBase} ${on ? chipOn : chipOff}`}>
            {on && <span aria-hidden="true">{'✓ '}</span>}{s}
          </button>
        );
      })}
      {!disabled && (
        <button type="button" onClick={onAdd}
          className={`${chipBase} border-dashed border-gray-400 bg-white text-brand-600 hover:bg-gray-50`}>
          + {addLabel}
        </button>
      )}
    </div>
  );
}

export default function NoteEditor({ record, canEdit, settings, onSaved }) {
  const dialog = useDialog();
  const [note, setNote] = useState(() => normalize(record?.note));
  const [baseline, setBaseline] = useState(() => JSON.stringify(normalize(record?.note)));
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
    const n = normalize(record?.note);
    setNote(n);
    setBaseline(JSON.stringify(n));
    setError('');
    setMessage('');
  }, [record]);

  useEffect(() => () => clearTimeout(msgTimer.current), []);

  const dirty = useMemo(() => JSON.stringify(note) !== baseline, [note, baseline]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const patch = useCallback((p) => { setNote((n) => ({ ...n, ...p })); setMessage(''); }, []);

  const toggle = (key, value) => {
    const list = note[key];
    patch({ [key]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] });
  };

  const addCustom = async (key, title, placeholder) => {
    if (note[key].length >= MAX_ITEMS) {
      await dialog.alert({ title: 'เพิ่มไม่ได้', message: `เลือกได้ไม่เกิน ${MAX_ITEMS} ข้อ`, type: 'warning' });
      return;
    }
    const v = await dialog.prompt({
      title, label: 'ข้อความ', placeholder, confirmText: 'เพิ่ม',
      validate: (t) => {
        const s = (t || '').trim();
        if (!s) return 'พิมพ์ข้อความก่อน';
        if (s.length > MAX_TEXT) return `ยาวเกิน ${MAX_TEXT} ตัวอักษร`;
        return '';
      }
    });
    const s = (v || '').trim();
    if (!s || note[key].includes(s)) return;
    patch({ [key]: [...note[key], s] });
  };

  const save = async () => {
    if (saving || !canEdit) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const { data } = await assessmentAPI.updateRecord(record.id, { note, status: 'DONE' });
      setBaseline(JSON.stringify(note));
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

  if (!record) return null;
  const h = record.header || {};
  const live = { ...record, note };
  const disabled = !canEdit;

  const form = (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        แผนที่ {h.planNo} · หน่วยที่ {h.unitNo} {h.unitName} · สอนวันที่ {record.dateText}
      </div>

      {disabled && (
        <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">ดูได้อย่างเดียว — แก้ไขได้เฉพาะครูเจ้าของบันทึกหรือผู้ดูแล</div>
      )}

      <section className={card} aria-labelledby="ll-outcome">
        <h3 id="ll-outcome" className="mb-3 text-base font-semibold text-gray-900">ผลการเรียนรู้</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={disabled || note.pct <= 0} aria-label="ลดร้อยละ 5"
            onClick={() => patch({ pct: Math.max(0, note.pct - 5) })}
            className="h-12 w-12 rounded-xl border border-gray-300 bg-white text-2xl text-gray-800 hover:bg-gray-50 disabled:opacity-40">−</button>
          <span className="min-w-[4.5rem] text-center text-4xl font-bold tabular-nums text-gray-900" aria-live="polite">{note.pct}%</span>
          <button type="button" disabled={disabled || note.pct >= 100} aria-label="เพิ่มร้อยละ 5"
            onClick={() => patch({ pct: Math.min(100, note.pct + 5) })}
            className="h-12 w-12 rounded-xl border border-gray-300 bg-white text-2xl text-gray-800 hover:bg-gray-50 disabled:opacity-40">+</button>
          <span className="text-sm text-gray-600">ของนักเรียนทำได้</span>
        </div>
        <label htmlFor="ll-outcome-text" className="mt-4 block text-sm font-medium text-gray-700">นักเรียนทำอะไรได้</label>
        <textarea id="ll-outcome-text" rows={3} maxLength={MAX_TEXT} readOnly={disabled} value={note.outcome}
          onChange={(e) => patch({ outcome: e.target.value })}
          placeholder="เช่น จำแนกพืชดอกได้ถูกต้อง"
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30" />
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{outcomeSentence(record.name, note)}</p>
      </section>

      <section className={card} aria-labelledby="ll-problems">
        <h3 id="ll-problems" className="mb-3 text-base font-semibold text-gray-900">ปัญหา / อุปสรรค</h3>
        <ChipGroup suggestions={PROBLEM_SUGGESTIONS} selected={note.problems} disabled={disabled} addLabel="เพิ่มเอง"
          onToggle={(s) => toggle('problems', s)}
          onAdd={() => addCustom('problems', 'เพิ่มปัญหา / อุปสรรค', 'เช่น เครื่องฉายไม่ทำงาน')} />
      </section>

      <section className={card} aria-labelledby="ll-fixes">
        <h3 id="ll-fixes" className="mb-3 text-base font-semibold text-gray-900">ข้อเสนอแนะ / แนวทางแก้ไข</h3>
        <ChipGroup suggestions={FIX_SUGGESTIONS} selected={note.fixes} disabled={disabled} addLabel="เพิ่มเอง"
          onToggle={(s) => toggle('fixes', s)}
          onAdd={() => addCustom('fixes', 'เพิ่มข้อเสนอแนะ / แนวทางแก้ไข', 'เช่น ใช้สื่อของจริงประกอบ')} />
        <label htmlFor="ll-extra" className="mt-4 block text-sm font-medium text-gray-700">พิมพ์เพิ่มเอง (ไม่บังคับ)</label>
        <textarea id="ll-extra" rows={2} maxLength={MAX_TEXT} readOnly={disabled} value={note.extra}
          onChange={(e) => patch({ extra: e.target.value })}
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30" />
      </section>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  );

  return (
    <div className="pb-24 lg:pb-0">
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <div>
          {form}

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
