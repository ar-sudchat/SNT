import { t, tx } from '../../i18n';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { monitorAPI, subjectAPI, academicYearAPI, gradeAPI, classAPI, submissionAPI } from '../../services/api';
import { MonitorFilterBar, MonitorFilterField } from './MonitorFilterBar';
import { useDialog } from '../../components/ui/DialogProvider';
import { ReminderButton, shortThaiDate } from './reminderText';

const LAST_SUBJECT_KEY = 'monitor.lastSubjectId';
const readSaved = (key) => {
  try { const v = parseInt(localStorage.getItem(key)); return Number.isNaN(v) ? null : v; } catch { return null; }
};
const writeSaved = (key, val) => {
  try { if (val) localStorage.setItem(key, String(val)); } catch { /* ignore */ }
};

const SubjectMonitor = ({ embedded = false }) => {
  const dialog = useDialog();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL
  const urlAcademicYear = searchParams.get('ay');
  const urlGrade = searchParams.get('grade');
  const urlClass = searchParams.get('class');
  const urlSubject = searchParams.get('subject');

  const [data, setData] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [grades, setGrades] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(urlSubject ? parseInt(urlSubject) : null);
  const [filterAcademicYear, setFilterAcademicYear] = useState(urlAcademicYear ? parseInt(urlAcademicYear) : null);
  const [filterGrade, setFilterGrade] = useState(urlGrade ? parseInt(urlGrade) : null);
  const [filterClass, setFilterClass] = useState(urlClass ? parseInt(urlClass) : null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  // Quick Grade states
  const [quickGradeMode, setQuickGradeMode] = useState(false);
  const [savingCell, setSavingCell] = useState(null); // {studentId, taskId}
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Search term for filtering students
  const [quickFilter, setQuickFilter] = useState('all'); // all | missing | pending

  // Update URL when filters change
  const updateURL = useCallback((ay, grade, cls, subj) => {
    const params = new URLSearchParams();
    if (ay) params.set('ay', ay);
    if (grade) params.set('grade', grade);
    if (cls) params.set('class', cls);
    if (subj) params.set('subject', subj);
    // คงตัวกรองงาน (task) ไว้ถ้ายังเป็นวิชาเดิม
    const t = searchParams.get('task');
    if (t && subj && String(subj) === searchParams.get('subject')) params.set('task', t);
    const keepMode = new URLSearchParams(window.location.search).get('mode');
    if (keepMode) params.set('mode', keepMode);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const taskFilter = parseInt(searchParams.get('task'), 10) || null;
  const clearTaskFilter = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('task');
    setSearchParams(params, { replace: true });
  };

  // Initial load
  useEffect(() => {
    const initializeData = async () => {
      try {
        const [academicYearRes, gradeRes] = await Promise.all([
          academicYearAPI.getAll(),
          gradeAPI.getAll()
        ]);
        setAcademicYears(academicYearRes.data);
        setGrades(gradeRes.data);

        // Use URL param or current year
        if (!urlAcademicYear) {
          const currentYear = academicYearRes.data.find(y => y.isCurrent);
          if (currentYear) {
            setFilterAcademicYear(currentYear.id);
          }
        }
        setInitialLoadDone(true);
      } catch (err) {
        setError(t('ไม่สามารถโหลดข้อมูลได้'));
        setInitialLoadDone(true);
      }
    };
    initializeData();
  }, [urlAcademicYear]);

  // Fetch subjects when filters change
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!filterAcademicYear) return;
      try {
        const params = { academicYearId: filterAcademicYear };
        if (filterGrade) params.gradeId = filterGrade;
        const response = await subjectAPI.getAll(params);
        setSubjects(response.data);
      } catch (err) {
        console.error('Error fetching subjects:', err);
      }
    };
    fetchSubjects();
  }, [filterAcademicYear, filterGrade]);

  // Fetch classes when academic year or grade changes
  useEffect(() => {
    const fetchClasses = async () => {
      if (!filterAcademicYear) return;
      try {
        const params = { academicYearId: filterAcademicYear };
        if (filterGrade) params.gradeId = filterGrade;
        const response = await classAPI.getAll(params);
        setClasses(response.data);
      } catch (err) {
        console.error('Error fetching classes:', err);
      }
    };
    fetchClasses();
  }, [filterAcademicYear, filterGrade]);

  // เลือกรายการแรกให้อัตโนมัติ เพื่อให้เห็นผลทันทีโดยไม่ต้องตั้งค่า
  useEffect(() => {
    if (subjects.length > 0) {
      setSelectedSubject(prev => {
        if (prev) return prev;
        const saved = readSaved(LAST_SUBJECT_KEY);
        return subjects.some(x => x.id === saved) ? saved : subjects[0].id;
      });
    }
  }, [subjects]);

  // จำวิชาที่เลือกล่าสุดไว้ใช้ครั้งหน้า
  useEffect(() => { writeSaved(LAST_SUBJECT_KEY, selectedSubject); }, [selectedSubject]);

  // Fetch subject monitor data
  const fetchData = useCallback(async () => {
    if (!selectedSubject || !initialLoadDone) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = {};
      if (filterClass) params.classId = filterClass;
      const response = await monitorAPI.getSubjectMonitor(selectedSubject, params);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || t('ไม่สามารถโหลดข้อมูลได้'));
    } finally {
      setLoading(false);
    }
  }, [selectedSubject, filterClass, initialLoadDone]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStudentClick = (studentId) => {
    if (!quickGradeMode) {
      navigate(`/monitor/student/${studentId}?subjectId=${selectedSubject}`);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (!data) return;
    setExporting(true);

    try {
      // Dynamic import xlsx
      const XLSX = await import('xlsx');

      // Prepare data for export
      const exportData = data.students.map(student => {
        const row = {
          'รหัสนักเรียน': student.studentCode,
          'ชื่อ-สกุล': student.name,
          'ห้อง': student.className,
          'ความคืบหน้า (%)': student.progress.percentage
        };

        // Add task columns
        data.tasks.forEach(task => {
          const sub = student.submissions.find(s => s.taskId === task.id);
          const status = sub?.status || 'NOT_SUBMITTED';
          let displayValue;
          if (status === 'APPROVED') displayValue = 'ผ่าน';
          else if (status === 'PENDING') displayValue = 'รอตรวจ';
          else if (status === 'REJECTED') displayValue = 'ไม่ผ่าน';
          else if (status === 'NOT_ASSIGNED') displayValue = 'ไม่ได้รับงาน';
          else displayValue = '-';

          // If scored, show score
          if (task.scoringType === 'SCORED' && sub?.score !== null && sub?.score !== undefined) {
            displayValue = sub.score;
          }

          row[`งาน ${task.taskNumber}`] = displayValue;
        });

        return row;
      });

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'รายงานการส่งงาน');

      // Auto-fit column widths
      const maxWidth = 20;
      const colWidths = Object.keys(exportData[0] || {}).map(key => ({
        wch: Math.min(maxWidth, Math.max(key.length, ...exportData.map(row => String(row[key] || '').length)))
      }));
      ws['!cols'] = colWidths;

      // Generate filename
      const filename = `${data.subject.subjectCode}_${data.subject.subjectName}_${new Date().toLocaleDateString('th-TH').replace(/\//g, '-')}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Export error:', err);
      setError(t('ไม่สามารถ Export ได้'));
    } finally {
      setExporting(false);
    }
  };

  // Quick Grade - toggle status on cell click
  const handleQuickGrade = async (e, studentId, taskId, currentStatus, task) => {
    e.stopPropagation(); // Prevent row click
    if (!quickGradeMode) return;

    setSavingCell({ studentId, taskId });

    // Determine next status based on scoring type
    let newStatus;
    if (task.scoringType === 'SUBMISSION_ONLY') {
      // Toggle between APPROVED and NOT_SUBMITTED
      newStatus = currentStatus === 'APPROVED' ? 'NOT_SUBMITTED' : 'APPROVED';
    } else if (task.scoringType === 'PASS_FAIL') {
      // Cycle: NOT_SUBMITTED -> APPROVED -> REJECTED -> NOT_SUBMITTED
      if (currentStatus === 'NOT_SUBMITTED') newStatus = 'APPROVED';
      else if (currentStatus === 'APPROVED') newStatus = 'REJECTED';
      else newStatus = 'NOT_SUBMITTED';
    } else {
      // SCORED - just toggle APPROVED/NOT_SUBMITTED for now
      newStatus = currentStatus === 'APPROVED' ? 'NOT_SUBMITTED' : 'APPROVED';
    }

    try {
      await submissionAPI.createOrUpdate({
        studentId,
        taskId,
        status: newStatus
      });

      // Update local state
      setData(prev => ({
        ...prev,
        students: prev.students.map(student => {
          if (student.id !== studentId) return student;

          const newSubmissions = student.submissions.map(sub => {
            if (sub.taskId !== taskId) return sub;
            return { ...sub, status: newStatus };
          });

          // Check if submission exists, if not add it
          if (!newSubmissions.find(s => s.taskId === taskId)) {
            newSubmissions.push({ taskId, taskNumber: task.taskNumber, status: newStatus });
          }

          // Recalculate progress
          // งานที่ห้องนี้ไม่ได้ (NOT_ASSIGNED) ไม่นับ
          const totalTasks = newSubmissions.filter(s => s.status !== 'NOT_ASSIGNED').length;
          const submitted = newSubmissions.filter(s => s.status !== 'NOT_SUBMITTED' && s.status !== 'NOT_ASSIGNED').length;
          const approved = newSubmissions.filter(s => s.status === 'APPROVED').length;

          return {
            ...student,
            submissions: newSubmissions,
            progress: {
              totalTasks,
              submitted,
              approved,
              percentage: totalTasks > 0 ? Math.round((submitted / totalTasks) * 100) : 0,
              approvedPercentage: totalTasks > 0 ? Math.round((approved / totalTasks) * 100) : 0
            }
          };
        })
      }));
    } catch (err) {
      setError(t('ไม่สามารถบันทึกได้'));
    } finally {
      setSavingCell(null);
    }
  };

  // Batch Mark All for a specific task
  const handleBatchMarkAll = async (taskId, task) => {
    if (!data) return;
    const okAll = await dialog.confirm({
      title: t('ให้ทุกคนผ่านงานนี้?'),
      message: t('ต้องการให้ทุกคนผ่านงาน "{value1}" หรือไม่?', { value1: task.taskName }),
      confirmText: t('ให้ผ่านทั้งหมด'),
      type: 'warning',
    });
    if (!okAll) return;

    const studentsToUpdate = data.students.filter(student => {
      const sub = student.submissions.find(s => s.taskId === taskId);
      return !sub || sub.status === 'NOT_SUBMITTED';
    });

    if (studentsToUpdate.length === 0) {
      await dialog.alert({ title: t('ส่งครบแล้ว'), message: t('ทุกคนส่งงานครบแล้ว'), type: 'success' });
      return;
    }

    setSavingCell({ taskId, batch: true });

    try {
      await submissionAPI.bulkUpdate({
        submissions: studentsToUpdate.map(student => ({
          studentId: student.id,
          taskId,
          status: 'APPROVED'
        }))
      });

      // Refresh data
      fetchData();
    } catch (err) {
      setError(t('ไม่สามารถบันทึกได้'));
    } finally {
      setSavingCell(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'APPROVED': return '✓';
      case 'PENDING': return '○';
      case 'REJECTED': return '✗';
      default: return '-';
    }
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getProgressBgColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-100 text-green-800';
    if (percentage >= 50) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const activeTask = data && taskFilter ? data.tasks.find(t => t.id === taskFilter) || null : null;
  const activeTasks = useMemo(() => {
    if (!data) return [];
    const one = taskFilter ? data.tasks.filter(t => t.id === taskFilter) : [];
    return one.length ? one : data.tasks;
  }, [data, taskFilter]);

  const studentsWithCounts = useMemo(() => {
    if (!data) return [];
    return data.students.map(s => {
      let missing = 0;
      let pending = 0;
      activeTasks.forEach(task => {
        const status = s.submissions.find(x => x.taskId === task.id)?.status || 'NOT_SUBMITTED';
        if (status === 'NOT_SUBMITTED') missing += 1;
        else if (status === 'PENDING') pending += 1;
      });
      return { ...s, missing, pending };
    });
  }, [data, activeTasks]);

  // ส่งแล้ว = สถานะใดๆ ที่ไม่ใช่ NOT_SUBMITTED / (งาน × นักเรียน) — นิยามเดียวกับหน้าแรกครู
  const workTotal = studentsWithCounts.length * activeTasks.length;
  const workSent = workTotal - studentsWithCounts.reduce((sum, s) => sum + s.missing, 0);
  const workPct = workTotal > 0 ? Math.round((workSent / workTotal) * 100) : 0;

  const counts = useMemo(() => ({
    all: studentsWithCounts.length,
    missing: studentsWithCounts.filter(s => s.missing > 0).length,
    pending: studentsWithCounts.filter(s => s.pending > 0).length,
    complete: studentsWithCounts.filter(s => s.missing === 0).length,
    pendingTasks: studentsWithCounts.reduce((sum, s) => sum + s.pending, 0)
  }), [studentsWithCounts]);

  // ค่าเริ่มต้นของตัวกรอง: มีคนค้าง -> 'ยังไม่ส่ง' · ไม่มี -> 'ทั้งหมด' (ตั้งครั้งเดียวต่อการเลือก)
  const autoFilterFor = useRef(null);
  useEffect(() => {
    if (loading || !data || autoFilterFor.current === selectedSubject) return;
    autoFilterFor.current = selectedSubject;
    setQuickFilter(counts.missing > 0 ? 'missing' : 'all');
  }, [loading, data, selectedSubject, counts.missing]);

  const visibleStudents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return studentsWithCounts.filter(student => {
      if (quickFilter === 'missing' && student.missing === 0) return false;
      if (quickFilter === 'pending' && student.pending === 0) return false;
      if (!term) return true;
      return (
        student.name?.toLowerCase().includes(term) ||
        student.studentCode?.toLowerCase().includes(term) ||
        String(student.studentNumber || '').includes(term)
      );
    });
  }, [studentsWithCounts, quickFilter, searchTerm]);

  // เรียงตามห้องแล้วตามเลขที่ · แบ่งกลุ่มตามห้องเมื่อดูทุกห้อง
  const sortedByNumber = useMemo(() => [...visibleStudents].sort(
    (a, b) => String(a.className || '').localeCompare(String(b.className || ''), 'th', { numeric: true })
      || (parseInt(a.studentNumber) || 9999) - (parseInt(b.studentNumber) || 9999)
  ), [visibleStudents]);
  const showClassGroups = !filterClass && new Set(sortedByNumber.map(s => s.className)).size > 1;
  const isGroupStart = (i) => showClassGroups && (i === 0 || sortedByNumber[i - 1].className !== sortedByNumber[i].className);
  const groupSize = (cls) => sortedByNumber.filter(s => s.className === cls).length;

  // ข้อมูลสำหรับข้อความทวงงาน — ทุกคนที่ค้างในมุมมองปัจจุบัน (ตามห้อง/งานที่เลือก) ไม่ขึ้นกับช่องค้นหา
  const reminder = useMemo(() => {
    const gradeName = data?.subject?.grade?.gradeName || data?.subject?.grade?.name || '';
    const subjName = data?.subject?.subjectName || '';
    const base = [subjName, gradeName && !subjName.includes(gradeName) ? gradeName : ''].filter(Boolean).join(' ');
    const many = activeTasks.length > 1;
    const title = activeTask
      ? `${base} — ${activeTask.taskName}`
      : `${base} — งานที่ยังไม่ส่ง`;
    const items = [...studentsWithCounts].filter(s => s.missing > 0).sort(
      (a, b) => String(a.className || '').localeCompare(String(b.className || ''), 'th', { numeric: true })
        || (parseInt(a.studentNumber) || 9999) - (parseInt(b.studentNumber) || 9999)
    ).map(s => ({
      name: s.name, number: s.studentNumber, group: s.className,
      detail: many ? `ค้าง ${s.missing} งาน` : ''
    }));
    return { title, deadline: activeTask ? shortThaiDate(activeTask.deadline) : '', items };
  }, [data, activeTask, activeTasks, studentsWithCounts]);


  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      {!embedded && <div className="flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          aria-label={t("ย้อนกลับ")}
          className="w-11 h-11 -ml-2 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{t('ติดตามงานรายวิชา')}</h1>
      </div>}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600" aria-label={t("ปิด")}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ตัวกรอง: แสดงตลอด เปลี่ยนแล้วใช้ทันที */}
      <MonitorFilterBar>
        <MonitorFilterField
          label={t("ปีการศึกษา")}
          options={academicYears}
          value={filterAcademicYear}
          onChange={(val) => {
            setFilterAcademicYear(val);
            setFilterGrade(null);
            setFilterClass(null);
            setSelectedSubject(null);
            setData(null);
            updateURL(val, null, null, null);
          }}
          labelKey="year"
          valueKey="id"
          placeholder={t("เลือกปีการศึกษา")}
          clearable={false}
        />
        <MonitorFilterField
          label={t("ชั้น")}
          options={grades}
          value={filterGrade}
          onChange={(val) => {
            setFilterGrade(val);
            setFilterClass(null);
            setSelectedSubject(null);
            setData(null);
            updateURL(filterAcademicYear, val, null, null);
          }}
          labelKey="gradeName"
          valueKey="id"
          placeholder={t("ทุกชั้น")}
        />
        <MonitorFilterField
          label={t("วิชา")}
          options={subjects}
          value={selectedSubject}
          onChange={(val) => {
            setSelectedSubject(val);
            updateURL(filterAcademicYear, filterGrade, filterClass, val);
          }}
          labelKey="subjectName"
          valueKey="id"
          placeholder={t("เลือกวิชา")}
        />
        <MonitorFilterField
          label={t("ห้องเรียน")}
          options={classes}
          value={filterClass}
          onChange={(val) => {
            setFilterClass(val);
            updateURL(filterAcademicYear, filterGrade, val, selectedSubject);
          }}
          labelKey="className"
          valueKey="id"
          placeholder={t("ทุกห้อง")}
        />
      </MonitorFilterBar>

      {/* Loading */}
      {loading && selectedSubject && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
            <p className="text-gray-500">{t('กำลังโหลดข้อมูล...')}</p>
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary strip */}
          <div className="bg-white rounded-lg shadow px-3 sm:px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <span className="text-sm text-gray-600 whitespace-nowrap">{tx('ส่งครบ <b>{done}/{all}</b> คน', { done: counts.complete, all: counts.all, b: (c) => <b className="text-gray-900">{c}</b> })}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div className={`h-2 rounded-full ${getProgressColor(workPct)}`} style={{ width: `${workPct}%` }} />
              </div>
            </div>
            <span className="text-sm text-gray-600 whitespace-nowrap">{tx('ค้าง <b>{n}</b> คน', { n: counts.missing, b: (c) => <b className="text-red-600">{c}</b> })}</span>
            <span className="text-sm text-gray-600 whitespace-nowrap">{tx('งานส่งแล้ว <b>{pct}%</b>', { pct: workPct, b: (c) => <b className="text-gray-900">{c}</b> })} <span className="text-gray-500">{workSent}/{workTotal}</span></span>
            <span className="hidden md:inline text-sm text-gray-500 whitespace-nowrap">{t('นักเรียน {value1} คน', { value1: data.summary.totalStudents })}</span>
            <span className="hidden md:inline text-sm text-gray-500 whitespace-nowrap">{t('งาน {value1} ชิ้น', { value1: activeTasks.length })}</span>
          </div>

          {activeTask && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{t('เฉพาะงาน')}</span>
              <button
                onClick={clearTaskFilter}
                aria-label={t('เลิกกรอง {value1}', { value1: activeTask.taskName })}
                className="min-h-[44px] inline-flex items-center gap-2 pl-3 pr-2 rounded-full bg-brand-50 text-brand-700 font-medium hover:bg-brand-100"
              >
                {activeTask.taskName}
                <span aria-hidden="true" className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-brand-200">×</span>
              </button>
            </div>
          )}

          {/* Quick filter + search + actions */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:flex-wrap">
            <div className="flex items-center gap-2">
            <div className="grid grid-cols-2 gap-1 bg-gray-200 rounded-lg p-1">
              {[
                { key: 'missing', label: t('ยังไม่ส่ง') },
                { key: 'all', label: t('ทั้งหมด') }
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setQuickFilter(opt.key)}
                  aria-pressed={quickFilter === opt.key}
                  className={`min-h-[44px] px-3 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                    quickFilter === opt.key ? 'bg-white text-brand-700 shadow' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {opt.label} <span className="text-xs opacity-70">{counts[opt.key]}</span>
                </button>
              ))}
            </div>
            {counts.pendingTasks > 0 && (
              <button
                onClick={() => setQuickFilter(quickFilter === 'pending' ? 'all' : 'pending')}
                aria-pressed={quickFilter === 'pending'}
                className={`min-h-[44px] px-3 rounded-full text-xs font-medium whitespace-nowrap border ${
                  quickFilter === 'pending' ? 'bg-amber-500 text-white border-amber-500' : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >{t('รอตรวจ {value1} งาน', { value1: counts.pendingTasks })}</button>
            )}
            </div>
            <div className="flex flex-wrap items-center gap-2 md:ml-auto">
              <div className="relative flex-1 md:flex-none">
                <input
                  type="text"
                  placeholder={t("ค้นหา ชื่อ/เลขที่/รหัส...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm w-full md:w-56 min-h-[44px]"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                title={t("ดาวน์โหลดเป็นไฟล์ Excel")}
                aria-label={t("ดาวน์โหลดเป็นไฟล์ Excel")}
                className="shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-brand-100 text-brand-700 hover:bg-brand-200 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden lg:inline">{exporting ? t('กำลังสร้างไฟล์...') : t('ดาวน์โหลด Excel')}</span>
              </button>
              <ReminderButton title={reminder.title} deadline={reminder.deadline} items={reminder.items} />
              <button
                onClick={() => setQuickGradeMode(!quickGradeMode)}
                title={t("ให้คะแนนเร็ว: แตะช่องงานเพื่อเปลี่ยนสถานะ")}
                className={`shrink-0 min-h-[44px] px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
                  quickGradeMode ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>{quickGradeMode ? t('เสร็จ') : t('ตรวจเร็ว')}</span>
              </button>
            </div>
          </div>

          {quickGradeMode && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{t('แตะช่องงานเพื่อเปลี่ยนสถานะ (✓ ผ่าน / ✗ ไม่ผ่าน / - ยังไม่ส่ง)')}</p>
          )}

          {/* Phone: simple list (hidden while quick-grading, which needs the table) */}
          {!quickGradeMode && (
            <ul className="md:hidden bg-white rounded-lg shadow divide-y">
              {sortedByNumber.map((student, i) => (
                <React.Fragment key={student.id}>
                {isGroupStart(i) && (
                  <li className="px-3 py-1.5 bg-gray-50 text-xs font-semibold text-gray-600">
                    {student.className || t('ไม่ระบุห้อง')} <span className="font-normal text-gray-400">{t('· {value1} คน', { value1: groupSize(student.className) })}</span>
                  </li>
                )}
                <li>
                  <button
                    onClick={() => handleStudentClick(student.id)}
                    className="w-full min-h-[52px] px-3 py-2 flex items-center gap-3 text-left active:bg-brand-50"
                  >
                    <span className="w-7 shrink-0 text-right text-sm text-gray-400">{student.studentNumber || '-'}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-gray-900">{student.name}</span>

                    </span>
                    {student.missing > 0 ? (
                      <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-red-100 text-red-700">{t('ค้าง {value1}', { value1: student.missing })}</span>
                  ) : student.pending > 0 ? (
                    <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-800">{t('รอตรวจ {value1}', { value1: student.pending })}</span>
                    ) : (
                      <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">{t('ครบ')}</span>
                    )}
                    <svg className="w-4 h-4 shrink-0 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
                </React.Fragment>
              ))}
              {sortedByNumber.length === 0 && (
                <li className="text-center py-10 text-gray-500">
                  {data.students.length === 0 ? t('ไม่พบนักเรียนในวิชานี้') : t('ไม่มีนักเรียนตามที่เลือก')}
                </li>
              )}
            </ul>
          )}

          {/* md+ (or quick-grade on phone): matrix table */}
          <div className={`${quickGradeMode ? 'block' : 'hidden md:block'} bg-white rounded-lg shadow overflow-hidden`}>
            <div className="relative z-0 isolate overflow-auto max-h-[70vh] print:max-h-none print:overflow-visible">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-th print:bg-transparent sticky top-0 z-20">
                  <tr>
                    <th className="hidden sm:table-cell px-2 py-3 text-center text-xs font-semibold text-th-fg print:text-black border border-brand-100 w-12 bg-th print:bg-transparent">{t('เลขที่')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-th-fg print:text-black sticky left-0 bg-th print:bg-transparent z-30 min-w-[140px] sm:min-w-[200px] border border-brand-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{t('นักเรียน')}</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-th-fg print:text-black border border-brand-100 bg-th print:bg-transparent">{t('ห้อง')}</th>
                    <th className="px-2 sm:px-4 py-3 text-center text-xs font-semibold text-th-fg print:text-black border border-brand-100 bg-th print:bg-transparent">{t('ความคืบหน้า')}</th>
                    {activeTasks.map(task => (
                      <th
                        key={task.id}
                        className="px-2 sm:px-3 py-3 text-center text-xs font-semibold text-th-fg print:text-black min-w-[72px] sm:min-w-[80px] border border-brand-100 bg-th print:bg-transparent"
                        title={task.taskName}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span>{t('งาน {value1}', { value1: task.taskNumber })}</span>
                          {quickGradeMode && (
                            <button
                              onClick={() => handleBatchMarkAll(task.id, task)}
                              disabled={savingCell?.taskId === task.id}
                              className="text-[10px] px-2 py-1.5 sm:py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                              title={t('ให้ทุกคนผ่าน {value1}', { value1: task.taskName })}
                            >
                              {savingCell?.taskId === task.id && savingCell?.batch ? '...' : t('ผ่านทั้งหมด')}
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sortedByNumber.map((student, i) => (
                    <React.Fragment key={student.id}>
                    {isGroupStart(i) && (
                      <tr className="bg-gray-50">
                        <td colSpan={4 + activeTasks.length} className="px-4 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300">
                          {student.className || t('ไม่ระบุห้อง')} <span className="font-normal text-gray-400">{t('· {value1} คน', { value1: groupSize(student.className) })}</span>
                        </td>
                      </tr>
                    )}
                    <tr
                      onClick={() => handleStudentClick(student.id)}
                      className="hover:bg-brand-50 cursor-pointer transition-colors"
                    >
                      <td className="hidden sm:table-cell px-2 py-3 text-center text-sm font-medium text-gray-900 border border-gray-300">
                        {student.studentNumber || '-'}
                      </td>
                      <td className="px-2 sm:px-4 py-3 sticky left-0 bg-white z-10 border border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <p className="font-medium text-gray-900"><span className="sm:hidden text-gray-400 mr-1">{student.studentNumber || '-'}.</span>{student.name}</p>
                        <p className="text-xs text-gray-500">{student.studentCode}</p>
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-center text-sm text-gray-700 border border-gray-300 whitespace-nowrap">
                        {student.className}
                      </td>
                      <td className="px-2 sm:px-4 py-3 text-center border border-gray-300">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getProgressColor(student.progress.percentage)}`}
                              style={{ width: `${student.progress.percentage}%` }}
                            />
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getProgressBgColor(student.progress.percentage)}`}>
                            {student.progress.percentage}%
                          </span>
                        </div>
                      </td>
                      {activeTasks.map(task => {
                        const submission = student.submissions.find(s => s.taskId === task.id);
                        const status = submission?.status || 'NOT_SUBMITTED';
                        const isSaving = savingCell?.studentId === student.id && savingCell?.taskId === task.id;
                        // ห้องนี้ไม่ได้งานนี้: แสดงขีด กดไม่ได้ ไม่นับว่าค้าง
                        if (status === 'NOT_ASSIGNED') {
                          return (
                            <td key={task.id} className="px-2 sm:px-3 py-3 text-center border border-gray-300 bg-gray-50 text-gray-300" title={t('{value1} - ห้องนี้ไม่ได้รับงานนี้', { value1: task.taskName })}>
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={task.id} className="px-2 sm:px-3 py-3 text-center border border-gray-300">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={(e) => handleQuickGrade(e, student.id, task.id, status, task)}
                                disabled={!quickGradeMode || isSaving}
                                className={`w-11 h-11 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${getStatusColor(status)} ${
                                  quickGradeMode ? 'cursor-pointer hover:scale-110 hover:shadow-md' : 'cursor-default'
                                } ${isSaving ? 'animate-pulse' : ''}`}
                                title={t('{name} - {status}{hint}', { name: task.taskName, status: status === 'APPROVED' ? t('ผ่าน') : status === 'PENDING' ? t('รอตรวจ') : status === 'REJECTED' ? t('ไม่ผ่าน') : t('ยังไม่ส่ง'), hint: quickGradeMode ? t(' (แตะเพื่อเปลี่ยน)') : '' })}
                              >
                                {isSaving ? '...' : getStatusIcon(status)}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleStudents.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {data.students.length === 0 ? t('ไม่พบนักเรียนในวิชานี้') : t('ไม่มีนักเรียนตามที่เลือก')}
              </div>
            )}
          </div>
        </>
      )}

      {/* No subject selected */}
      {!loading && !selectedSubject && (
        <div className="bg-white rounded-lg shadow p-10 text-center">
          <p className="text-gray-500 text-lg">{t('เลือกวิชาด้านบนเพื่อดูผล')}</p>
        </div>
      )}
    </div>
  );
};

export default SubjectMonitor;
