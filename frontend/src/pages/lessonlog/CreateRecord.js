import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import useLessonContext from './useLessonContext';
import LessonContextBar from './LessonContextBar';
import ThaiDatePicker, { toIso } from '../../components/ui/ThaiDatePicker';
import { thaiShortDate, RESPONSE_TYPES, SCOPE_LABEL, scopeOf, responseOf } from './lessonLogCore';

// /lesson-log/new — เลือกประเภทการประเมิน แล้วตั้งชื่อเอง
const errText = (e, fallback) => e?.response?.data?.error || fallback;

const inputCls = 'mt-1 block w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500';
const labelCls = 'block text-sm font-medium text-gray-700';
const dayValue = (d) => ({ text: thaiShortDate(d), dates: [toIso(d)] });
const chipCls = (on) => `min-h-[44px] max-w-full rounded-full border px-4 py-2 text-left text-sm break-words ${on
  ? 'border-brand-600 bg-brand-50 font-medium text-brand-800'
  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;

const nextNumber = (v) => {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? String(n + 1) : '';
};

// "รายนักเรียน · 5 รายการ · ผ่าน / ไม่ผ่าน" — how the form is done, in teacher words.
function templateSub(t) {
  const scope = scopeOf(t);
  const nQ = (t.classFields || []).length;
  const nC = (t.criteria || []).length;
  const rt = RESPONSE_TYPES.find(x => x.id === responseOf(t));
  const resp = rt ? rt.label.replace('1–N', `1–${t.maxScore || 'N'}`) : '';
  if (t.kind === 'NOTE') return `${SCOPE_LABEL.CLASS} · ข้อความ มีช่องลงชื่อ`;
  if (t.kind === 'CLASS') return `${SCOPE_LABEL.CLASS} · ${nQ} คำถาม`;
  const students = `${nC} รายการ · ${resp}`;
  return scope === 'BOTH' ? `${SCOPE_LABEL.BOTH} · ${nQ} คำถาม · ${students}` : `${SCOPE_LABEL.STUDENT} · ${students}`;
}

// embedded = เปิดใน popup จากหน้าบันทึกหลังแผน (ใช้ ctx เดียวกับหน้านั้น)
// onDone(ids) = เรียกเมื่อสร้างหลายห้องเสร็จ (popup ปิดเอง) · ห้องเดียวไปหน้าบันทึกเหมือนเดิม
const CreateRecord = ({ ctx: outerCtx, embedded = false, onDone }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const ownCtx = useLessonContext();
  const ctx = outerCtx || ownCtx;
  const { cls, classId, subjectId } = ctx;
  // ห้องที่จะสร้างบันทึกให้ (หลายห้องได้ ห้องละ 1 บันทึก)
  const [roomIds, setRoomIds] = useState(() => (classId ? [classId] : []));
  useEffect(() => { if (classId && roomIds.length === 0) setRoomIds([classId]); }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState('');
  const [templateId, setTemplateId] = useState(() => {
    const n = parseInt(params.get('templateId'), 10);
    return Number.isFinite(n) ? n : null;
  });

  // Records of this class: recent names for name chips + last NOTE header for prefill.
  const [history, setHistory] = useState([]);
  const [lastNoteHeader, setLastNoteHeader] = useState(null);

  const [name, setName] = useState('');
  // วันที่ = { text: ข้อความแสดง, dates: ['YYYY-MM-DD'] วันจริงที่ส่งไป server }
  const [rubricDate, setRubricDate] = useState(() => dayValue(new Date()));
  const [noteDate, setNoteDate] = useState({ text: '', dates: [] });
  const [head, setHead] = useState({ planNo: '', unitNo: '', unitName: '' });
  const headTouched = useRef(false);

  const [nameError, setNameError] = useState('');
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);

  // Templates
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await assessmentAPI.templates();
        if (cancelled) return;
        const list = res.data || [];
        setTemplates(list);
        setTemplateId(prev => (list.some(t => t.id === prev) ? prev : (list[0] ? list[0].id : null)));
      } catch (e) {
        if (!cancelled) setTemplatesError(errText(e, 'โหลดแบบประเมินไม่สำเร็จ'));
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Class history -> name chips + prefill from the last NOTE record.
  useEffect(() => {
    if (!classId) return undefined;
    let cancelled = false;
    setHistory([]);
    setLastNoteHeader(null);
    (async () => {
      try {
        const res = await assessmentAPI.records({ classId });
        if (cancelled) return;
        const list = res.data || [];
        setHistory(list.map(r => ({ kind: r.kind, name: String(r.name || '').trim() })));
        const lastNote = list.find(r => r.kind === 'NOTE');
        if (lastNote) {
          let header = lastNote.header;
          if (!header) {
            const full = await assessmentAPI.record(lastNote.id);
            header = full.data?.header;
          }
          if (!cancelled && header) setLastNoteHeader(header);
        }
      } catch (e) {
        // History is only a convenience; the form still works without it.
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  // Prefill the NOTE header once, unless the teacher already typed into it.
  useEffect(() => {
    if (!lastNoteHeader || headTouched.current) return;
    setHead({
      planNo: nextNumber(lastNoteHeader.planNo),
      unitNo: String(lastNoteHeader.unitNo ?? ''),
      unitName: String(lastNoteHeader.unitName ?? '')
    });
  }, [lastNoteHeader]);

  const template = useMemo(() => templates.find(t => t.id === templateId) || null, [templates, templateId]);
  const isNote = template?.kind === 'NOTE';
  const isClass = template?.kind === 'CLASS';
  const nameLabel = isNote ? 'ชื่อแผน' : isClass ? 'ชื่อเรื่อง' : (template?.key === 'work' ? 'ชื่อชิ้นงาน/ภาระงาน' : 'ชื่อกิจกรรม');
  const namePlaceholder = isNote ? 'เช่น ศึกษากลุ่มพืชดอก' : isClass ? 'เช่น สรุปการสอนสัปดาห์นี้' : 'เช่น การจำแนกประเภทของพืช';
  const recentNames = useMemo(() => {
    const kind = isClass ? 'CLASS' : 'RUBRIC';
    const seen = new Set();
    const names = [];
    history.filter(r => r.kind === kind).forEach(r => {
      if (r.name && !seen.has(r.name) && names.length < 3) { seen.add(r.name); names.push(r.name); }
    });
    return names;
  }, [history, isClass]);
  const studentCount = cls?._count?.students ?? cls?.studentCount ?? null;

  const now = new Date();
  const todayV = dayValue(now);
  const yesterdayV = dayValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const today = todayV.text;
  const yesterday = yesterdayV.text;

  const setHeadField = (k, v) => {
    headTouched.current = true;
    setHead(h => ({ ...h, [k]: v }));
  };

  const pickTemplate = (id) => {
    setTemplateId(id);
    setNameError('');
    setServerError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy || !template) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(isNote ? 'กรอกชื่อแผนก่อนเริ่มบันทึก' : isClass ? 'กรอกชื่อเรื่องก่อนเริ่มบันทึก' : `กรอก${nameLabel}ก่อนเริ่มประเมิน`);
      if (nameRef.current) nameRef.current.focus();
      return;
    }
    if (!roomIds.length) { setServerError('เลือกห้องเรียนอย่างน้อย 1 ห้อง'); return; }
    setBusy(true);
    setServerError('');
    const created = [];
    try {
      const body = {
        templateId: template.id,
        classId,
        subjectId: subjectId || undefined,
        name: trimmed,
        dateText: (isNote ? noteDate : rubricDate).text.trim(),
        dates: (isNote ? noteDate : rubricDate).dates
      };
      if (isNote) {
        body.header = {
          planNo: head.planNo.trim(),
          unitNo: head.unitNo.trim(),
          unitName: head.unitName.trim()
        };
      }
      for (const id of roomIds) {
        const res = await assessmentAPI.createRecord({ ...body, classId: id });
        created.push(res.data.id);
      }
      if (created.length === 1) navigate(`/lesson-log/${created[0]}`, { replace: !embedded });
      else if (onDone) onDone(created);
      else navigate('/lesson-log', { replace: true });
    } catch (err) {
      const done = created.length ? `สร้างแล้ว ${created.length} ห้อง ` : '';
      setServerError(done + errText(err, 'สร้างบันทึกไม่สำเร็จ ลองอีกครั้ง'));
      setBusy(false);
    }
  };

  const box = embedded ? 'w-full p-4' : 'mx-auto w-full max-w-5xl';

  if (ctx.loading || templatesLoading) {
    return <div className={`${box} py-10 text-center text-gray-500`} role="status">กำลังโหลด…</div>;
  }

  if (ctx.error || templatesError) {
    return (
      <div className={`${box} rounded-lg border border-red-200 bg-red-50 p-4 text-red-700`} role="alert">
        {ctx.error || templatesError}
      </div>
    );
  }

  if (!cls) {
    return (
      <div className={box}>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h1 className="font-display text-lg font-semibold text-gray-900">ยังไม่ได้เลือกห้องเรียน</h1>
          <p className="mt-1 text-gray-600">เลือกห้องก่อน แล้วค่อยสร้างบันทึกหลังแผน</p>
          <Link to="/lesson-log" className="mt-4 inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 bg-white px-4 font-medium text-brand-700 hover:bg-gray-50">
            ไปเลือกห้องเรียน
          </Link>
        </div>
      </div>
    );
  }

  const primaryLabel = isNote
    ? 'เริ่มบันทึกผลหลังการสอน'
    : isClass ? 'เริ่มบันทึก'
    : `เริ่มประเมิน${studentCount !== null && roomIds.length <= 1 ? ` · ${studentCount} คน` : ''}`;
  const submitLabel = roomIds.length > 1 ? `${primaryLabel} · ${roomIds.length} ห้อง` : primaryLabel;
  const dateValue = isNote ? noteDate : rubricDate;
  const setDateValue = isNote ? setNoteDate : setRubricDate;

  return (
    <form onSubmit={submit} noValidate className={box}>
      <div className="mb-4">
        {!embedded && <h1 className="mb-3 font-display text-xl font-semibold text-gray-900">สร้างบันทึก / แบบประเมิน</h1>}
        <LessonContextBar ctx={ctx} allSubjectsLabel="ไม่ระบุวิชา" roomIds={roomIds} onRoomIdsChange={setRoomIds} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        {/* 1. ประเภท */}
        <section aria-labelledby="ll-step1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="ll-step1" className="text-sm font-semibold text-gray-700">1. เลือกประเภทการประเมิน</h2>
            <Link to="/lesson-log/templates" className="inline-flex min-h-[44px] items-center text-sm font-medium text-brand-700 hover:underline">จัดการแบบประเมิน</Link>
          </div>
          {templates.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-gray-600">
              ยังไม่มีแบบประเมินที่ใช้งานได้ <Link to="/lesson-log/templates" className="font-medium text-brand-700 hover:underline">เพิ่มแบบประเมิน</Link>
            </div>
          ) : (
            <div role="radiogroup" aria-labelledby="ll-step1" className="space-y-2">
              {templates.map(t => {
                const on = t.id === templateId;
                const sub = templateSub(t);
                return (
                  <label
                    key={t.id}
                    className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${on ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={t.id}
                      checked={on}
                      onChange={() => pickTemplate(t.id)}
                      className="h-5 w-5 shrink-0 accent-brand-600"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-gray-900">{t.name}</span>
                      <span className="block text-sm text-gray-600">{sub}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. ตั้งชื่อ */}
        <section aria-labelledby="ll-step2">
          <h2 id="ll-step2" className="mb-2 text-sm font-semibold text-gray-700">2. ตั้งชื่อเอง</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            {isNote ? (
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  แผนที่
                  <input
                    className={inputCls}
                    value={head.planNo}
                    onChange={(e) => setHeadField('planNo', e.target.value)}
                    inputMode="numeric"
                    placeholder="3"
                  />
                </label>
                <label className={labelCls}>
                  หน่วยที่
                  <input
                    className={inputCls}
                    value={head.unitNo}
                    onChange={(e) => setHeadField('unitNo', e.target.value)}
                    inputMode="numeric"
                    placeholder="1"
                  />
                </label>
                <label className={`${labelCls} col-span-2`}>
                  {nameLabel}
                  <input
                    ref={nameRef}
                    className={`${inputCls} ${nameError ? 'border-red-400' : ''}`}
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                    placeholder={namePlaceholder}
                    aria-invalid={nameError ? 'true' : undefined}
                    aria-describedby={nameError ? 'll-name-err' : undefined}
                  />
                  {nameError && <span id="ll-name-err" className="mt-1 block text-sm text-red-600">{nameError}</span>}
                </label>
                <label className={`${labelCls} col-span-2`}>
                  ชื่อหน่วย
                  <input
                    className={inputCls}
                    value={head.unitName}
                    onChange={(e) => setHeadField('unitName', e.target.value)}
                    placeholder="เช่น ความหลากหลายของสิ่งมีชีวิต"
                  />
                </label>
                <div className="col-span-2">
                  <label htmlFor="ll-note-date" className={labelCls}>วัน/เดือน/ปีที่สอน</label>
                  <ThaiDatePicker id="ll-note-date" value={noteDate.text} dates={noteDate.dates} onChange={(text, dates) => setNoteDate({ text, dates })} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className={`${labelCls} block`}>
                  {nameLabel}
                  <input
                    ref={nameRef}
                    className={`${inputCls} ${nameError ? 'border-red-400' : ''}`}
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
                    placeholder={namePlaceholder}
                    aria-invalid={nameError ? 'true' : undefined}
                    aria-describedby={nameError ? 'll-name-err' : undefined}
                  />
                  {nameError && <span id="ll-name-err" className="mt-1 block text-sm text-red-600">{nameError}</span>}
                </label>

                {recentNames.length > 0 && (
                  <div>
                    <p className={labelCls}>ใช้ชื่อที่เคยตั้ง</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {recentNames.map(n => (
                        <button
                          key={n}
                          type="button"
                          aria-pressed={name.trim() === n}
                          onClick={() => { setName(n); setNameError(''); }}
                          className={chipCls(name.trim() === n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className={labelCls}>{isClass ? 'วันที่บันทึก' : 'วันที่ประเมิน'}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <button type="button" aria-pressed={dateValue.text === today} onClick={() => setDateValue(todayV)} className={chipCls(dateValue.text === today)}>
                      วันนี้ {today}
                    </button>
                    <button type="button" aria-pressed={dateValue.text === yesterday} onClick={() => setDateValue(yesterdayV)} className={chipCls(dateValue.text === yesterday)}>
                      เมื่อวาน {yesterday}
                    </button>
                  </div>
                  <div className="mt-3">
                    <label htmlFor="ll-other-date" className="block text-sm text-gray-600">วันอื่น (เลือกได้หลายวันหรือเป็นช่วง)</label>
                    <ThaiDatePicker id="ll-other-date" value={dateValue.text} dates={dateValue.dates} onChange={(text, dates) => setDateValue({ text, dates })} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {serverError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{serverError}</p>
          )}

          {/* ปุ่มหลัก: ลอยเหนือแถบล่างบนมือถือ, อยู่ใต้ฟอร์มบน lg */}
          <div
            className={embedded
              ? 'sticky bottom-0 z-20 -mx-4 mt-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0'
              : 'sticky z-20 -mx-3 mt-4 border-t border-gray-200 bg-white/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none'}
            style={embedded ? undefined : { bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
          >
            <button
              type="submit"
              disabled={busy || !template || !roomIds.length}
              className="min-h-[48px] w-full rounded-lg bg-brand-600 px-4 font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'กำลังสร้าง…' : submitLabel}
            </button>
          </div>
        </section>
      </div>
    </form>
  );
};

export default CreateRecord;
