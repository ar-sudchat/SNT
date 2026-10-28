import { t } from '../../i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI, classAPI } from '../../services/api';
import { PageHeader, QuickFilterBar } from '../../components/ui';
import { useDialog } from '../../components/ui/DialogProvider';
import ScanModeTabs from '../../components/ScanModeTabs';
import { todayIso, loadSubjects, errorOf, cameraErrorText } from './shared';

// 3 แบบ: day = สแกนเอกสารวิชาไหนก็ได้ ดูว่ามาโรงเรียนไหม · subject = ครูเลือกวิชา สแกนเล่มไหนก็ได้ · qr = สแกนเล่มของวิชานั้น
const MODES = [
  { id: 'day', label: 'มาเรียนไหม', hint: 'สแกนเอกสารวิชาไหนก็ได้ ระบบบอกว่านักเรียนมาโรงเรียนวันนี้' },
  { id: 'subject', label: 'เลือกวิชาเอง', hint: 'ครูเลือกวิชาก่อน แล้วสแกนเล่มไหนของนักเรียนก็ได้ นับเข้าวิชาที่เลือก' },
  { id: 'qr', label: 'สแกนเล่มวิชา', hint: 'ไม่ต้องเลือกวิชา สแกนเล่มของวิชาไหน นับเข้าวิชานั้น' }
];
const SAME_CODE_MS = 3000;
const MODE_KEY = 'attendance_mode';
const SUBJECT_KEY = 'attendance_subject';
const CLASS_KEY = 'attendance_class';
const readId = (k) => { try { const v = parseInt(localStorage.getItem(k), 10); return Number.isInteger(v) ? v : null; } catch { return null; } };
const saveId = (k, v) => { try { if (v) localStorage.setItem(k, String(v)); } catch { /* ไม่เก็บค่าก็ไม่เป็นไร */ } };

