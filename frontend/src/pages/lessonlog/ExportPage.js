import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import { useDialog } from '../../components/ui/DialogProvider';
import PaperPreview from '../../components/lessonlog/PaperPreview';
import useLessonContext from './useLessonContext';
import { RESPONSE_TYPES, SCOPE_LABEL, scopeOf, shortName } from './lessonLogCore';

const PRIMARY = 'min-h-[44px] rounded-xl px-5 py-2.5 font-medium bg-primary !text-primary-fg disabled:opacity-50';
const LINK = 'inline-flex items-center min-h-[44px] text-sm text-brand-700 underline';

// A failed blob request carries its JSON error as a Blob; read it to show the Thai message.
async function blobError(e, fallback) {
  try {
    const data = e.response?.data;
    if (data instanceof Blob) {
      const text = await data.text();
      const msg = JSON.parse(text)?.error;
      if (msg) return msg;
    } else if (data?.error) {
      return data.error;
    }
  } catch { /* not JSON */ }
  return fallback;
}

// "ระดับห้อง" / "รายนักเรียน · ผ่าน / ไม่ผ่าน" — how the form was done.
function formatLabel(r) {
  const scope = scopeOf(r);
  const rt = RESPONSE_TYPES.find(x => x.id === r.responseType);
  return scope === 'CLASS' || !rt ? SCOPE_LABEL[scope] : `${SCOPE_LABEL[scope]} · ${rt.label}`;
}

