import { t } from '../../i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../../context/AuthContext';
import { submissionAPI, taskAPI, classAPI } from '../../services/api';
import { QuickFilterBar } from '../../components/ui';
import ScanModeTabs from '../../components/ScanModeTabs';
import { cameraErrorText } from '../attendance/shared';

// สแกนตรวจงานต่อเนื่อง: เลือก "งานที่กำลังตรวจ" ก่อน → สแกน QR เล่มไหนของนักเรียนก็ได้ → งานนั้น "ผ่าน" ทันที
const TASK_KEY = 'scancheck_task';
const SAME_CODE_MS = 3000;
const HISTORY_MAX = 8;

const readId = () => { try { const v = parseInt(localStorage.getItem(TASK_KEY), 10); return Number.isInteger(v) ? v : null; } catch { return null; } };
const errorOf = (err, fallback) => (err && err.response && err.response.data && err.response.data.error) || fallback;
const roomsOf = (task) => (task.rooms && task.rooms.length
  ? task.rooms.map(r => r.class?.className).filter(Boolean).sort((a, b) => a.localeCompare(b, 'th', { numeric: true })).join(', ')
  : t('ทุกห้อง'));
const fmt = (n) => String(Math.round(Number(n) * 100) / 100);
// ปุ่มแตะตั้งคะแนนทันที: เต็ม ≤ 10 = ทุกค่า 0..เต็ม · เต็ม > 10 = ปุ่มลัด เต็ม ¾ ½ ¼ 0 (ปัดเลขสวย)
const quickValues = (max) => {
  if (max <= 10) {
    const v = Array.from({ length: Math.floor(max) + 1 }, (_, i) => i);
    if (!Number.isInteger(max)) v.push(max);
    return v;
  }
  return [...new Set([max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0])].sort((a, b) => b - a);
};
const shortDate = (d) => (d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '');

const SHEET_TABS = {
  SUBMISSION_ONLY: [['all', 'ทั้งหมด'], ['missing', 'ยังไม่ส่ง'], ['done', 'ส่งแล้ว']],
  PASS_FAIL: [['all', 'ทั้งหมด'], ['missing', 'ยังไม่ส่ง'], ['pending', 'รอตรวจ'], ['pass', 'ผ่าน'], ['fail', 'ไม่ผ่าน']],
  SCORED: [['all', 'ทั้งหมด'], ['missing', 'ยังไม่ส่ง'], ['pending', 'รอคะแนน'], ['scored', 'ให้คะแนนแล้ว']]
};
const inTab = (tab, type, x) => {
  if (tab === 'all') return true;
  if (tab === 'missing') return x.status === 'NOT_SUBMITTED';
  if (tab === 'done') return x.status !== 'NOT_SUBMITTED';
  if (tab === 'pending') return x.status === 'PENDING' || (type === 'SCORED' && x.status === 'APPROVED' && x.score === null);
  if (tab === 'pass') return x.status === 'APPROVED';
  if (tab === 'fail') return x.status === 'REJECTED';
  if (tab === 'scored') return x.score !== null;
  return true;
};

