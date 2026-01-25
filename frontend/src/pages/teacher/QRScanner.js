import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { qrcodeAPI, submissionAPI } from '../../services/api';

const QRScanner = () => {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
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
    return saved !== null ? saved === 'true' : false;
  });
  // Countdown for auto-restart
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    return () => {
      stopScanner();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Save autoRestart preference
  useEffect(() => {
    localStorage.setItem('qrScanner_autoRestart', autoRestart.toString());
  }, [autoRestart]);

  const startScanner = async () => {
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
      setError('ไม่สามารถเปิดกล้องได้: ' + err.message);
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
      setError(err.response?.data?.error || 'QR Code ไม่ถูกต้อง');
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
      if (code.startsWith('SNT-')) {
        try {
          const scanResponse = await qrcodeAPI.scan({ qrcodeData: code });
          setScanResult(scanResponse.data);
          setStudentSearchResult(null);
          setAvailableSubjects([]);
          return;
        } catch {
          // If QR scan fails, continue to student search
        }
      }

      // Search by student code
      const response = await qrcodeAPI.searchByStudent({ studentCode: code });

      if (response.data.tasks) {
        // If tasks are returned, set as scan result
        setScanResult(response.data);
        setStudentSearchResult(null);
        setAvailableSubjects([]);
      } else if (response.data.subjects) {
        // If subjects are returned, show subject selection
        setStudentSearchResult(response.data.student);
        setAvailableSubjects(response.data.subjects);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่พบข้อมูล');
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
      setError(err.response?.data?.error || 'ไม่สามารถโหลดข้อมูลได้');
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

    setSavingTaskId(taskId);
    setError('');

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

      await submissionAPI.createOrUpdate(data);

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
      setError(err.response?.data?.error || 'ไม่สามารถบันทึกได้');
    } finally {
      setSavingTaskId(null);
    }
  };

  const resetScanner = () => {
    cancelAutoRestart();
    setScanResult(null);
    setError('');
    setManualCode('');
    setStudentSearchResult(null);
    setAvailableSubjects([]);
    setTaskFilter('not_submitted');
  };

  // Get status display info
  const getStatusInfo = (status) => {
    const info = {
      APPROVED: { label: 'ผ่าน', color: 'bg-green-500 text-white', bgLight: 'bg-green-50 border-green-200' },
      REJECTED: { label: 'ไม่ผ่าน', color: 'bg-red-500 text-white', bgLight: 'bg-red-50 border-red-200' },
      PENDING: { label: 'ส่งแล้ว', color: 'bg-blue-500 text-white', bgLight: 'bg-blue-50 border-blue-200' },
      NOT_SUBMITTED: { label: 'ยังไม่ส่ง', color: 'bg-gray-400 text-white', bgLight: 'bg-gray-50 border-gray-200' }
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
    const btnBase = "flex-1 py-2 rounded-lg font-medium transition-all active:scale-95 disabled:opacity-50 text-sm";

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
              {isSaving ? '...' : '✓ ส่งแล้ว'}
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
              {isSaving ? '...' : 'ไม่ส่ง'}
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
              {isSaving ? '...' : '✓ ผ่าน'}
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
              {isSaving ? '...' : '✗ ไม่ผ่าน'}
            </button>
          </div>
        );

      case 'SCORED':
        // คิดคะแนน - compact layout
        return (
          <div className="flex items-center gap-2">
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
              className="w-20 px-2 py-2 text-base font-medium border-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
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
              {isSaving ? '...' : '✓ บันทึก'}
            </button>
            <button
              onClick={() => handleSubmissionUpdate(task.id, 'NOT_SUBMITTED', null)}
              disabled={isSaving}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-all active:scale-95 ${
                currentStatus === 'NOT_SUBMITTED'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              ล้าง
            </button>
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
              {isSaving ? '...' : '✓ ผ่าน'}
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
              {isSaving ? '...' : '✗ ไม่ผ่าน'}
            </button>
          </div>
        );
    }
  };

  // Get scoring type label
  const getScoringTypeLabel = (type) => {
    const labels = {
      SUBMISSION_ONLY: 'ส่ง/ไม่ส่ง',
      PASS_FAIL: 'ผ่าน/ไม่ผ่าน',
      SCORED: 'คิดคะแนน'
    };
    return labels[type] || 'ผ่าน/ไม่ผ่าน';
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

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">สแกน QR Code</h1>
        <div className="flex items-center gap-2">
          {/* Auto-restart Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-gray-600 hidden sm:inline">ต่อเนื่อง</span>
            <div
              onClick={() => setAutoRestart(!autoRestart)}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                autoRestart ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  autoRestart ? 'translate-x-4' : ''
                }`}
              />
            </div>
          </label>
          {scanResult && (
            <button
              onClick={resetScanner}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
              <span className="hidden sm:inline">สแกนใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 flex items-center gap-2 flex-shrink-0">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Auto-restart Countdown Overlay */}
      {countdown > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={scanNextNow}>
          <div className="bg-white rounded-2xl p-6 text-center shadow-2xl max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">ตรวจครบแล้ว!</h3>
            <p className="text-gray-500 text-sm mb-4">สแกนคนต่อไปใน {countdown}...</p>
            <div className="flex gap-2">
              <button
                onClick={cancelAutoRestart}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                อยู่หน้านี้
              </button>
              <button
                onClick={scanNextNow}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                สแกนเลย →
              </button>
            </div>
          </div>
        </div>
      )}

      {!scanResult ? (
        /* Scanner View */
        <div className="bg-white rounded-2xl shadow-lg p-6 flex-1 flex flex-col overflow-hidden">
          <div
            id="qr-reader"
            ref={scannerRef}
            className="w-full max-w-sm mx-auto mb-4 rounded-xl overflow-hidden"
            style={{ display: scanning ? 'block' : 'none' }}
          />

          {!scanning && !showManualInput ? (
            <div className="text-center py-8 flex-1 flex flex-col justify-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
              </div>
              <button
                onClick={startScanner}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all text-lg font-medium shadow-lg shadow-blue-200 active:scale-95"
              >
                เปิดกล้องสแกน
              </button>
              <p className="mt-6 text-gray-500">
                กดปุ่มเพื่อสแกน QR Code บนสมุดนักเรียน
              </p>
              {autoRestart && (
                <p className="mt-2 text-green-600 text-sm flex items-center justify-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  โหมดสแกนต่อเนื่องเปิดอยู่
                </p>
              )}
              <button
                onClick={() => setShowManualInput(true)}
                className="mt-4 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                หรือพิมพ์รหัส QR แทน
              </button>
            </div>
          ) : scanning ? (
            <div className="text-center">
              <p className="mb-4 text-gray-600">กำลังสแกน... หัน QR Code มาที่กล้อง</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={stopScanner}
                  className="px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors"
                >
                  หยุดสแกน
                </button>
                <button
                  onClick={() => {
                    stopScanner();
                    setShowManualInput(true);
                  }}
                  className="px-6 py-3 bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors"
                >
                  พิมพ์รหัสแทน
                </button>
              </div>
            </div>
          ) : studentSearchResult ? (
            /* Subject Selection after student found */
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="text-center mb-4 flex-shrink-0">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full mb-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  พบนักเรียน
                </div>
                <h3 className="text-xl font-bold text-gray-800">{studentSearchResult.name}</h3>
                <p className="text-gray-500">{studentSearchResult.studentCode} • {studentSearchResult.class?.className}</p>
              </div>

              <div className="border-t pt-4 flex-1 flex flex-col overflow-hidden">
                <h4 className="font-medium text-gray-700 mb-3 flex-shrink-0">เลือกวิชาที่ต้องการตรวจ:</h4>
                {availableSubjects.length > 0 ? (
                  <div className="space-y-2 flex-1 overflow-y-auto pb-4">
                    {availableSubjects.map((subject) => (
                      <button
                        key={subject.id}
                        onClick={() => handleSelectSubject(subject.id)}
                        disabled={loading}
                        className="w-full p-4 text-left border-2 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        <p className="font-medium text-gray-900">{subject.subjectName}</p>
                        <p className="text-sm text-gray-500">{subject.subjectCode}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">ไม่พบวิชาสำหรับนักเรียนคนนี้</p>
                )}
              </div>

              <div className="flex justify-center pt-4 border-t flex-shrink-0">
                <button
                  onClick={() => {
                    setStudentSearchResult(null);
                    setAvailableSubjects([]);
                    setManualCode('');
                  }}
                  className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  ค้นหานักเรียนอื่น
                </button>
              </div>
            </div>
          ) : (
            /* Manual Input - Student Code or QR Code */
            <div className="text-center py-4 flex-1 flex flex-col justify-center">
              <h3 className="text-lg font-medium text-gray-800 mb-4">ค้นหานักเรียน</h3>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="รหัสนักเรียน หรือ รหัส QR"
                  className="w-full px-4 py-3 text-center text-xl border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
                <div className="flex gap-2 justify-center">
                  <button
                    type="submit"
                    disabled={!manualCode.trim() || loading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowManualInput(false);
                      setManualCode('');
                    }}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
                  >
                    กลับ
                  </button>
                </div>
              </form>
              <p className="mt-4 text-sm text-gray-500">
                พิมพ์รหัสนักเรียน (เช่น 671101) หรือรหัส QR (SNT-...)
              </p>
            </div>
          )}

          {loading && !showManualInput && (
            <div className="flex items-center justify-center mt-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            </div>
          )}
        </div>
      ) : (
        /* Result View */
        <div className="flex-1 flex flex-col overflow-hidden space-y-2">
          {/* Compact Student & Subject Info Card with Stats */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-3 text-white shadow-lg flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{scanResult.student.name}</h2>
                <p className="text-blue-100 text-xs">
                  {scanResult.student.studentCode} • {scanResult.student.class?.className} • {scanResult.subject.subjectName}
                </p>
              </div>
              <button
                onClick={() => navigate(`/monitor/student/${scanResult.student.id}?subjectId=${scanResult.subject.id}`)}
                className="p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors ml-2 flex-shrink-0"
                title="ดูข้อมูลทั้งหมด"
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
                <span className="text-blue-200 text-xs ml-1">งาน</span>
              </div>
              <div className="flex-1">
                <span className="text-xl font-bold text-green-300">{stats.submitted}</span>
                <span className="text-blue-200 text-xs ml-1">ส่ง</span>
              </div>
              <div className="flex-1">
                <span className="text-xl font-bold text-orange-300">{stats.notSubmitted}</span>
                <span className="text-blue-200 text-xs ml-1">ค้าง</span>
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
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    taskFilter === 'not_submitted'
                      ? 'bg-orange-600 text-white'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  ค้าง ({stats.notSubmitted})
                </button>
                <button
                  onClick={() => setTaskFilter('submitted')}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    taskFilter === 'submitted'
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  ส่งแล้ว ({stats.submitted})
                </button>
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    taskFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  ทั้งหมด ({stats.total})
                </button>
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
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-700 rounded font-bold text-xs flex-shrink-0">
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
                      ? 'ส่งงานครบทุกงานแล้ว!'
                      : taskFilter === 'submitted'
                        ? 'ยังไม่มีงานที่ส่ง'
                        : 'ไม่มีรายการงาน'
                    }
                  </p>
                  {taskFilter === 'not_submitted' && stats.notSubmitted === 0 && countdown === 0 && (
                    <button
                      onClick={scanNextNow}
                      className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                    >
                      สแกนคนถัดไป →
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