export default function ExportPage() {
  const dialog = useDialog();
  const { classId, subjectId, cls, subject, loading: ctxLoading, error: ctxError } = useLessonContext();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [settings, setSettings] = useState(null);
  const [details, setDetails] = useState({});
  const [exporting, setExporting] = useState(false);

  // DONE records of this class (+ subject), all checked at first.
  useEffect(() => {
    if (!classId) return undefined;
    let cancelled = false;
    setLoading(true); setError('');
    assessmentAPI.records({ classId, subjectId: subjectId || undefined, status: 'DONE' })
      .then(r => {
        if (cancelled) return;
        const list = r.data || [];
        setRecords(list);
        setPicked(new Set(list.map(x => x.id)));
      })
      .catch(e => { if (!cancelled) setError(e.response?.data?.error || 'โหลดรายการไม่สำเร็จ'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId, subjectId]);

  useEffect(() => {
    assessmentAPI.settings().then(r => setSettings(r.data)).catch(() => { /* preview falls back to no settings */ });
  }, []);

  const types = useMemo(() => {
    const seen = new Map();
    records.forEach(r => { if (!seen.has(r.templateKey)) seen.set(r.templateKey, shortName({ key: r.templateKey, templateName: r.templateName })); });
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }, [records]);

  const visible = typeFilter === 'ALL' ? records : records.filter(r => r.templateKey === typeFilter);
  // Newest first, same as the list from the server.
  const checkedIds = records.filter(r => picked.has(r.id)).map(r => r.id);
  const previewIds = checkedIds.slice(0, 2);
  const previewKey = previewIds.join(',');

  // Fetch details for the first 2 checked records (cache by id).
  useEffect(() => {
    const need = previewIds.filter(id => !details[id]);
    if (!need.length) return undefined;
    let cancelled = false;
    Promise.all(need.map(id => assessmentAPI.record(id).then(r => [id, r.data]).catch(() => null)))
      .then(rows => {
        if (cancelled) return;
        setDetails(prev => {
          const next = { ...prev };
          rows.forEach(row => { if (row) next[row[0]] = row[1]; });
          return next;
        });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey]);

  const toggle = (id) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectVisible = () => setPicked(prev => new Set([...prev, ...visible.map(r => r.id)]));
  const clearVisible = () => setPicked(prev => {
    const next = new Set(prev);
    visible.forEach(r => next.delete(r.id));
    return next;
  });

  const doExport = async () => {
    if (!checkedIds.length || exporting) return;
    setExporting(true); setError('');
    try {
      const r = await assessmentAPI.exportDocx(checkedIds);
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `บันทึกหลังแผน-${cls?.className || 'ห้องเรียน'}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = await blobError(e, 'ส่งออกไม่สำเร็จ ลองใหม่อีกครั้ง');
      await dialog.alert({ title: 'ส่งออกไม่สำเร็จ', message: msg, type: 'danger' });
    } finally {
      setExporting(false);
    }
  };

  const contextLabel = cls ? `${cls.className} · ${subject ? subject.subjectName : 'ทุกวิชา'}` : '';
  const exportLabel = exporting ? 'กำลังสร้างไฟล์…' : `ส่งออก Word · ${checkedIds.length} รายการ`;
  const chip = (active) => `min-h-[44px] rounded-full px-4 text-sm border ${active ? 'bg-brand-600 border-brand-600 !text-white' : 'bg-white border-gray-300 text-gray-700'}`;

  const previews = previewIds.map(id => details[id]).filter(Boolean);

  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Link to="/lesson-log" className={LINK}>‹ บันทึกหลังแผน</Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ส่งออกเป็น Word</h1>
        </div>
        {/* Primary action sits in the header on computer; phones use the sticky bar below. */}
        <button onClick={doExport} disabled={!checkedIds.length || exporting} className={`${PRIMARY} hidden lg:inline-flex items-center`}>
          {exportLabel}
        </button>
      </div>

      {ctxError && <div className="rounded-xl bg-fail/10 p-3 text-sm text-fail" role="alert">{ctxError}</div>}
      {error && <div className="rounded-xl bg-fail/10 p-3 text-sm text-fail" role="alert">{error}</div>}

      {cls && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
          <div className="min-w-0">
            <div className="text-xs text-gray-500">กำลังดู</div>
            <div className="font-medium text-gray-800 truncate">{contextLabel}</div>
          </div>
          <Link to="/lesson-log" className={`${LINK} shrink-0`}>เปลี่ยน</Link>
        </div>
      )}

      {!ctxLoading && !cls && !ctxError && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 space-y-1">
          <p className="font-medium text-gray-800">ยังไม่มีห้องเรียน</p>
          <p className="text-sm text-gray-500">เพิ่มห้องเรียนและนักเรียนก่อน แล้วค่อยกลับมาส่งออก</p>
          <Link to="/lesson-log" className={LINK}>กลับไปบันทึกหลังแผน</Link>
        </div>
      )}

      {cls && !loading && records.length === 0 && !error && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 space-y-1">
          <p className="font-medium text-gray-800">ยังไม่มีรายการที่บันทึกแล้วของ {contextLabel}</p>
          <p className="text-sm text-gray-500">บันทึกรายการให้เสร็จก่อน (กด บันทึก) จึงจะส่งออกเป็น Word ได้</p>
          <Link to="/lesson-log" className={LINK}>ไปที่รายการบันทึก</Link>
        </div>
      )}

      {(loading || ctxLoading) && <p className="text-sm text-gray-500" role="status">กำลังโหลด…</p>}

      {records.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <section className="space-y-3 min-w-0">
            <p className="text-sm text-gray-600">เลือกรายการที่จะรวมเป็นไฟล์เดียว ระบบเรียงตามวันที่ ฟอนต์ TH SarabunPSK กระดาษ A4</p>

            {types.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="กรองตามประเภท">
                <button type="button" onClick={() => setTypeFilter('ALL')} aria-pressed={typeFilter === 'ALL'} className={chip(typeFilter === 'ALL')}>ทั้งหมด {records.length}</button>
                {types.map(t => (
                  <button key={t.key} type="button" onClick={() => setTypeFilter(t.key)} aria-pressed={typeFilter === t.key} className={chip(typeFilter === t.key)}>
                    {t.label} {records.filter(r => r.templateKey === t.key).length}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-4">
              <button type="button" onClick={selectVisible} className={LINK}>เลือกทั้งหมด</button>
              <button type="button" onClick={clearVisible} className={LINK}>ไม่เลือก</button>
              <span className="text-sm text-gray-500 ml-auto">เลือก {checkedIds.length} จาก {records.length}</span>
            </div>

            <ul className="space-y-2">
              {visible.map(r => (
                <li key={r.id}>
                  <label className="flex items-start gap-3 min-h-[44px] rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100 cursor-pointer">
                    <input
                      type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-gray-800 break-words">{r.name}</span>
                      <span className="block text-sm text-gray-500">{shortName({ key: r.templateKey, templateName: r.templateName })} · {formatLabel(r)}{r.dateText ? ` · ${r.dateText}` : ''}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 min-w-0">
            <p className="text-sm font-medium text-gray-700">ตัวอย่าง 2 รายการล่าสุดที่เลือก</p>
            {previewIds.length === 0 && <p className="text-sm text-gray-500">ยังไม่ได้เลือกรายการ</p>}
            {previewIds.length > 0 && previews.length < previewIds.length && <p className="text-sm text-gray-500" role="status">กำลังโหลดตัวอย่าง…</p>}
            <div className="space-y-4">
              {previews.map(rec => (
                <div key={rec.id} className="overflow-x-auto">
                  <PaperPreview record={rec} settings={settings} />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {records.length > 0 && (
        <div
          className="sticky z-10 -mx-3 sm:-mx-4 border-t border-gray-200 bg-white/95 p-3 backdrop-blur lg:hidden bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
        >
          <button onClick={doExport} disabled={!checkedIds.length || exporting} className={`${PRIMARY} w-full`}>
            {exportLabel}
          </button>
        </div>
      )}
    </div>
  );
}