// รายชื่อของงาน: ใครส่ง/ไม่ส่ง ตามเลขที่ · งานที่คิดคะแนนดูคะแนนได้ (ชุดแท็บเปลี่ยนตามประเภทการบันทึกของงาน)
const TaskSheet = ({ taskId, onClose }) => {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    submissionAPI.taskSheet(taskId)
      .then(r => { if (live) setData(r.data); })
      .catch(err => live && setError(errorOf(err, t('โหลดข้อมูลไม่สำเร็จ'))));
    return () => { live = false; };
  }, [taskId]);

  const type = data?.task.scoringType || 'SUBMISSION_ONLY';
  const students = data?.students || [];
  const tabs = SHEET_TABS[type] || SHEET_TABS.SUBMISSION_ONLY;
  const missing = students.filter(x => x.status === 'NOT_SUBMITTED');
  const active = tab || (missing.length ? 'missing' : 'all');
  const rows = students.filter(x => inTab(active, type, x));
  const multiRoom = new Set(students.map(x => x.className)).size > 1;
  const max = data?.task.maxScore;
  const scored = students.filter(x => x.score !== null);
  const avg = scored.length ? Math.round((scored.reduce((n, x) => n + x.score, 0) / scored.length) * 10) / 10 : null;

  // เลขที่ที่ยังไม่ส่ง จัดกลุ่มตามห้อง: "ป.4/1: 3, 7, 12"
  const missingByRoom = missing.reduce((m, x) => { (m[x.className] = m[x.className] || []).push(x.studentNumber || x.studentCode); return m; }, {});

  const chipFor = (x) => {
    if (x.status === 'NOT_SUBMITTED') return { text: t('ยังไม่ส่ง'), cls: 'bg-red-50 text-red-700' };
    if (type === 'SCORED') {
      if (x.score !== null) return { text: max ? `${x.score}/${max}` : String(x.score), cls: 'bg-green-50 text-green-800 font-semibold' };
      return { text: x.status === 'PENDING' ? t('รอคะแนน') : t('ผ่าน (ยังไม่ให้คะแนน)'), cls: 'bg-amber-50 text-amber-800' };
    }
    if (type === 'SUBMISSION_ONLY') return { text: t('ส่งแล้ว'), cls: 'bg-green-50 text-green-800' };
    if (x.status === 'APPROVED') return { text: t('ผ่าน'), cls: 'bg-green-50 text-green-800' };
    if (x.status === 'REJECTED') return { text: t('ไม่ผ่าน'), cls: 'bg-red-50 text-red-700' };
    return { text: t('รอตรวจ'), cls: 'bg-amber-50 text-amber-800' };
  };

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={t('รายชื่อของงานนี้')}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b px-4">
          <div className="min-w-0 py-2">
            <h2 className="truncate text-base font-semibold text-gray-900">{data?.task.taskName || t('รายชื่อของงานนี้')}</h2>
            {data && <p className="text-xs text-gray-500">{t(type === 'SCORED' ? 'คิดคะแนน' : type === 'PASS_FAIL' ? 'ผ่าน/ไม่ผ่าน' : 'ส่ง/ไม่ส่ง')}{max ? ` · ${t('เต็ม {value1}', { value1: max })}` : ''}{avg !== null ? ` · ${t('เฉลี่ย {value1}', { value1: avg })}` : ''}</p>}
          </div>
          <button type="button" autoFocus onClick={onClose} className="min-h-[48px] min-w-[48px] px-3 text-sm font-medium text-gray-700">{t('ปิด')}</button>
        </div>
        {error && <p role="alert" className="m-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {!data && !error && <p className="py-10 text-center text-gray-500">{t('กำลังโหลด...')}</p>}
        {data && (
          <>
            {missing.length > 0 && (
              <div className="shrink-0 border-b bg-red-50/60 px-4 py-2 text-sm text-red-800">
                <span className="font-semibold">{t('ยังไม่ส่ง {value1} คน', { value1: missing.length })}</span>
                <span className="ml-1">{t('เลขที่')} {Object.entries(missingByRoom).map(([room, nums]) => (multiRoom ? `${room}: ` : '') + nums.join(', ')).join(' · ')}</span>
              </div>
            )}
            <div role="tablist" className="flex shrink-0 gap-1.5 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map(([id, label]) => {
                const n = students.filter(x => inTab(id, type, x)).length;
                return (
                  <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setTab(id)}
                    className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium ${active === id ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-gray-800'}`}>
                    {t(label)}<span className={`text-xs ${active === id ? 'text-white/85' : 'text-gray-500'}`}>{n}</span>
                  </button>
                );
              })}
            </div>
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              {rows.map(x => {
                const c = chipFor(x);
                return (
                  <li key={x.id} className="flex min-h-[52px] items-center gap-3 px-4 py-2">
                    <span className="w-8 shrink-0 text-sm tabular-nums text-gray-400">{x.studentNumber || ''}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-900">{x.name}{multiRoom && <span className="ml-1 text-xs text-gray-500">{x.className}</span>}</span>
                    <span className={`shrink-0 rounded-md px-2.5 py-1 text-sm ${c.cls}`}>{c.text}</span>
                  </li>
                );
              })}
              {rows.length === 0 && <li className="px-4 py-10 text-center text-gray-500">{t('ไม่มีรายการ')}</li>}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};

