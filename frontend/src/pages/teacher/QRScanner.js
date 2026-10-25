import { t } from '../../i18n';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { qrcodeAPI } from '../../services/api';
import { isQrPayload } from './qrPayload';
import { saveSubmission, isNetworkError } from './offline/outbox';
import useOutbox from './offline/useOutbox';
import OutboxStatusPill from './offline/OutboxStatusPill';

import { NotebookQR } from '../../components/illustrations';

const OFFLINE_LOOKUP_MSG = 'ต้องต่อเน็ตเพื่อค้นหานักเรียน';
const lookupError = (err, fallback) =>
  isNetworkError(err) ? t(OFFLINE_LOOKUP_MSG) : (err.response?.data?.error || fallback);

const QRScanner = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');
  const handleRejected = useCallback((rejected) => {
    setError(t('ส่งรายการที่รอไว้ไม่สำเร็จ {value1} รายการ: {value2}', { value1: rejected.length, value2: rejected[0].error }));
  }, []);
  const outbox = useOutbox({ onRejected: handleRejected });
  const [loading, setLoading] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState(null);
  const [successTaskId, setSuccessTaskId] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  // For manual search flow
  const [studentSearchResult, setStudentSearchResult] = useState(null);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  // Task filter: 'all', 'submitted', 'not_submitted'
  const [taskFilter, setTaskFilter] = useState('not_submitted');
  // Auto-restart toggle - saved to localStorage
  const [autoRestart, setAutoRestart] = useState(() => {
    const saved = localStorage.getItem('qrScanner_autoRestart');
    // Default ON for new users; respect an existing saved preference
    return saved !== null ? saved === 'true' : true;
  });
  // Countdown for auto-restart
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  // Bulk record state + green confirmation
  const [bulkSaving, setBulkSaving] = useState(false);
  const [flash, setFlash] = useState('');
  const flashTimerRef = useRef(null);
  const [bulkUndo, setBulkUndo] = useState(null); // { studentId, items:[{id,status,notes}] } เห็น ~5 วินาที
  const undoTimerRef = useRef(null);
  const audioCtxRef = useRef(null);

  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    return () => {
      stopScanner();
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  // Save autoRestart preference
  useEffect(() => {
    localStorage.setItem('qrScanner_autoRestart', autoRestart.toString());
  }, [autoRestart]);

  // Create/resume AudioContext — must be called inside a user tap (autoplay policy)
  const primeAudio = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    } catch {
      // audio not available — ignore
    }
  };

  // Short beep + vibration + green banner
  const successFeedback = (message) => {
    try {
      const ctx = audioCtxRef.current;
      if (ctx) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1046;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
      }
    } catch {
      // ignore
    }
    if (navigator.vibrate) {
      try { navigator.vibrate(80); } catch { /* ignore */ }
    }
    if (message) {
      setFlash(message);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlash(''), 2000);
    }
  };

  const startScanner = async () => {
    primeAudio();
    try {
      setError('');
      setScanning(true);
      setShowManualInput(false);

      html5QrCodeRef.current = new Html5Qrcode('qr-reader');

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText) => {
          await handleScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      );
    } catch (err) {
      setError(t('ไม่สามารถเปิดกล้องได้: {message}', { message: err.message }));
      setScanning(false);
      setShowManualInput(true); // Show manual input when camera fails
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      await html5QrCodeRef.current.stop();
    }
    setScanning(false);
  };

  const handleScanSuccess = async (qrcodeData) => {
    await stopScanner();
    setLoading(true);
    setError('');

    try {
      const response = await qrcodeAPI.scan({ qrcodeData });
      setScanResult(response.data);
    } catch (err) {
      setError(lookupError(err, t('QR Code ไม่ถูกต้อง')));
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;

    setLoading(true);
    setError('');

    try {
      // If it looks like a QR code (starts with SNT-), try scanning first
      if (isQrPayload(code)) {
        try {
          const scanResponse = await qrcodeAPI.scan({ qrcodeData: code });
          setScanResult(scanResponse.data);
          setStudentSearchResult(null);
          setAvailableSubjects([]);
          return;
        } catch (scanErr) {
          // Other school's QR: show the server message, do not fall through to student search
          if (scanErr && scanErr.response && scanErr.response.status === 403 && scanErr.response.data && scanErr.response.data.error) {
            setError(scanErr.response.data.error);
            return;
          }
          // If QR scan fails, continue to student search
        }
      }

      // Search by student code
      let response;
      try {
        response = await qrcodeAPI.searchByStudent({ studentCode: code });
      } catch (searchErr) {
        if (isQrPayload(code) && !isNetworkError(searchErr)) {
          setError(t('QR นี้ไม่พบในระบบ ลองพิมพ์รหัสนักเรียนแทน'));
          return;
        }
        throw searchErr;
      }

      if (response.data.tasks) {
        // If tasks are returned, set as scan result
        setScanResult(response.data);
        setStudentSearchResult(null);
        setAvailableSubjects([]);
      } else if (response.data.subjects) {
        if (response.data.subjects.length === 1 && response.data.student) {
          // มีวิชาเดียว — เลือกให้อัตโนมัติ (ลดการแตะ)
          const only = response.data.subjects[0];
          const subjectId = only.id ?? only.subjectId ?? only.subject?.id;
          if (subjectId !== undefined) {
            const auto = await qrcodeAPI.searchByStudent({
              studentCode: response.data.student.studentCode,
              subjectId
            });
            setScanResult(auto.data);
            setStudentSearchResult(null);
            setAvailableSubjects([]);
            return;
          }
        }
        // If subjects are returned, show subject selection
        setStudentSearchResult(response.data.student);
        setAvailableSubjects(response.data.subjects);
      }
    } catch (err) {
      setError(lookupError(err, t('ไม่พบข้อมูล')));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSubject = async (subjectId) => {
    if (!studentSearchResult) return;

    setLoading(true);
    setError('');

    try {
      const response = await qrcodeAPI.searchByStudent({
        studentCode: studentSearchResult.studentCode,
        subjectId
      });

      setScanResult(response.data);
      setStudentSearchResult(null);
      setAvailableSubjects([]);
    } catch (err) {
      setError(lookupError(err, t('ไม่สามารถโหลดข้อมูลได้')));
    } finally {
      setLoading(false);
    }
  };

  // Start auto-restart countdown (reduced to 2 seconds)
  const startAutoRestartCountdown = () => {
    if (!autoRestart) return;

    setCountdown(2);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          // Reset and start scanner
          resetScanner();
          setTimeout(() => startScanner(), 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Skip countdown and scan immediately
  const scanNextNow = () => {
    primeAudio();
    cancelAutoRestart();
    resetScanner();
    setTimeout(() => startScanner(), 100);
  };

  // Cancel auto-restart
  const cancelAutoRestart = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      setCountdown(0);
    }
  };

  const handleSubmissionUpdate = async (taskId, status, score = null, notes = '') => {
    if (!scanResult) return;

    primeAudio();
    setSavingTaskId(taskId);
    setError('');
    setOfflineNotice('');

    try {
      const data = {
        studentId: scanResult.student.id,
        taskId,
        status,
        notes
      };

      if (score !== null) {
        data.score = score;
      }

      const outcome = await saveSubmission(data);

      // Update local state
      setScanResult((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId
            ? { ...task, submission: { ...task.submission, status, score, notes } }
            : task
        )
      }));

      // Show success feedback
      setSuccessTaskId(taskId);
      if (outcome === 'queued') {
        setOfflineNotice(t('บันทึกในเครื่องแล้ว รอส่ง — ระบบจะส่งให้เองเมื่อเน็ตกลับมา'));
      } else {
        successFeedback(status === 'NOT_SUBMITTED' ? '' : t('บันทึกแล้ว'));
      }

      // Check if all tasks are now submitted and auto-restart is enabled
      const updatedTasks = scanResult.tasks.map(t =>
        t.id === taskId ? { ...t, submission: { status } } : t
      );
      const allSubmitted = updatedTasks.every(t =>
        t.submission?.status && t.submission.status !== 'NOT_SUBMITTED'
      );

      if (autoRestart && allSubmitted) {
        // All tasks done - start countdown to scan next student
        setTimeout(() => {
          startAutoRestartCountdown();
        }, 500);
      }

      setTimeout(() => setSuccessTaskId(null), 1500);
    } catch (err) {
      setError(err.response?.data?.error || t('ไม่สามารถบันทึกได้'));
    } finally {
      setSavingTaskId(null);
    }
  };

  // Tasks eligible for one-tap bulk record (not yet recorded, not SCORED)
  const getBulkInfo = () => {
    const pending = (scanResult?.tasks || []).filter(t => !isTaskSubmitted(t));
    const eligible = pending.filter(t => t.scoringType !== 'SCORED');
    const scoredLeft = pending.length - eligible.length;
    const allSubmissionOnly = eligible.length > 0 && eligible.every(t => t.scoringType === 'SUBMISSION_ONLY');
    return {
      eligible,
      scoredLeft,
      label: allSubmissionOnly ? t('ส่งแล้วทั้งหมด') : t('ผ่านทั้งหมด')
    };
  };

  const handleBulkApprove = async () => {
    if (!scanResult || bulkSaving) return;
    primeAudio();
    const { eligible, scoredLeft } = getBulkInfo();
    if (eligible.length === 0) return;

    cancelAutoRestart();
    setBulkSaving(true);
    setError('');
    setOfflineNotice('');

    const studentId = scanResult.student.id;
    const prevItems = eligible.map(t => ({ id: t.id, status: t.submission?.status || 'NOT_SUBMITTED', notes: t.submission?.notes || '' }));
    const results = await Promise.allSettled(
      eligible.map(t => saveSubmission({ studentId, taskId: t.id, status: 'APPROVED', notes: '' }))
    );
    const okIds = new Set();
    const failed = [];
    let queuedCount = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        okIds.add(eligible[i].id);
        if (r.value === 'queued') queuedCount += 1;
      }
      else failed.push(eligible[i]);
    });

    const nextTasks = scanResult.tasks.map(t =>
      okIds.has(t.id) ? { ...t, submission: { ...t.submission, status: 'APPROVED', notes: '' } } : t
    );
    setScanResult(prev => ({
      ...prev,
      tasks: prev.tasks.map(t =>
        okIds.has(t.id) ? { ...t, submission: { ...t.submission, status: 'APPROVED', notes: '' } } : t
      )
    }));
    setBulkSaving(false);

    if (failed.length > 0) {
      const names = failed.map(t => `#${t.taskNumber}`).join(', ');
      setError(t('บันทึกสำเร็จ {value1} งาน แต่ไม่สำเร็จ {value2} งาน ({value3}) — กดปุ่มอีกครั้งเพื่อลองใหม่', { value1: okIds.size, value2: failed.length, value3: names }));
      if (okIds.size > 0) successFeedback('');
      return;
    }

    if (okIds.size > 0) {
      setBulkUndo({ studentId, items: prevItems.filter(i => okIds.has(i.id)) });
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => setBulkUndo(null), 5000);
    }

    if (queuedCount > 0) {
      setOfflineNotice(t('บันทึกในเครื่องแล้ว รอส่ง {value1} งาน — ระบบจะส่งให้เองเมื่อเน็ตกลับมา', { value1: queuedCount }));
    } else successFeedback(
      scoredLeft > 0
        ? t('บันทึกแล้ว {value1} งาน • เหลืองานคิดคะแนน {value2} งาน', { value1: okIds.size, value2: scoredLeft })
        : t('บันทึกแล้ว {value1} งาน', { value1: okIds.size })
    );

    const allDone = nextTasks.every(isTaskSubmitted);
    if (autoRestart && allDone) {
      setTimeout(() => startAutoRestartCountdown(), 500);
    }
  };

  const handleUndoBulk = async () => {
    const u = bulkUndo;
    if (!u) return;
    clearTimeout(undoTimerRef.current);
    setBulkUndo(null);
    cancelAutoRestart();
    const results = await Promise.allSettled(
      u.items.map(i => saveSubmission({ studentId: u.studentId, taskId: i.id, status: i.status, notes: i.notes }))
    );
    const okIds = new Set(u.items.filter((_, k) => results[k].status === 'fulfilled').map(i => i.id));
    const prev = Object.fromEntries(u.items.map(i => [i.id, i]));
    setScanResult(r => (r && r.student.id === u.studentId ? {
      ...r,
      tasks: r.tasks.map(t => okIds.has(t.id) ? { ...t, submission: { ...t.submission, status: prev[t.id].status, notes: prev[t.id].notes } } : t)
    } : r));
    if (okIds.size < u.items.length) setError(t('เลิกทำไม่สำเร็จ {value1} งาน', { value1: u.items.length - okIds.size }));
    else successFeedback(t('เลิกทำแล้ว {value1} งาน', { value1: okIds.size }));
  };

  const resetScanner = () => {
    clearTimeout(undoTimerRef.current);
    setBulkUndo(null);
    cancelAutoRestart();
    setScanResult(null);
    setError('');
    setOfflineNotice('');
    setManualCode('');
    setStudentSearchResult(null);
    setAvailableSubjects([]);
    setTaskFilter('not_submitted');
  };

  // Get status display info
  const getStatusInfo = (status) => {
    const info = {
      APPROVED: { label: t('ผ่าน'), color: 'bg-green-500 text-white', bgLight: 'bg-green-50 border-green-200' },
      REJECTED: { label: t('ไม่ผ่าน'), color: 'bg-red-500 text-white', bgLight: 'bg-red-50 border-red-200' },
      PENDING: { label: t('ส่งแล้ว'), color: 'bg-brand-500 text-white', bgLight: 'bg-brand-50 border-brand-200' },
      NOT_SUBMITTED: { label: t('ยังไม่ส่ง'), color: 'bg-gray-400 text-white', bgLight: 'bg-gray-50 border-gray-200' }
    };
    return info[status] || info.NOT_SUBMITTED;
  };

  // Check if task is submitted (has any status except NOT_SUBMITTED)
  const isTaskSubmitted = (task) => {
    const status = task.submission?.status;
    return status && status !== 'NOT_SUBMITTED';
  };

  // Filter tasks based on filter selection
  const getFilteredTasks = () => {
    if (!scanResult?.tasks) return [];

    switch (taskFilter) {
      case 'submitted':
        return scanResult.tasks.filter(isTaskSubmitted);
      case 'not_submitted':
        return scanResult.tasks.filter(t => !isTaskSubmitted(t));
      default:
        return scanResult.tasks;
    }
  };

  // Render task actions based on scoring type
  const renderTaskActions = (task) => {
    const currentStatus = task.submission?.status || 'NOT_SUBMITTED';
    const currentScore = task.submission?.score;
    const isSaving = savingTaskId === task.id;

    // Compact button styles for mobile
    const btnBase = "flex-1 min-h-[44px] py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 text-sm";

    switch (task.scoringType) {
      case 'SUBMISSION_ONLY':
        // ส่งแล้ว/ยังไม่ส่ง - ใช้ APPROVED แทน PENDING
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmissionUpdate(task.id, 'APPROVED')}
              disabled={isSaving}
              className={`${btnBase} ${
                currentStatus === 'APPROVED' || currentStatus === 'PENDING'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {isSaving ? '...' : t('✓ ส่งแล้ว')}
            </button>
            <button
              onClick={() => handleSubmissionUpdate(task.id, 'NOT_SUBMITTED')}
              disabled={isSaving}
              className={`${btnBase} ${
                currentStatus === 'NOT_SUBMITTED'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {isSaving ? '...' : t('ไม่ส่ง')}
            </button>
          </div>
        );

      case 'PASS_FAIL':
        // ผ่าน/ไม่ผ่าน
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmissionUpdate(task.id, 'APPROVED')}
              disabled={isSaving}
              className={`${btnBase} ${
                currentStatus === 'APPROVED'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {isSaving ? '...' : t('✓ ผ่าน')}
            </button>
            <button
              onClick={() => handleSubmissionUpdate(task.id, 'REJECTED')}
              disabled={isSaving}
              className={`${btnBase} ${
                currentStatus === 'REJECTED'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isSaving ? '...' : t('✗ ไม่ผ่าน')}
            </button>
          </div>
        );

      case 'SCORED':
        // คิดคะแนน - compact layout
        return (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min="0"
              max={task.maxScore || 100}
              step="0.5"
              value={currentScore ?? ''}
              onChange={(e) => {
                const newScore = e.target.value === '' ? null : parseFloat(e.target.value);
                setScanResult((prev) => ({
                  ...prev,
                  tasks: prev.tasks.map((t) =>
                    t.id === task.id
                      ? { ...t, submission: { ...t.submission, score: newScore } }
                      : t
                  )
                }));
              }}
              className="w-20 min-h-[44px] px-2 py-2 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-center"
              placeholder="0"
            />
            <span className="text-gray-500 text-sm whitespace-nowrap">/{task.maxScore || 100}</span>
            <button
              onClick={() => {
                const score = task.submission?.score;
                if (score !== null && score !== undefined) {
                  handleSubmissionUpdate(task.id, 'APPROVED', score);
                }
              }}
              disabled={isSaving || currentScore === null || currentScore === undefined}
              className={`${btnBase} ${
                currentStatus === 'APPROVED'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 disabled:bg-gray-100 disabled:text-gray-400'
              }`}
            >
              {isSaving ? '...' : t('✓ บันทึก')}
            </button>
            <button
              onClick={() => handleSubmissionUpdate(task.id, 'NOT_SUBMITTED', null)}
              disabled={isSaving}
              className={`px-3 py-2 min-h-[44px] rounded-lg font-medium text-sm transition-all active:scale-95 ${
                currentStatus === 'NOT_SUBMITTED'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >{t('ล้าง')}</button>
          </div>
        );

      default:
        // Default to pass/fail
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleSubmissionUpdate(task.id, 'APPROVED')}
              disabled={isSaving}
              className={`${btnBase} ${
                currentStatus === 'APPROVED'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {isSaving ? '...' : t('✓ ผ่าน')}
            </button>
            <button
              onClick={() => handleSubmissionUpdate(task.id, 'REJECTED')}
              disabled={isSaving}
              className={`${btnBase} ${
                currentStatus === 'REJECTED'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {isSaving ? '...' : t('✗ ไม่ผ่าน')}
            </button>
          </div>
        );
    }
  };

  // Calculate stats
  const getTaskStats = () => {
    if (!scanResult?.tasks) return { submitted: 0, notSubmitted: 0, total: 0 };

    const total = scanResult.tasks.length;
    const submitted = scanResult.tasks.filter(isTaskSubmitted).length;
    const notSubmitted = total - submitted;

    return { submitted, notSubmitted, total };
  };

  const filteredTasks = getFilteredTasks();
  const stats = getTaskStats();
  const bulk = getBulkInfo();

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{t('สแกนส่งงาน')}</h1>
        <div className="flex items-center gap-2">
          {/* ตั้งค่าที่ใช้ไม่บ่อย ซ่อนไว้ในปุ่มเล็ก */}
          <details className="relative">
            <summary className="list-none cursor-pointer flex items-center gap-1 min-h-[44px] px-3 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>{t('ตั้งค่า')}</summary>
            <div className="absolute right-0 z-20 mt-1 w-60 rounded-xl border bg-white p-3 shadow-lg">
              <button
                type="button"
                role="switch"
                aria-checked={autoRestart}
                onClick={() => setAutoRestart(!autoRestart)}
                className="flex w-full items-center justify-between gap-3 min-h-[44px] text-left"
              >
                <span className="text-sm text-gray-700">{t('สแกนคนต่อไปอัตโนมัติ')}<span className="block text-xs text-gray-500">{t('เมื่อตรวจครบทุกงาน')}</span>
                </span>
                <div className={`relative w-10 h-6 shrink-0 rounded-full transition-colors ${autoRestart ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoRestart ? 'translate-x-4' : ''}`} />
                </div>
              </button>
            </div>
          </details>
          {scanResult && (
            <button
              onClick={resetScanner}
              className="px-4 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span className="hidden sm:inline">{t('สแกนใหม่')}</span>
            </button>
          )}
        </div>
      </div>

      <OutboxStatusPill online={outbox.online} pending={outbox.pending} otherSchool={outbox.otherSchool} flushing={outbox.flushing} onFlush={outbox.flush} />

      {offlineNotice && (
        <div role="status" aria-live="polite" data-testid="offline-notice" className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-3 rounded-lg mb-4 flex items-center gap-2 flex-shrink-0 font-medium">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.5 2.5a1 1 0 001.414-1.414L11 9.586V6z" clipRule="evenodd" />
          </svg>
          {offlineNotice}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-center gap-2 flex-shrink-0">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Green success confirmation */}
      {flash && (
        <div role="status" aria-live="polite" className="bg-green-600 text-white px-4 py-3 rounded-lg mb-2 flex items-center gap-2 font-medium shadow flex-shrink-0">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {flash}
        </div>
      )}

      {bulkUndo && (
        <div className="bg-green-600 text-white px-4 py-2 rounded-lg mb-2 flex items-center justify-between gap-2 font-medium shadow flex-shrink-0">
          <span>{t('บันทึกแล้ว {value1} งาน', { value1: bulkUndo.items.length })}</span>
          <button type="button" onClick={handleUndoBulk} className="min-h-[44px] px-4 rounded-lg bg-white/20 hover:bg-white/30 font-semibold underline">{t('เลิกทำ')}</button>
        </div>
      )}

      {/* Auto-restart Countdown Overlay */}
      {countdown > 0 && (
        <div className="modal-backdrop" onClick={scanNextNow}>
          <div className="modal-panel sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">{t('ตรวจครบแล้ว!')}</h3>
            <p className="text-gray-500 text-sm mb-4">{t('สแกนคนต่อไปใน {value1}...', { value1: countdown })}</p>
            <div className="flex gap-2">
              <button
                onClick={cancelAutoRestart}
                className="flex-1 px-4 py-3 min-h-[48px] bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >{t('อยู่หน้านี้')}</button>
              <button
                onClick={scanNextNow}
                className="flex-1 px-4 py-3 min-h-[48px] bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-medium text-sm"
              >{t('สแกนเลย →')}</button>
            </div>
          </div>
        </div>
      )}

      {!scanResult ? (
        /* Scanner View */
        <div className="bg-white rounded-2xl shadow-lg p-3 sm:p-6 flex-1 flex flex-col overflow-hidden">
          <div
            id="qr-reader"
            ref={scannerRef}
            className="w-full max-w-md mx-auto mb-4 rounded-xl overflow-hidden"
            style={{ display: scanning ? 'block' : 'none' }}
          />

          {!scanning && !showManualInput ? (
            <div className="text-center py-8 flex-1 flex flex-col justify-center">
              <NotebookQR className="mx-auto mb-4 h-32 sm:h-40 w-auto text-brand-600" />
              <button
                onClick={startScanner}
                className="w-full sm:w-auto px-8 py-4 min-h-[56px] bg-brand-600 text-white rounded-2xl hover:bg-brand-700 transition-all text-lg font-medium shadow-lg shadow-brand-200 active:scale-95"
              >{t('เปิดกล้องสแกน')}</button>
              <p className="mt-4 text-gray-500">{t('QR อยู่บนปกสมุดนักเรียน ส่องให้อยู่ในกรอบ')}</p>
              <button
                onClick={() => setShowManualInput(true)}
                className="mt-4 min-h-[44px] px-3 text-brand-600 hover:text-brand-800 text-sm underline"
              >{t('สแกนไม่ติด? พิมพ์รหัสแทน')}</button>
            </div>
          ) : scanning ? (
            <div className="text-center">
              <p className="mb-4 text-gray-600">{t('กำลังสแกน... หัน QR Code มาที่กล้อง')}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={stopScanner}
                  className="flex-1 sm:flex-none px-6 py-3 min-h-[48px] bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors"
                >{t('หยุดสแกน')}</button>
                <button
                  onClick={() => {
                    stopScanner();
                    setShowManualInput(true);
                  }}
                  className="flex-1 sm:flex-none px-6 py-3 min-h-[48px] bg-brand-100 text-brand-700 rounded-xl hover:bg-brand-200 transition-colors"
                >{t('พิมพ์รหัสแทน')}</button>
              </div>
            </div>
          ) : studentSearchResult ? (
            /* Subject Selection after student found */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="text-center mb-4 flex-shrink-0">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full mb-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>{t('พบนักเรียน')}</div>
                <h3 className="text-xl font-bold text-gray-800 break-words">{studentSearchResult.name}</h3>
                <p className="text-gray-500">{studentSearchResult.studentCode} • {studentSearchResult.class?.className}</p>
              </div>

              <div className="border-t pt-4 flex-1 flex flex-col overflow-hidden">
                <h4 className="font-medium text-gray-700 mb-3 flex-shrink-0">{t('เลือกวิชาที่ต้องการตรวจ:')}</h4>
                {availableSubjects.length > 0 ? (
                  <div className="space-y-2 flex-1 overflow-y-auto pb-4">
                    {availableSubjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => handleSelectSubject(subject.id)}
                        disabled={loading}
                        className="w-full p-4 min-h-[56px] text-left border-2 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-colors disabled:opacity-50"
                      >
                        <p className="font-medium text-gray-900">{subject.subjectName}</p>
                        <p className="text-sm text-gray-500">{subject.subjectCode}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">{t('ไม่พบวิชาสำหรับนักเรียนคนนี้')}</p>
                )}
              </div>

              <div className="flex justify-center pt-4 border-t flex-shrink-0">
                <button
                  onClick={() => {
                    setStudentSearchResult(null);
                    setAvailableSubjects([]);
                    setManualCode('');
                  }}
                  className="px-6 py-2 min-h-[44px] bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >{t('ค้นหานักเรียนอื่น')}</button>
              </div>
            </div>
          ) : (
            /* Manual Input - Student Code or QR Code */
            <div className="text-center py-4 flex-1 flex flex-col justify-center">
              <h3 className="text-lg font-medium text-gray-800 mb-4">{t('ค้นหานักเรียน')}</h3>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={t("รหัสนักเรียน หรือ รหัส QR")}
                  className="w-full px-4 py-3 min-h-[52px] text-center text-xl border-2 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  autoFocus
                />
                <div className="flex gap-2 justify-center">
                  <button
                    type="submit"
                    disabled={!manualCode.trim() || loading}
                    className="flex-1 sm:flex-none px-6 py-3 min-h-[48px] bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? t('กำลังค้นหา...') : t('ค้นหา')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualInput(false);
                      setManualCode('');
                    }}
                    className="flex-1 sm:flex-none px-6 py-3 min-h-[48px] bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                  >{t('กลับ')}</button>
                </div>
              </form>
              <p className="mt-4 text-sm text-gray-500">{t('พิมพ์รหัสนักเรียน (เช่น 671101) หรือรหัส QR (SNT-...)')}</p>
            </div>
          )}

          {loading && !showManualInput && (
            <div className="flex items-center justify-center mt-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
            </div>
          )}
        </div>
      ) : (
        /* Result View */
        <div className="flex-1 flex flex-col overflow-hidden space-y-2">
          {/* Compact Student & Subject Info Card with Stats */}
          <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-xl p-3 text-white shadow-lg flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{scanResult.student.name}</h2>
                <p className="text-brand-100 text-xs break-words">
                  {scanResult.student.studentCode} • {scanResult.student.class?.className} • {scanResult.subject.subjectName}
                </p>
              </div>
              <button
                onClick={() => navigate(`/monitor/student/${scanResult.student.id}?subjectId=${scanResult.subject.id}`)}
                className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/20 rounded-lg hover:bg-white/30 transition-colors ml-2 flex-shrink-0"
                title={t("ดูข้อมูลทั้งหมด")}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
            {/* Inline Stats */}
            <div className="flex gap-4 mt-2 pt-2 border-t border-white/20 text-center">
              <div className="flex-1">
                <span className="text-xl font-bold">{stats.total}</span>
                <span className="text-brand-200 text-xs ml-1">{t('งาน')}</span>
              </div>
              <div className="flex-1">
                <span className="text-xl font-bold text-green-300">{stats.submitted}</span>
                <span className="text-brand-200 text-xs ml-1">{t('ส่ง')}</span>
              </div>
              <div className="flex-1">
                <span className="text-xl font-bold text-orange-300">{stats.notSubmitted}</span>
                <span className="text-brand-200 text-xs ml-1">{t('ค้าง')}</span>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden flex-1 flex flex-col min-h-0">
            {/* Compact Filter Header */}
            <div className="px-3 py-2 bg-gray-50 border-b flex-shrink-0">
              <div className="flex gap-1">
                <button
                  onClick={() => setTaskFilter('not_submitted')}
                  className={`flex-1 px-2 py-2.5 min-h-[44px] text-xs font-medium rounded-lg transition-colors ${
                    taskFilter === 'not_submitted'
                      ? 'bg-orange-600 text-white'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >{t('ค้าง ({value1})', { value1: stats.notSubmitted })}</button>
                <button
                  onClick={() => setTaskFilter('submitted')}
                  className={`flex-1 px-2 py-2.5 min-h-[44px] text-xs font-medium rounded-lg transition-colors ${
                    taskFilter === 'submitted'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700'
                  }`}
                >{t('ส่งแล้ว ({value1})', { value1: stats.submitted })}</button>
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`flex-1 px-2 py-2.5 min-h-[44px] text-xs font-medium rounded-lg transition-colors ${
                    taskFilter === 'all'
                      ? 'bg-brand-600 text-white'
                      : 'bg-brand-100 text-brand-700'
                  }`}
                >{t('ทั้งหมด ({value1})', { value1: stats.total })}</button>
              </div>
            </div>

            <div className="divide-y flex-1 overflow-y-auto">
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task) => {
                  const status = task.submission?.status || 'NOT_SUBMITTED';
                  const statusInfo = getStatusInfo(status);
                  const isSuccess = successTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`p-3 transition-all duration-300 ${
                        isSuccess ? 'bg-green-50' : ''
                      }`}
                    >
                      {/* Compact Task Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-brand-100 text-brand-700 rounded font-bold text-xs flex-shrink-0">
                            {task.taskNumber}
                          </span>
                          <span className="font-medium text-gray-900 text-sm truncate">{task.taskName}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                          {isSuccess && (
                            <span className="text-green-600 animate-pulse">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.color}`}>
                            {statusInfo.label}
                            {task.scoringType === 'SCORED' && task.submission?.score !== null && task.submission?.score !== undefined && (
                              <span className="ml-0.5">({task.submission.score})</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Task Actions */}
                      {renderTaskActions(task)}
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>
                    {taskFilter === 'not_submitted'
                      ? t('ส่งงานครบทุกงานแล้ว!')
                      : taskFilter === 'submitted'
                        ? t('ยังไม่มีงานที่ส่ง')
                        : t('ไม่มีรายการงาน')
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* One-tap bulk record (thumb zone) */}
          {bulk.eligible.length > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={bulkSaving || savingTaskId !== null}
              className="w-full py-4 min-h-[64px] bg-green-600 text-white rounded-xl hover:bg-green-700 active:scale-[0.98] transition-all font-bold text-lg shadow-lg flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-60"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              {bulkSaving ? t('กำลังบันทึก...') : `${bulk.label} (${bulk.eligible.length})`}
            </button>
          )}
          {bulk.scoredLeft > 0 && (
            <p className="text-xs text-gray-500 text-center flex-shrink-0">{t('งานคิดคะแนน {value1} งาน ต้องกรอกคะแนนทีละงาน (ไม่รวมในปุ่มบันทึกทั้งหมด)', { value1: bulk.scoredLeft })}</p>
          )}

          {/* Always visible "Scan Next" button at bottom */}
          <button
            onClick={scanNextNow}
            className="w-full py-4 min-h-[56px] bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors font-medium text-lg shadow-lg flex items-center justify-center gap-2 flex-shrink-0"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>{t('สแกนคนถัดไป')}</button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
