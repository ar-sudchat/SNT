import { t, tx } from '../../i18n';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { academicYearAPI, gradeAPI, classAPI, studentAPI, subjectAPI, teacherAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../components/ui/DialogProvider';
import { SmartComboBox } from '../../components/ui';
import PageHeader from '../../components/ui/PageHeader';
import SmartImport from '../ai/SmartImport';

const STEPS = [
  { key: 'year', label: 'ปี' },
  { key: 'grade', label: 'ชั้น' },
  { key: 'class', label: 'ห้อง' },
  { key: 'student', label: 'นักเรียน' },
  { key: 'subject', label: 'วิชา' },
  { key: 'done', label: 'เสร็จ' }
];

const PRESETS = [
  { label: 'ประถม', names: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'] },
  { label: 'มัธยมต้น', names: ['ม.1', 'ม.2', 'ม.3'] },
  { label: 'มัธยมปลาย', names: ['ม.4', 'ม.5', 'ม.6'] },
  { label: 'อนุบาล', names: ['อ.1', 'อ.2', 'อ.3'] }
];

const squash = (v) => String(v || '').replace(/[\s.]/g, '');
const toId = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const listOf = (res) => (Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.data) ? res.data.data : []);
const errText = (err, fallback) => err?.response?.data?.error || err?.response?.data?.message || fallback;

// Grades sort by their level prefix (อ. ป. ม.) then number, so lists read in school order.
const PREFIX_ORDER = { 'อ': 0, 'ป': 1, 'ม': 2 };
const gradeSort = (a, b) => {
  const pa = squash(a.gradeName), pb = squash(b.gradeName);
  const ra = PREFIX_ORDER[pa[0]] ?? 9, rb = PREFIX_ORDER[pb[0]] ?? 9;
  if (ra !== rb) return ra - rb;
  return pa.localeCompare(pb, 'th', { numeric: true });
};

const primaryBtn = 'inline-flex w-full sm:w-auto items-center justify-center min-h-[44px] rounded-lg bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryBtn = 'inline-flex items-center justify-center min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-gray-700 hover:bg-gray-50 disabled:opacity-50';
const linkBtn = 'inline-flex items-center justify-center min-h-[44px] px-3 text-sm text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline';
const inputCls = 'w-full min-h-[44px] rounded-lg border border-gray-300 px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

const Notice = ({ kind = 'ok', children }) => (
  <p role={kind === 'err' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-sm ${kind === 'err' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{children}</p>
);

const DoneBadge = () => <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">{t("ทำแล้ว")}</span>;

const Footer = ({ primary, onSkip, onBack, skipLabel = t('ข้าม') }) => (
  <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-1">
      {onBack && <button type="button" className={linkBtn} onClick={onBack}>{t("ย้อนกลับ")}</button>}
      {onSkip && <button type="button" className={linkBtn} onClick={onSkip}>{skipLabel}</button>}
    </div>
    {primary}
  </div>
);

export default function SetupWizard() {
  const { user } = useAuth();
  const dialog = useDialog();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ years: [], grades: [], classes: [], subjects: [], teachers: [], students: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind, text }

  const load = useCallback(async (opts = {}) => {
    const safe = (p) => p.catch(() => null);
    const [years, grades, classes, subjects, teachers, students] = await Promise.all([
      safe(academicYearAPI.getAll()), safe(gradeAPI.getAll()), safe(classAPI.getAll()),
      safe(subjectAPI.getAll()), safe(teacherAPI.getAll()), opts.students === false ? Promise.resolve(null) : safe(studentAPI.getAll())
    ]);
    if (!years && !grades) throw new Error('load');
    setData((d) => ({
      years: listOf(years), grades: listOf(grades), classes: listOf(classes), subjects: listOf(subjects), teachers: listOf(teachers),
      students: students ? listOf(students).length : d.students
    }));
  }, []);

  useEffect(() => {
    let alive = true;
    load().then(() => { if (alive) setLoading(false); })
      .catch(() => { if (alive) { setLoadError(t('โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง')); setLoading(false); } });
    return () => { alive = false; };
  }, [load]);

  const currentYear = useMemo(() => data.years.find((y) => y.isCurrent) || null, [data.years]);
  const grades = useMemo(() => [...data.grades].sort(gradeSort), [data.grades]);
  const done = useMemo(() => [
    !!currentYear, data.grades.length > 0, data.classes.length > 0, data.students > 0, data.subjects.length > 0, false
  ], [currentYear, data.grades, data.classes, data.students, data.subjects]);

  // Open on the first step that is not done yet (once, after the first load).
  const [positioned, setPositioned] = useState(false);
  useEffect(() => {
    if (loading || positioned) return;
    const first = done.findIndex((d, i) => i < 5 && !d);
    setStep(first === -1 ? 5 : first);
    setPositioned(true);
  }, [loading, positioned, done]);

  const go = (i) => { setMsg(null); setStep(Math.max(0, Math.min(5, i))); window.scrollTo?.({ top: 0 }); };
  const next = () => go(step + 1);
  const back = () => go(step - 1);
  const flash = (kind, text) => setMsg({ kind, text });

  // ---- step 1: academic year
  const [yearValue, setYearValue] = useState(String(new Date().getFullYear() + 543));
  const saveYear = async () => {
    const year = yearValue.trim();
    if (!/^\d{4}$/.test(year)) { flash('err', t('กรอกปีการศึกษาเป็นเลข 4 หลัก เช่น 2569')); return; }
    setBusy(true); setMsg(null);
    try {
      await academicYearAPI.create({ year, name: `ปีการศึกษา ${year}`, isCurrent: true });
      await load({ students: false });
      go(1);
    } catch (err) { flash('err', errText(err, t('สร้างปีการศึกษาไม่สำเร็จ ลองใหม่อีกครั้ง'))); }
    finally { setBusy(false); }
  };

  // ---- step 2: grades
  const [picked, setPicked] = useState([]);
  const [custom, setCustom] = useState('');
  const existingGradeKeys = useMemo(() => new Set(data.grades.map((g) => squash(g.gradeName))), [data.grades]);
  const toggleGrade = (name) => setPicked((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));
  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    if (existingGradeKeys.has(squash(name))) { flash('err', t("มีชั้น {name} อยู่แล้ว", { name: name })); return; }
    setPicked((p) => (p.some((n) => squash(n) === squash(name)) ? p : [...p, name]));
    setCustom(''); setMsg(null);
  };
  const presetNames = useMemo(() => new Set(PRESETS.flatMap((p) => p.names)), []);
  const customPicked = picked.filter((n) => !presetNames.has(n));
  const saveGrades = async () => {
    setBusy(true); setMsg(null);
    try {
      await gradeAPI.bulkCreate(picked.map((gradeName) => ({ gradeName })));
      await load({ students: false });
      setPicked([]);
      go(2);
    } catch (err) { flash('err', errText(err, t('บันทึกชั้นปีไม่สำเร็จ ลองใหม่อีกครั้ง'))); }
    finally { setBusy(false); }
  };

  // ---- step 3: classes
  const [rooms, setRooms] = useState({}); // gradeId -> count
  const usedRooms = useCallback((gradeName) => data.classes
    .map((c) => String(c.className || '').match(/^(.*)\/(\d+)$/))
    .filter((m) => m && squash(m[1]) === squash(gradeName))
    .map((m) => Number(m[2])), [data.classes]);
  const previewFor = useCallback((g) => {
    const count = Math.max(0, Math.min(20, rooms[g.id] || 0));
    const used = new Set(usedRooms(g.gradeName));
    return Array.from({ length: count }, (_, i) => i + 1).filter((n) => !used.has(n)).map((n) => `${g.gradeName}/${n}`);
  }, [rooms, usedRooms]);
  const classItems = useMemo(() => grades.flatMap((g) => previewFor(g).map((className) => ({
    className, gradeId: g.id, ...(currentYear ? { academicYearId: currentYear.id } : {})
  }))), [grades, previewFor, currentYear]);
  const setRoomCount = (id, n) => setRooms((r) => ({ ...r, [id]: Math.max(0, Math.min(20, n)) }));
  const saveClasses = async () => {
    setBusy(true); setMsg(null);
    try {
      await classAPI.bulkCreate(classItems);
      await load({ students: false });
      setRooms({});
      go(3);
    } catch (err) { flash('err', errText(err, t('สร้างห้องเรียนไม่สำเร็จ ลองใหม่อีกครั้ง'))); }
    finally { setBusy(false); }
  };

  // ---- step 5: subjects
  const [subjectText, setSubjectText] = useState('');
  const [subjectGrade, setSubjectGrade] = useState('');
  const [subjectTeacher, setSubjectTeacher] = useState('');
  const myTeacherId = toId(user?.teacher?.id);
  const teacherOptions = useMemo(() => {
    const list = [...data.teachers];
    if (myTeacherId && !list.some((t) => t.id === myTeacherId)) list.push({ id: myTeacherId, name: user?.teacher?.name || user?.name || t('ฉัน') });
    return list;
  }, [data.teachers, myTeacherId, user]);
  const selfSuffix = t(' (ฉัน)');
  const teacherValue = subjectTeacher !== '' ? subjectTeacher : String(myTeacherId ?? (teacherOptions.length === 1 ? teacherOptions[0].id : ''));
  const parsedSubjects = useMemo(() => {
    const rows = []; let bad = 0;
    subjectText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
      const m = line.match(/^(\S+)[\s,\t]+(.+)$/);
      if (m) rows.push({ subjectCode: m[1], subjectName: m[2].trim() }); else bad += 1;
    });
    return { rows, bad };
  }, [subjectText]);
  const saveSubjects = async () => {
    const teacherId = toId(teacherValue);
    if (!parsedSubjects.rows.length) { flash('err', t('พิมพ์วิชาอย่างน้อย 1 บรรทัด เช่น ท21101 ภาษาไทย')); return; }
    if (teacherId === null) { flash('err', t('เลือกครูผู้สอนก่อน')); return; }
    setBusy(true); setMsg(null);
    try {
      const gradeId = toId(subjectGrade);
      await subjectAPI.bulkCreate(parsedSubjects.rows.map((r) => ({
        ...r, teacherId, ...(gradeId !== null ? { gradeId } : {}), ...(currentYear ? { academicYearId: currentYear.id } : {})
      })));
      await load({ students: false });
      setSubjectText('');
      go(5);
    } catch (err) { flash('err', errText(err, t('บันทึกวิชาไม่สำเร็จ ลองใหม่อีกครั้ง'))); }
    finally { setBusy(false); }
  };

  const leaveStudents = async () => { await load().catch(() => {}); go(4); };

  const skip = async () => {
    if (step === 3) { await leaveStudents(); return; }
    if (step === 4 && parsedSubjects.rows.length) {
      const ok = await dialog.confirm({ title: t('ข้ามขั้นนี้?'), message: t('วิชาที่พิมพ์ไว้จะยังไม่ถูกบันทึก'), confirmText: t('ข้ามเลย'), cancelText: t('กลับไปบันทึก') });
      if (!ok) return;
    }
    next();
  };

  if (loading) return <div className="p-6 text-center text-gray-500" role="status">{t("กำลังโหลด…")}</div>;
  if (loadError) return <Notice kind="err">{loadError}</Notice>;

  const stepper = (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label={t("ขั้นตอนเริ่มต้นใช้งาน")}>
      {STEPS.map((s, i) => {
        const active = i === step;
        const ok = done[i] && !active;
        return (
          <li key={s.key} className="flex-1 min-w-[52px]">
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={active ? 'step' : undefined}
              className={`flex w-full min-h-[44px] flex-col items-center justify-center rounded-lg px-1 text-xs ${active ? 'bg-brand-600 text-white font-semibold' : ok ? 'bg-green-50 text-green-800' : 'bg-white text-gray-500 ring-1 ring-gray-200'}`}
            >
              <span className="text-sm leading-none">{ok ? '✓' : i + 1}</span>
              <span className="mt-0.5 leading-none">{t(s.label)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  const heading = (title, hint, isDone) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold text-gray-800">{`${step + 1}. ${title}`}</h2>
        {isDone && <DoneBadge />}
      </div>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
    </div>
  );

  let body = null;

  if (step === 0) {
    body = (
      <>
        {heading(t('ปีการศึกษา'), t('ปีที่ใช้งานอยู่ ใช้ผูกห้องเรียนและวิชา'), !!currentYear)}
        {currentYear ? (
          <div className="rounded-lg bg-green-50 p-4 text-green-900">
            <p className="font-semibold">{currentYear.name || t("ปีการศึกษา {value1}", { value1: currentYear.year })}</p>
            <p className="text-sm">{t("ใช้งานอยู่ ไม่ต้องตั้งเพิ่ม")}</p>
          </div>
        ) : (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">{t("ปีการศึกษา (พ.ศ.)")}</span>
            <input className={inputCls} inputMode="numeric" maxLength={4} value={yearValue} onChange={(e) => setYearValue(e.target.value.replace(/\D/g, ''))} />
          </label>
        )}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <Footer
          onSkip={skip}
          primary={currentYear
            ? <button type="button" className={primaryBtn} onClick={next}>{t("ถัดไป")}</button>
            : <button type="button" className={primaryBtn} onClick={saveYear} disabled={busy}>{busy ? t('กำลังบันทึก…') : t('ตั้งเป็นปีปัจจุบัน')}</button>}
        />
      </>
    );
  } else if (step === 1) {
    body = (
      <>
        {heading(t('ชั้นปี'), t('แตะเลือกชั้นที่โรงเรียนมี แล้วกดบันทึก'), data.grades.length > 0)}
        {PRESETS.map((p) => (
          <div key={p.label} className="space-y-1">
            <p className="text-sm font-medium text-gray-600">{t(p.label)}</p>
            <div className="flex flex-wrap gap-2">
              {p.names.map((n) => {
                const exists = existingGradeKeys.has(squash(n));
                const on = picked.includes(n);
                return (
                  <button
                    key={n} type="button" disabled={exists} aria-pressed={on || exists}
                    onClick={() => toggleGrade(n)}
                    className={`min-h-[44px] min-w-[56px] rounded-full px-4 text-sm ${exists ? 'bg-green-100 text-green-800' : on ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:ring-brand-400'}`}
                  >{exists ? `✓ ${n}` : n}</button>
                );
              })}
            </div>
          </div>
        ))}
        {(customPicked.length > 0 || data.grades.some((g) => !PRESETS.some((p) => p.names.some((n) => squash(n) === squash(g.gradeName))))) && (
          <div className="flex flex-wrap gap-2">
            {data.grades.filter((g) => !PRESETS.some((p) => p.names.some((n) => squash(n) === squash(g.gradeName)))).map((g) => (
              <span key={g.id} className="inline-flex min-h-[44px] items-center rounded-full bg-green-100 px-4 text-sm text-green-800">✓ {g.gradeName}</span>
            ))}
            {customPicked.map((n) => (
              <button key={n} type="button" aria-pressed="true" onClick={() => toggleGrade(n)} className="min-h-[44px] rounded-full bg-brand-600 px-4 text-sm text-white">{n} ✕</button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            className={inputCls} placeholder={t("ชั้นอื่น เช่น ปวช.1")} value={custom} maxLength={50}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            aria-label={t("ชื่อชั้นอื่น")}
          />
          <button type="button" className={secondaryBtn} onClick={addCustom}>{t("เพิ่ม")}</button>
        </div>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <Footer
          onBack={back} onSkip={skip}
          primary={picked.length > 0
            ? <button type="button" className={primaryBtn} onClick={saveGrades} disabled={busy}>{busy ? t('กำลังบันทึก…') : t("บันทึกชั้นปี ({value1})", { value1: picked.length })}</button>
            : <button type="button" className={primaryBtn} onClick={next} disabled={data.grades.length === 0}>{t("ถัดไป")}</button>}
        />
      </>
    );
  } else if (step === 2) {
    body = (
      <>
        {heading(t('ห้องเรียน'), t('บอกจำนวนห้องของแต่ละชั้น ระบบตั้งชื่อให้ เช่น ป.4/1 ป.4/2'), data.classes.length > 0)}
        {grades.length === 0 ? (
          <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{t("ยังไม่มีชั้นปี กลับไปขั้นที่ 2 เพื่อเลือกชั้นก่อน")}</div>
        ) : (
          <ul className="space-y-3">
            {grades.map((g) => {
              const count = rooms[g.id] || 0;
              const existing = usedRooms(g.gradeName).length;
              const preview = previewFor(g);
              return (
                <li key={g.id} className="rounded-lg bg-white p-3 ring-1 ring-gray-200">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800">{g.gradeName}</p>
                      <p className="text-xs text-gray-500">{existing > 0 ? t("มีแล้ว {existing} ห้อง", { existing: existing }) : t('ยังไม่มีห้อง')}</p>
                    </div>
                    <div className="flex items-center gap-1" role="group" aria-label={t("จำนวนห้อง {value1}", { value1: g.gradeName })}>
                      <button type="button" className={`${secondaryBtn} w-11 px-0`} aria-label={t("ลดจำนวนห้อง")} onClick={() => setRoomCount(g.id, count - 1)} disabled={count <= 0}>−</button>
                      <input
                        className="min-h-[44px] w-14 rounded-lg border border-gray-300 text-center" inputMode="numeric" aria-label={t("จำนวนห้อง")}
                        value={count} onChange={(e) => setRoomCount(g.id, Number(e.target.value.replace(/\D/g, '')) || 0)}
                      />
                      <button type="button" className={`${secondaryBtn} w-11 px-0`} aria-label={t("เพิ่มจำนวนห้อง")} onClick={() => setRoomCount(g.id, count + 1)} disabled={count >= 20}>+</button>
                    </div>
                  </div>
                  {count > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      {preview.length ? preview.join('  ') : t('มีครบตามจำนวนนี้แล้ว')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <Footer
          onBack={back} onSkip={skip}
          primary={classItems.length > 0
            ? <button type="button" className={primaryBtn} onClick={saveClasses} disabled={busy}>{busy ? t('กำลังสร้าง…') : t("สร้างห้องเรียน ({value1} ห้อง)", { value1: classItems.length })}</button>
            : <button type="button" className={primaryBtn} onClick={next} disabled={data.classes.length === 0}>{t("ถัดไป")}</button>}
        />
      </>
    );
  } else if (step === 3) {
    body = (
      <>
        {heading(t('นักเรียน'), t('ส่งไฟล์รายชื่อ Excel หรือ CSV ระบบจับคอลัมน์ให้เอง'), data.students > 0)}
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-gray-700">{tx('ห้องจับคู่จาก<b>ชื่อห้อง</b> เช่น ป.4/1 ถ้ายังไม่มีห้องนั้น ระบบจะสร้างให้ตอนนำเข้า', { b: (c) => <strong>{c}</strong> })}{data.students > 0 ? t(' · ตอนนี้มีนักเรียน {n} คน', { n: data.students }) : ''}</p>
        <SmartImport />
        <Footer
          onBack={back} onSkip={skip} skipLabel={t("ข้ามขั้นนี้")}
          primary={<button type="button" className={secondaryBtn} onClick={leaveStudents}>{t("ไปขั้นถัดไป")}</button>}
        />
      </>
    );
  } else if (step === 4) {
    body = (
      <>
        {heading(t('วิชา'), t('พิมพ์รหัสแล้วเว้นวรรคตามด้วยชื่อวิชา บรรทัดละวิชา'), data.subjects.length > 0)}
        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">{t("รายการวิชา")}</span>
          <textarea
            className={`${inputCls} min-h-[140px] py-2 font-mono`} value={subjectText}
            onChange={(e) => setSubjectText(e.target.value)}
            placeholder={t('ท21101 ภาษาไทย\nค21101 คณิตศาสตร์\nว21101 วิทยาศาสตร์')}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">{t("ชั้นปี (ไม่บังคับ)")}</span>
            <SmartComboBox
              options={grades.map((g) => ({ value: String(g.id), label: g.gradeName }))}
              value={subjectGrade}
              onChange={(v) => setSubjectGrade(v ?? '')}
              placeholder={t("ไม่ระบุ")}
              ariaLabel={t("ชั้นปี")}
            />
          </div>
          <div className="block space-y-1">
            <span className="text-sm font-medium text-gray-700">{t("ครูผู้สอน")}</span>
            <SmartComboBox
              options={teacherOptions.map((t) => ({ value: String(t.id), label: `${t.name}${t.id === myTeacherId ? selfSuffix : ''}` }))}
              value={teacherValue}
              onChange={(v) => v && setSubjectTeacher(v)}
              placeholder={t("เลือกครู")}
              clearable={false}
              ariaLabel={t("ครูผู้สอน")}
            />
          </div>
        </div>
        {parsedSubjects.rows.length > 0 && <p className="text-sm text-gray-600">{t("จะเพิ่ม {value1} วิชา", { value1: parsedSubjects.rows.length })}</p>}
        {parsedSubjects.bad > 0 && <Notice kind="err">{t("{value1} บรรทัดไม่มีชื่อวิชา จะถูกข้าม", { value1: parsedSubjects.bad })}</Notice>}
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <Footer
          onBack={back} onSkip={skip}
          primary={parsedSubjects.rows.length > 0
            ? <button type="button" className={primaryBtn} onClick={saveSubjects} disabled={busy}>{busy ? t('กำลังบันทึก…') : t("บันทึกวิชา ({value1})", { value1: parsedSubjects.rows.length })}</button>
            : <button type="button" className={primaryBtn} onClick={next} disabled={data.subjects.length === 0}>{t("ถัดไป")}</button>}
        />
      </>
    );
  } else {
    const rows = [
      ['ปีการศึกษา', currentYear ? (currentYear.name || currentYear.year) : t('ยังไม่ได้ตั้ง')],
      ['ชั้นปี', t("{value1} ชั้น", { value1: data.grades.length })],
      ['ห้องเรียน', t("{value1} ห้อง", { value1: data.classes.length })],
      ['นักเรียน', t("{value1} คน", { value1: data.students })],
      ['วิชา', t("{value1} วิชา", { value1: data.subjects.length })]
    ];
    body = (
      <>
        {heading(t('พร้อมใช้งานแล้ว'), t('ตรวจสิ่งที่ตั้งไว้ แล้วเริ่มใช้งานได้เลย'))}
        <dl className="divide-y divide-gray-100 rounded-lg bg-white ring-1 ring-gray-200">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-3">
              <dt className="text-gray-600">{t(k)}</dt>
              <dd className="font-semibold text-gray-800">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link to="/lesson-log" className={secondaryBtn}>{t("บันทึกหลังแผน")}</Link>
          <Link to="/admin/settings" className={secondaryBtn}>{t("ตั้งค่าระบบ")}</Link>
        </div>
        <Footer
          onBack={back}
          primary={<Link to="/monitor" className={primaryBtn}>{t("ไปหน้าติดตามงาน")}</Link>}
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24 sm:pb-6">
      <PageHeader title={t("เริ่มต้นใช้งาน")} subtitle={t("ตั้งค่าทีละขั้นในหน้าเดียว ขั้นไหนไม่พร้อมกด “ข้าม” แล้วกลับมาทำทีหลังได้")} />
      {stepper}
      <section className="space-y-4 rounded-xl bg-gray-50 p-4 ring-1 ring-gray-100" aria-live="polite">
        {body}
      </section>
    </div>
  );
}