const ScanCheck = () => {
  const { user } = useAuth();
  const seesAll = user?.role === 'ADMIN' || !!user?.canManage;
  const myTeacherId = user?.teacher?.id || user?.teacherId || null;

  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [taskId, setTaskId] = useState(readId);
  const [pickSubject, setPickSubject] = useState(null);
  const [pickRoom, setPickRoom] = useState(null);
  const [pickDue, setPickDue] = useState(null);
  const [classes, setClasses] = useState([]);
  const [showSheet, setShowSheet] = useState(false);
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState(null);
  const [last, setLast] = useState(null); // { student, status, previousStatus, alreadyChecked }
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [savingScore, setSavingScore] = useState(false);

  const readerRef = useRef(null);
  const audioRef = useRef(null);
  const seen = useRef({ code: '', at: 0 });
  const taskIdRef = useRef(taskId);
  taskIdRef.current = taskId;
  // คิวส่งคะแนน: ส่งทีละ request ตามลำดับ ค่าสุดท้ายชนะ · confirmed = คะแนนที่ server ยืนยันล่าสุดของแต่ละคน
  const scoreQ = useRef({ pending: null, running: false, confirmed: {} });
  const onDecodeRef = useRef(() => {});
  const decodeProxy = useCallback((text) => onDecodeRef.current(text), []);

  useEffect(() => {
    let live = true;
    taskAPI.getAll({ status: 'ACTIVE' })
      .then(r => {
        if (!live) return;
        const mine = (r.data || []).filter(x => seesAll || !myTeacherId || x.subject?.teacherId === myTeacherId);
        setTasks(mine);
      })
      .catch(() => live && setError(t('โหลดรายการงานไม่สำเร็จ')))
      .finally(() => live && setLoadingTasks(false));
    return () => { live = false; };
  }, [seesAll, myTeacherId]);

  useEffect(() => { classAPI.getAll({ status: 'ACTIVE' }).then(r => setClasses(r.data || [])).catch(() => {}); }, []);

  const task = tasks.find(x => x.id === taskId) || null;

  // งานที่จำไว้ต้องยังมีอยู่ · ไม่มี = เปิดตัวเลือกงาน
  useEffect(() => {
    if (loadingTasks) return;
    if (!task) setPicking(true);
  }, [loadingTasks, task]);

  useEffect(() => {
    if (!task) { setProgress(null); return undefined; }
    let live = true;
    submissionAPI.taskProgress(task.id).then(r => live && setProgress(r.data.progress)).catch(() => {});
    return () => { live = false; };
  }, [task]);

  const subjects = Object.values(tasks.reduce((m, x) => { if (x.subject) m[x.subject.id] = x.subject; return m; }, {}))
    .sort((a, b) => String(a.subjectName).localeCompare(String(b.subjectName), 'th', { numeric: true }));
  const activeSubject = pickSubject || task?.subject?.id || subjects[0]?.id || null;
  const subjectInfo = subjects.find(x => x.id === activeSubject);
  const inRoom = (x, room) => (x.rooms && x.rooms.length ? x.rooms.some(r => r.classId === room.id) : x.subject?.gradeId === room.gradeId);
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const dueOf = (x) => (!x.deadline ? null : new Date(x.deadline).getTime() < startOfToday ? 'overdue' : 'upcoming');
  const ofSubject = tasks.filter(x => x.subject?.id === activeSubject);
  const byRoom = (list) => { const room = classes.find(c => c.id === pickRoom); return room ? list.filter(x => inRoom(x, room)) : list; };
  const byDue = (list) => (pickDue ? list.filter(x => dueOf(x) === pickDue) : list);
  const subjectTasks = byDue(byRoom(ofSubject)).sort((a, b) => b.taskNumber - a.taskNumber);
  const roomChips = classes.filter(c => subjectInfo && c.gradeId === subjectInfo.gradeId)
    .sort((a, b) => String(a.className).localeCompare(String(b.className), 'th', { numeric: true }))
    .map(c => ({ value: c.id, label: c.className, count: byDue(ofSubject).filter(x => inRoom(x, c)).length }));
  const dueChips = [
    { value: 'upcoming', label: t('ยังไม่ถึงกำหนด'), count: byRoom(ofSubject).filter(x => dueOf(x) === 'upcoming').length },
    { value: 'overdue', label: t('เลยกำหนดแล้ว'), count: byRoom(ofSubject).filter(x => dueOf(x) === 'overdue').length }
  ];

  const chooseTask = (x) => {
    setTaskId(x.id);
    try { localStorage.setItem(TASK_KEY, String(x.id)); } catch { /* ไม่เก็บค่าก็ไม่เป็นไร */ }
    setPicking(false); setLast(null); setHistory([]); setError('');
  };

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

  const send = async (payload) => {
    if (!taskIdRef.current) { setError(t('เลือกงานที่จะตรวจก่อนสแกน')); setPicking(true); return null; }
    setBusy(true); setError('');
    try {
      const r = await submissionAPI.scanCheck({ taskId: taskIdRef.current, ...payload });
      setProgress(r.data.progress);
      return r.data;
    } catch (err) {
      setLast(null); setError(errorOf(err, t('บันทึกไม่สำเร็จ'))); beep(false);
      return null;
    } finally { setBusy(false); }
  };

  const record = async (payload) => {
    const d = await send(payload);
    if (!d) return;
    scoreQ.current.confirmed[d.student.id] = d.score;
    setLast(d); beep(true);
    if (!d.alreadyChecked) setHistory(h => [{ id: d.student.id, name: d.student.name, status: d.status, score: d.score, max: d.maxScore, scored: d.scoringType === 'SCORED' }, ...h.filter(x => x.id !== d.student.id)].slice(0, HISTORY_MAX));
  };

  // ปุ่มคะแนนเร็ว: เปลี่ยนเลขบนจอทันที แล้วส่งเข้าคิว · ล้มเหลว = ย้อนเป็นค่าที่ server ยืนยันล่าสุด
  const drainScores = async () => {
    const q = scoreQ.current;
    q.running = true; setSavingScore(true);
    while (q.pending) {
      const p = q.pending; q.pending = null;
      try {
        const r = await submissionAPI.scanCheck({ taskId: p.taskId, studentCode: p.code, status: 'APPROVED', score: p.score });
        q.confirmed[p.id] = r.data.score;
        setProgress(r.data.progress);
      } catch (err) {
        q.pending = null;
        const back = q.confirmed[p.id];
        setLast(l => (l && l.student.id === p.id ? { ...l, score: back } : l));
        setHistory(h => h.map(x => (x.id === p.id ? { ...x, score: back } : x)));
        setError(errorOf(err, t('บันทึกไม่สำเร็จ'))); beep(false);
      }
    }
    q.running = false; setSavingScore(false);
  };
  const setScore = (value) => {
    if (!last || last.noMaxScore || last.maxScore == null) return;
    const v = Math.min(last.maxScore, Math.max(0, value));
    scoreQ.current.pending = { taskId: taskIdRef.current, id: last.student.id, code: last.student.studentCode, score: v };
    setError('');
    setLast(l => (l ? { ...l, score: v } : l));
    setHistory(h => h.map(x => (x.id === last.student.id ? { ...x, score: v } : x)));
    if (!scoreQ.current.running) drainScores();
  };

  // ย้อนกลับ / เปลี่ยนเป็นไม่ผ่าน ของคนล่าสุด
  const change = async (status) => {
    if (!last) return;
    const undo = status === last.previousStatus;
    const d = await send({ studentCode: last.student.studentCode, status, ...(last.scoringType === 'SCORED' && undo ? { score: last.previousScore } : {}) });
    if (!d) return;
    scoreQ.current.confirmed[d.student.id] = d.score;
    setHistory(h => (status === last.previousStatus || status === 'NOT_SUBMITTED' || status === 'PENDING')
      ? h.filter(x => x.id !== d.student.id)
      : [{ id: d.student.id, name: d.student.name, status, score: d.score, max: d.maxScore, scored: d.scoringType === 'SCORED' }, ...h.filter(x => x.id !== d.student.id)]);
    setLast(undo ? null : { ...d, previousStatus: last.previousStatus, previousScore: last.previousScore });
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
      readerRef.current = new Html5Qrcode('scancheck-reader');
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

  const pct = progress && progress.total ? Math.round((progress.checked / progress.total) * 100) : 0;
  const statusText = (st) => (st === 'APPROVED' ? t('ผ่าน') : st === 'REJECTED' ? t('ไม่ผ่าน') : st === 'PENDING' ? t('รอตรวจ') : t('ยังไม่ส่ง'));

  return (
    <div className="space-y-3 pb-4">
      <ScanModeTabs active="work" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">{t('สแกนตรวจงาน')}</h1>
        <Link to="/teacher/scan/classic" className="inline-flex min-h-[44px] items-center text-sm text-brand-700 hover:underline">{t('แบบเปิดดูรายการนักเรียน')}</Link>
      </div>

      {/* งานที่กำลังตรวจ: เห็นตลอดว่าสแกนแล้วจะนับเข้างานไหน */}
      <section className="rounded-xl border-2 border-brand-200 bg-white p-4 shadow-sm" aria-label={t('งานที่กำลังตรวจ')}>
        {task && !picking ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-500">{t('กำลังตรวจ')}</div>
                <div className="truncate text-lg font-bold text-gray-900">{task.taskName}</div>
                <div className="truncate text-sm text-gray-600">{task.subject?.subjectName} · {roomsOf(task)}{task.deadline ? ` · ${t('ส่ง {value1}', { value1: shortDate(task.deadline) })}` : ''}</div>
              </div>
              <button type="button" onClick={() => setPicking(true)} className="min-h-[44px] shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium hover:bg-gray-50">{t('เปลี่ยนงาน')}</button>
            </div>
            {progress && (
              <button type="button" onClick={() => setShowSheet(true)} aria-label={t('ดูรายชื่อว่าใครส่ง/ไม่ส่ง')}
                className="mt-3 block w-full rounded-lg text-left active:bg-gray-50">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-gray-800">{t('ตรวจแล้ว {checked}/{total}', progress)}</span>
                  <span className="text-gray-500">{progress.pending > 0 ? t('รอตรวจ {value1}', { value1: progress.pending }) + ' · ' : ''}{t('ยังไม่ส่ง {value1}', { value1: progress.notSubmitted })}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} /></div>
                <div className="mt-1.5 flex items-center justify-end gap-1 text-xs font-medium text-brand-700">{t('ดูรายชื่อ')}<span aria-hidden="true">›</span></div>
              </button>
            )}
          </>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold text-gray-800">{t('เลือกงานที่จะตรวจ')}</h2>
              {task && <button type="button" onClick={() => setPicking(false)} className="min-h-[44px] px-2 text-sm text-gray-600">{t('ปิด')}</button>}
            </div>
            {loadingTasks ? <p className="py-4 text-center text-gray-500">{t('กำลังโหลด...')}</p> : subjects.length === 0 ? (
              <p className="py-4 text-center text-gray-500">{t('ยังไม่มีงาน สร้างงานก่อนแล้วกลับมาสแกนตรวจ')}</p>
            ) : (
              <>
                <div className="space-y-1">
                  <QuickFilterBar label={t('วิชา')} hideAll options={subjects.map(s => ({ value: s.id, label: s.subjectName }))} value={activeSubject} onChange={(v) => { setPickSubject(v); setPickRoom(null); }} />
                  {roomChips.length > 1 && <QuickFilterBar label={t('ห้อง')} allLabel={t('ทุกห้อง')} options={roomChips} value={pickRoom} onChange={setPickRoom} />}
                  {ofSubject.some(x => x.deadline) && <QuickFilterBar label={t('กำหนดส่ง')} allLabel={t('ทั้งหมด')} options={dueChips} value={pickDue} onChange={setPickDue} />}
                </div>
                <ul className="mt-2 max-h-72 divide-y overflow-y-auto rounded-lg ring-1 ring-gray-200">
                  {subjectTasks.map(x => (
                    <li key={x.id}>
                      <button type="button" onClick={() => chooseTask(x)} className={`flex min-h-[56px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 ${x.id === taskId ? 'bg-brand-50' : ''}`}>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-gray-900">{x.taskName}</span>
                          <span className="block truncate text-xs text-gray-500">{roomsOf(x)}{x.deadline ? ` · ${t('ส่ง {value1}', { value1: shortDate(x.deadline) })}` : ''}</span>
                        </span>
                        {x.id === taskId && <span aria-hidden="true" className="text-brand-600">✓</span>}
                      </button>
                    </li>
                  ))}
                  {subjectTasks.length === 0 && <li className="px-3 py-4 text-center text-sm text-gray-500">{t('วิชานี้ยังไม่มีงาน')}</li>}
                </ul>
              </>
            )}
          </div>
        )}
      </section>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {last && (() => {
        const isScored = last.scoringType === 'SCORED';
        const max = last.maxScore;
        const score = last.score ?? 0;
        const panel = isScored && !last.noMaxScore && max != null;
        const step = 'flex min-h-[56px] w-[72px] shrink-0 items-center justify-center rounded-xl border border-current/30 bg-white/80 text-3xl font-semibold leading-none active:bg-white disabled:opacity-40';
        return (
          <div role="status" className={`rounded-xl px-4 py-3 ${last.alreadyChecked ? 'bg-amber-50 text-amber-900' : last.status === 'REJECTED' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold">{last.student.name}</div>
                <div className="text-sm">{last.student.className}{isScored ? (last.alreadyChecked ? ` · ${t('มีคะแนนอยู่แล้ว (ไม่ทับ)')}` : '') : ` · ${last.alreadyChecked ? t('ตรวจไปแล้ว: {value1}', { value1: statusText(last.status) }) : statusText(last.status)}`}</div>
              </div>
              {!isScored && <div className="shrink-0 text-3xl" aria-hidden="true">{last.status === 'REJECTED' ? '✗' : '✓'}</div>}
            </div>
            {isScored && last.noMaxScore && <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium">{t('งานนี้ยังไม่ตั้งคะแนนเต็ม')}</p>}
            {panel && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <button type="button" aria-label={t('ลดคะแนน')} disabled={score <= 0} onClick={() => setScore(score - 1)} className={step}>−</button>
                  <div className="min-w-0 flex-1 text-center text-4xl font-bold tabular-nums" aria-live="polite">{fmt(score)}<span className="text-2xl font-semibold opacity-70">/{fmt(max)}</span></div>
                  <button type="button" aria-label={t('เพิ่มคะแนน')} disabled={score >= max} onClick={() => setScore(score + 1)} className={step}>+</button>
                </div>
                <div className={`grid gap-1.5 ${max <= 10 ? 'grid-cols-6' : 'grid-cols-5'}`}>
                  {quickValues(max).map(v => (
                    <button key={v} type="button" aria-label={t('ตั้งคะแนน {value1}', { value1: fmt(v) })} aria-pressed={score === v} onClick={() => setScore(v)}
                      className={`min-h-[48px] rounded-lg border text-lg font-semibold tabular-nums ${score === v ? 'border-green-800 bg-green-800 text-white' : 'border-current/30 bg-white/80 active:bg-white'}`}>{max > 10 && v === max ? `${t('เต็ม')} ${fmt(v)}` : fmt(v)}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-2 flex gap-2">
              {!last.alreadyChecked && <button type="button" disabled={busy || savingScore} onClick={() => change(last.previousStatus)} className="min-h-[44px] flex-1 rounded-lg border border-current/30 bg-white/70 px-3 text-sm font-medium">{t('ยกเลิก')}</button>}
              {!isScored && last.status !== 'REJECTED' && <button type="button" disabled={busy} onClick={() => change('REJECTED')} className="min-h-[44px] flex-1 rounded-lg border border-current/30 bg-white/70 px-3 text-sm font-medium">{t('ไม่ผ่าน')}</button>}
              {!isScored && last.status === 'REJECTED' && <button type="button" disabled={busy} onClick={() => change('APPROVED')} className="min-h-[44px] flex-1 rounded-lg border border-current/30 bg-white/70 px-3 text-sm font-medium">{t('ผ่าน')}</button>}
            </div>
          </div>
        );
      })()}

      <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <div id="scancheck-reader" hidden={!scanning} className="mx-auto w-full max-w-md overflow-hidden rounded-xl" />
        {scanning
          ? <button type="button" onClick={stopScanner} className="min-h-[56px] w-full rounded-xl bg-gray-700 px-6 text-lg font-semibold text-white">{t('หยุดสแกน')}</button>
          : <button type="button" onClick={startScanner} disabled={!task} className="min-h-[56px] w-full rounded-xl bg-accent px-6 text-lg font-semibold text-accent-fg shadow-sm disabled:opacity-50">{t('เปิดกล้องสแกน')}</button>}
        <div>
          <form onSubmit={submitManual} className="flex gap-2">
            <input value={manualCode} onChange={e => setManualCode(e.target.value)} placeholder={t('พิมพ์รหัสนักเรียน')} aria-label={t('รหัสนักเรียน')} className="min-h-[52px] w-full rounded-lg border border-gray-300 px-3" />
            <button type="submit" disabled={busy || !manualCode.trim() || !task} className="min-h-[52px] rounded-lg border border-gray-300 px-4 font-medium disabled:opacity-50">{t('บันทึก')}</button>
          </form>
        </div>
        <p className="text-sm text-gray-500">{task?.scoringType === 'SCORED' ? t('สแกน QR เล่มไหนของนักเรียนก็ได้ ระบบให้คะแนนเต็มทันที แล้วกดปุ่มปรับคะแนนได้') : t('สแกน QR เล่มไหนของนักเรียนก็ได้ ระบบบันทึกว่า "ผ่าน" ให้งานที่เลือกไว้ทันที')}</p>
      </section>

      {history.length > 0 && (
        <section aria-label={t('ตรวจแล้วรอบนี้')} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{t('ตรวจแล้วรอบนี้')}</h2>
          <ul className="flex flex-wrap gap-2">
            {history.map(h => (
              <li key={h.id} className={`rounded-lg px-3 py-1.5 text-sm ${h.status === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{h.name}{h.scored && h.score != null && h.max != null ? ` ${fmt(h.score)}/${fmt(h.max)}` : ''}</li>
            ))}
          </ul>
        </section>
      )}
      {showSheet && task && <TaskSheet taskId={task.id} onClose={() => setShowSheet(false)} />}
    </div>
  );
};

export default ScanCheck;