const AttendanceCheck = () => {
  const { user } = useAuth();
  const dialog = useDialog();
  const seesAll = user?.role === 'ADMIN' || !!user?.canManage;
  const [mode, setMode] = useState(() => { const m = localStorage.getItem(MODE_KEY); return MODES.some(x => x.id === m) ? m : 'subject'; });
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjectId, setSubjectId] = useState(() => readId(SUBJECT_KEY));
  const [classId, setClassId] = useState(() => readId(CLASS_KEY));
  const [date, setDate] = useState(todayIso());
  const [sheet, setSheet] = useState(null); // { title, students, counts, subjectId?, classId? }
  const [last, setLast] = useState(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);

  const readerRef = useRef(null);
  const audioRef = useRef(null);
  const seen = useRef({ code: '', at: 0 });
  const onDecodeRef = useRef(() => {});
  const decodeProxy = useCallback((text) => onDecodeRef.current(text), []);

  useEffect(() => { saveId(SUBJECT_KEY, subjectId); }, [subjectId]);
  useEffect(() => { saveId(CLASS_KEY, classId); }, [classId]);
  // ค่าที่จำไว้ต้องยังมีอยู่ในรายการ · มีตัวเลือกเดียว = เลือกให้เลย
  useEffect(() => {
    if (!subjects.length) return;
    setSubjectId(cur => (subjects.some(x => x.id === cur) ? cur : subjects.length === 1 ? subjects[0].id : null));
  }, [subjects]);
  useEffect(() => {
    if (!classes.length) return;
    setClassId(cur => (classes.some(x => x.id === cur) ? cur : classes.length === 1 ? classes[0].id : null));
  }, [classes]);
  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch { /* ไม่เก็บค่าก็ไม่เป็นไร */ } }, [mode]);
  useEffect(() => {
    loadSubjects(seesAll).then(setSubjects).catch(() => setError(t('โหลดรายวิชาไม่สำเร็จ')));
    classAPI.getAll({ status: 'ACTIVE' }).then(r => setClasses((r.data || []).map(c => ({ id: c.id, label: c.className })))).catch(() => {});
  }, [seesAll]);

  const loadSheet = useCallback(async (kind, id, d) => {
    if (!id) { setSheet(null); return; }
    try {
      if (kind === 'day') {
        const r = await attendanceAPI.daySheet({ classId: id, date: d });
        setSheet({ kind, id, title: r.data.cls.className, students: r.data.students, counts: r.data.counts });
      } else {
        const r = await attendanceAPI.sheet({ subjectId: id, date: d });
        setSheet({ kind, id, title: r.data.subject.subjectName, students: r.data.students, counts: r.data.counts });
      }
    } catch (err) { setError(errorOf(err, t('โหลดข้อมูลไม่สำเร็จ'))); }
  }, []);

  // เลือกวิชา/ห้อง/วัน แล้วโหลดรายชื่อทันที (แบบสแกนเล่มวิชาโหลดตามวิชาที่สแกนเจอ)
  useEffect(() => {
    if (mode === 'day') loadSheet('day', classId, date);
    else if (mode === 'subject') loadSheet('subject', subjectId, date);
    else setSheet(prev => (prev && prev.kind === 'subject' ? prev : null));
  }, [mode, classId, subjectId, date, loadSheet]);

  const beep = (ok) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = ok ? 1046 : 330;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.16);
    } catch { /* เสียงใช้ไม่ได้ ไม่เป็นไร */ }
    if (navigator.vibrate) { try { navigator.vibrate(ok ? 60 : [60, 60, 60]); } catch { /* ignore */ } }
  };

  const record = async (payload) => {
    if (mode === 'subject' && !subjectId) { setError(t('เลือกวิชาก่อนสแกน')); return; }
    setBusy(true); setError('');
    try {
      let r;
      if (mode === 'day') r = await attendanceAPI.dayScan({ ...payload, date });
      else r = await attendanceAPI.scan({ ...payload, date, ...(mode === 'subject' ? { subjectId } : {}) });
      setLast(r.data);
      beep(true);
      if (mode === 'day') { if (classId) loadSheet('day', classId, date); else setClassId(r.data.student.classId); }
      else loadSheet('subject', r.data.subject.id, date);
    } catch (err) {
      setLast(null);
      setError(errorOf(err, t('บันทึกไม่สำเร็จ')));
      beep(false);
    } finally { setBusy(false); }
  };

  onDecodeRef.current = (text) => {
    const now = Date.now();
    if (seen.current.code === text && now - seen.current.at < SAME_CODE_MS) return;
    seen.current = { code: text, at: now };
    record({ qrcodeData: text });
  };

  const startScanner = async () => {
    setError('');
    try {
      readerRef.current = new Html5Qrcode('attendance-reader');
      setScanning(true);
      await readerRef.current.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, decodeProxy, () => {});
    } catch (err) {
      setScanning(false);
      setError(cameraErrorText(err));
    }
  };
  const stopScanner = async () => {
    const r = readerRef.current;
    setScanning(false);
    if (r && r.isScanning) { try { await r.stop(); } catch { /* ปิดกล้องไม่ได้ ข้าม */ } }
  };
  useEffect(() => () => {
    const r = readerRef.current;
    if (r && r.isScanning) r.stop().catch(() => {});
    if (audioRef.current) audioRef.current.close().catch(() => {});
  }, []);

  const submitManual = async (e) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    await record(/^(KS1\.|SNT-)/.test(code) ? { qrcodeData: code } : { studentCode: code });
    setManualCode('');
  };

  const toggle = async (s) => {
    try {
      if (sheet.kind === 'day') await attendanceAPI.dayMark({ studentId: s.id, date, present: s.status !== 'PRESENT' });
      else await attendanceAPI.mark({ subjectId: sheet.id, studentId: s.id, date, status: s.status === 'PRESENT' ? 'ABSENT' : 'PRESENT' });
      loadSheet(sheet.kind, sheet.id, date);
    } catch (err) { setError(errorOf(err, t('บันทึกไม่สำเร็จ'))); }
  };

  const closeRound = async () => {
    const ok = await dialog.confirm({
      title: t('ปิดคาบนี้?'),
      message: t('นักเรียนที่ยังไม่ได้เช็คทั้งหมดจะถูกบันทึกเป็น "ไม่มา"'),
      confirmText: t('ปิดคาบ'),
      cancelText: t('ยกเลิก')
    });
    if (!ok) return;
    try {
      await attendanceAPI.close({ subjectId: sheet.id, date });
      loadSheet('subject', sheet.id, date);
    } catch (err) { setError(errorOf(err, t('ปิดคาบไม่สำเร็จ'))); }
  };

  const cur = MODES.find(m => m.id === mode);
  const c = sheet?.counts;
  const chip = (st) => st === 'PRESENT' ? 'bg-green-100 text-green-800' : st === 'ABSENT' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500';
  const label = (st) => st === 'PRESENT' ? t('มา') : st === 'ABSENT' ? t('ไม่มา') : sheet?.kind === 'day' ? t('ไม่มา') : t('ยังไม่เช็ค');
  const needPick = mode === 'subject' && !subjectId;

  return (
    <div className="space-y-4">
      <ScanModeTabs active="attendance" />
      <PageHeader title={t('เช็คชื่อเข้าเรียน')} subtitle={t('สแกน QR ของนักเรียน')}>
        <Link to="/summary?tab=attendance" className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">{t('ดูสรุป')}</Link>
      </PageHeader>

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <div role="tablist" aria-label={t('วิธีเช็คชื่อ')} className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 sm:inline-grid">
          {MODES.map(m => (
            <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => { setMode(m.id); setLast(null); setError(''); }}
              className={`min-h-[44px] rounded-md px-2 text-center text-sm font-medium leading-tight sm:px-4 ${mode === m.id ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600'}`}>{t(m.label)}</button>
          ))}
        </div>
        <p className="text-sm text-gray-500">{t(cur.hint)}</p>
        {mode === 'subject' && (
          <QuickFilterBar label={t('วิชา')} hideAll options={subjects.map(x => ({ value: x.id, label: x.subjectName }))} value={subjectId} onChange={setSubjectId} />
        )}
        {mode === 'day' && (
          <QuickFilterBar label={t('ห้อง')} hideAll options={classes.map(x => ({ value: x.id, label: x.label }))} value={classId} onChange={setClassId} />
        )}
        <div className="flex items-center gap-2 sm:gap-3">
          <label htmlFor="att-date" className="w-14 shrink-0 text-xs font-medium text-gray-600 sm:w-20 sm:text-sm">{t('วันที่')}</label>
          <input id="att-date" type="date" value={date} max={todayIso()} onChange={e => e.target.value && setDate(e.target.value)} className="min-h-[44px] w-full max-w-[14rem] rounded-lg border border-gray-300 px-3" />
        </div>
      </section>

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {last && (
          <div role="status" className={`rounded-xl px-4 py-3 ${last.alreadyMarked ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
            <div className="text-lg font-semibold">{last.student.name}</div>
            <div className="text-sm">{last.student.className}{last.subject ? ` · ${last.subject.subjectName}` : ''} · {last.alreadyMarked ? t('เช็คไปแล้ว') : t('มา')}</div>
          </div>
        )}
        <div id="attendance-reader" hidden={!scanning} className="mx-auto w-full max-w-md overflow-hidden rounded-xl" />
        {scanning
          ? <button type="button" onClick={stopScanner} className="min-h-[56px] w-full rounded-xl bg-gray-700 px-6 text-lg font-semibold text-white">{t('หยุดสแกน')}</button>
          : <button type="button" onClick={startScanner} disabled={needPick} className="min-h-[56px] w-full rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg shadow-sm disabled:opacity-50">{t('เปิดกล้องสแกน')}</button>}
        <div>
          <form onSubmit={submitManual} className="flex gap-2">
            <input value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder={t('พิมพ์รหัสนักเรียน')} aria-label={t('รหัสนักเรียน')} className="min-h-[48px] w-full rounded-lg border border-gray-300 px-3" />
            <button type="submit" disabled={busy || !manualCode.trim()} className="min-h-[48px] rounded-lg border border-gray-300 px-4 font-medium disabled:opacity-50">{t('บันทึก')}</button>
          </form>
        </div>
      </section>

      {sheet && (
        <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <div>
              <h2 className="font-semibold text-gray-800">{sheet.title}</h2>
              <p className="text-sm text-gray-500">
                {sheet.kind === 'day'
                  ? t('มา {present}/{total} · ไม่มา {absent}', c)
                  : t('มา {present}/{total} · ไม่มา {absent} · ยังไม่เช็ค {unchecked}', c)}
              </p>
            </div>
            {sheet.kind === 'subject' && <button type="button" onClick={closeRound} className="min-h-[44px] rounded-lg border border-gray-300 px-4 text-sm font-medium hover:bg-gray-50">{t('ปิดคาบ (ที่เหลือ = ไม่มา)')}</button>}
          </div>
          <ul className="divide-y">
            {sheet.students.map(s => (
              <li key={s.id}>
                <button type="button" onClick={() => toggle(s)} className="flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50">
                  <span className="w-8 shrink-0 text-sm text-gray-400">{s.studentNumber || ''}</span>
                  <span className="min-w-0 flex-1 truncate"><span className="font-medium text-gray-800">{s.name}</span> <span className="text-sm text-gray-500">{s.className}</span></span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${chip(s.status)}`}>{label(s.status)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default AttendanceCheck;
