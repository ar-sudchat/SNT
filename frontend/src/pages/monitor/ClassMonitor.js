import { t, tx } from '../../i18n';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { monitorAPI, classAPI, academicYearAPI, gradeAPI } from '../../services/api';
import { MonitorFilterBar, MonitorFilterField } from './MonitorFilterBar';
import { ReminderButton } from './reminderText';

const LAST_CLASS_KEY = 'monitor.lastClassId';
const readSaved = (key) => {
  try { const v = parseInt(localStorage.getItem(key)); return Number.isNaN(v) ? null : v; } catch { return null; }
};
const writeSaved = (key, val) => {
  try { if (val) localStorage.setItem(key, String(val)); } catch { /* ignore */ }
};

const ClassMonitor = ({ embedded = false }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial values from URL
  const urlAcademicYear = searchParams.get('ay');
  const urlClass = searchParams.get('class');
  const urlSubject = searchParams.get('subject');
  const urlSearch = searchParams.get('search') || '';
  const urlPage = searchParams.get('page');

  const urlGrade = searchParams.get('grade');

  const [data, setData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [grades, setGrades] = useState([]);
  const [selectedClass, setSelectedClass] = useState(id ? parseInt(id) : (urlClass ? parseInt(urlClass) : null));
  const [selectedSubject, setSelectedSubject] = useState(urlSubject ? parseInt(urlSubject) : null);
  const [filterAcademicYear, setFilterAcademicYear] = useState(urlAcademicYear ? parseInt(urlAcademicYear) : null);
  const [filterGrade, setFilterGrade] = useState(urlGrade ? parseInt(urlGrade) : null);
  const [searchTerm, setSearchTerm] = useState(urlSearch);
  const [currentPage] = useState(urlPage ? parseInt(urlPage) : 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all'); // all | missing | pending

  // Update URL when filters change
  const updateURL = useCallback((ay, grade, cls, subj, search, page) => {
    const params = new URLSearchParams();
    if (ay) params.set('ay', ay);
    if (grade) params.set('grade', grade);
    if (cls) params.set('class', cls);
    if (subj) params.set('subject', subj);
    if (search) params.set('search', search);
    if (page && page > 1) params.set('page', page);
    const keepMode = new URLSearchParams(window.location.search).get('mode');
    if (keepMode) params.set('mode', keepMode);
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

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
    if (classes.length > 0) {
      setSelectedClass(prev => {
        if (prev) return prev;
        const saved = readSaved(LAST_CLASS_KEY);
        return classes.some(c => c.id === saved) ? saved : classes[0].id;
      });
    }
  }, [classes]);

  // จำห้องที่เลือกล่าสุดไว้ใช้ครั้งหน้า
  useEffect(() => { writeSaved(LAST_CLASS_KEY, selectedClass); }, [selectedClass]);

  // Fetch class monitor data
  const fetchData = useCallback(async () => {
    if (!selectedClass || !initialLoadDone) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = {};
      if (selectedSubject) params.subjectId = selectedSubject;

      const response = await monitorAPI.getClassMonitor(selectedClass, params);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || t('ไม่สามารถโหลดข้อมูลได้'));
    } finally {
      setLoading(false);
    }
  }, [selectedClass, selectedSubject, initialLoadDone]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStudentClick = (studentId) => {
    // Pass current filters to student page so back button preserves state
    const params = new URLSearchParams();
    if (filterAcademicYear) params.set('fromAy', filterAcademicYear);
    if (selectedClass) params.set('fromClass', selectedClass);
    if (selectedSubject) params.set('fromSubject', selectedSubject);
    if (searchTerm) params.set('fromSearch', searchTerm);
    if (currentPage > 1) params.set('fromPage', currentPage);
    navigate(`/monitor/student/${studentId}?${params.toString()}`);
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

  // นับงานที่ยังไม่ส่ง / รอตรวจ ของนักเรียนแต่ละคน
  const studentsWithCounts = useMemo(() => (data?.students || []).map(s => ({
    ...s,
    missing: Math.max(0, (s.overallProgress?.totalTasks || 0) - (s.overallProgress?.totalSubmitted || 0)),
    pending: (s.subjects || []).reduce((sum, x) => sum + (x.pending || 0), 0)
  })), [data]);

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
    if (loading || !data || autoFilterFor.current === selectedClass) return;
    autoFilterFor.current = selectedClass;
    setQuickFilter(counts.missing > 0 ? 'missing' : 'all');
  }, [loading, data, selectedClass, counts.missing]);

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

  const sortedByNumber = useMemo(() => [...visibleStudents].sort(
    (a, b) => (parseInt(a.studentNumber) || 9999) - (parseInt(b.studentNumber) || 9999)
  ), [visibleStudents]);

  // ข้อความทวงงาน — ทุกคนที่ค้างในห้อง (ถ้าเลือกวิชาจะนับเฉพาะวิชานั้น)
  const reminder = useMemo(() => {
    const subj = data?.summary?.subjects?.find(x => x.id === selectedSubject);
    const title = `${data?.class?.className || ''} — ${subj ? subj.subjectName : 'งานที่ยังไม่ส่ง'}`;
    const items = studentsWithCounts.filter(s => s.missing > 0).sort(
      (a, b) => (parseInt(a.studentNumber) || 9999) - (parseInt(b.studentNumber) || 9999)
    ).map(s => {
      const per = (s.subjects || []).map(x => ({ n: x.subjectName, m: Math.max(0, x.totalTasks - x.submitted) })).filter(x => x.m > 0);
      return {
        name: s.name, number: s.studentNumber,
        detail: subj ? `ค้าง ${s.missing} งาน` : per.map(x => `${x.n} ${x.m}`).join(', ')
      };
    });
    return { title, items };
  }, [data, selectedSubject, studentsWithCounts]);


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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{t('ติดตามงานรายห้อง')}</h1>
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
            setSelectedClass(null);
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
            setSelectedClass(null);
            setSelectedSubject(null);
            setData(null);
            updateURL(filterAcademicYear, val, null, null);
          }}
          labelKey="gradeName"
          valueKey="id"
          placeholder={t("ทุกชั้น")}
        />
        <MonitorFilterField
          label={t("ห้องเรียน")}
          options={classes}
          value={selectedClass}
          onChange={(val) => {
            setSelectedClass(val);
            setSelectedSubject(null);
            updateURL(filterAcademicYear, filterGrade, val, null);
          }}
          labelKey="className"
          valueKey="id"
          placeholder={t("เลือกห้องเรียน")}
        />
        <MonitorFilterField
          label={t("วิชา")}
          options={data?.summary?.subjects || []}
          value={selectedSubject}
          onChange={(val) => {
            setSelectedSubject(val);
            updateURL(filterAcademicYear, filterGrade, selectedClass, val);
          }}
          labelKey="subjectName"
          valueKey="id"
          placeholder={t("ทุกวิชา")}
        />
      </MonitorFilterBar>

      {/* Loading */}
      {loading && selectedClass && (
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
                <div className={`h-2 rounded-full ${getProgressColor(data.summary.avgProgress)}`} style={{ width: `${data.summary.avgProgress}%` }} />
              </div>
            </div>
            <span className="text-sm text-gray-600 whitespace-nowrap">{tx('ค้าง <b>{n}</b> คน', { n: counts.missing, b: (c) => <b className="text-red-600">{c}</b> })}</span>
            <span className="text-xs text-gray-400 whitespace-nowrap">{t('งานส่งแล้ว {value1}%', { value1: data.summary.avgProgress })}</span>
            <span className="hidden md:inline text-sm text-gray-500 whitespace-nowrap">{t('นักเรียน {value1} คน', { value1: data.class.totalStudents })}</span>
            <span className="hidden md:inline text-sm text-gray-500 whitespace-nowrap">{t('ตรวจผ่านแล้ว {value1}%', { value1: data.summary.avgApproved })}</span>
          </div>

          {/* Quick filter + search */}
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex items-center gap-2">
            <div className="grid grid-cols-2 gap-1 bg-gray-200 rounded-lg p-1 md:w-auto">
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
            <div className="flex items-center gap-2 md:ml-auto">
            <ReminderButton title={reminder.title} items={reminder.items} />
            <div className="relative flex-1 md:flex-none">
              <input
                type="text"
                placeholder={t("ค้นหา ชื่อ/เลขที่/รหัส...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm w-full md:w-60 min-h-[44px]"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            </div>
          </div>

          {/* Phone: simple list */}
          <ul className="md:hidden bg-white rounded-lg shadow divide-y">
            {sortedByNumber.map(student => (
              <li key={student.id}>
                <button
                  onClick={() => handleStudentClick(student.id)}
                  className="w-full min-h-[52px] px-3 py-2 flex items-center gap-3 text-left active:bg-brand-50"
                >
                  <span className="w-7 shrink-0 text-right text-sm text-gray-400">{student.studentNumber || '-'}</span>
                  <span className="flex-1 min-w-0 truncate text-gray-900">{student.name}</span>
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
            ))}
            {sortedByNumber.length === 0 && (
              <li className="text-center py-10 text-gray-500">
                {data.students.length === 0 ? t('ไม่พบนักเรียนในห้องนี้') : t('ไม่มีนักเรียนตามที่เลือก')}
              </li>
            )}
          </ul>

          {/* md+: matrix table */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="relative z-0 isolate overflow-auto max-h-[70vh] print:max-h-none print:overflow-visible">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-th print:bg-transparent sticky top-0 z-20">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-semibold text-th-fg print:text-black border border-brand-100 w-12 bg-th print:bg-transparent">{t('เลขที่')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-th-fg print:text-black border border-brand-100 bg-th print:bg-transparent">{t('รหัสนักเรียน')}</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-th-fg print:text-black border border-brand-100 sticky left-0 z-30 bg-th print:bg-transparent min-w-[140px]">{t('ชื่อ-นามสกุล')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-th-fg print:text-black border border-brand-100 bg-th print:bg-transparent">{t('ความคืบหน้า')}</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-th-fg print:text-black border border-brand-100 bg-th print:bg-transparent">{t('ตรวจผ่านแล้ว')}</th>
                    {data.summary.subjects.slice(0, 5).map(subject => (
                      <th
                        key={subject.id}
                        className="px-3 py-3 text-center text-xs font-semibold text-th-fg print:text-black border border-brand-100 bg-th print:bg-transparent"
                        title={subject.subjectName}
                      >
                        {subject.subjectCode}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {visibleStudents.map((student) => (
                    <tr
                      key={student.id}
                      onClick={() => handleStudentClick(student.id)}
                      className="hover:bg-brand-50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 py-3 text-center text-sm font-medium text-gray-900 border border-gray-300">
                        {student.studentNumber || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border border-gray-300">
                        {student.studentCode}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300 sticky left-0 z-10 bg-white">
                        {student.name}
                      </td>
                      <td className="px-4 py-3 text-center border border-gray-300">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getProgressColor(student.overallProgress.percentage)}`}
                              style={{ width: `${student.overallProgress.percentage}%` }}
                            />
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getProgressBgColor(student.overallProgress.percentage)}`}>
                            {student.overallProgress.percentage}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700 border border-gray-300 whitespace-nowrap">
                        {student.overallProgress.totalApproved}/{student.overallProgress.totalTasks}
                      </td>
                      {student.subjects.slice(0, 5).map(subj => (
                        <td key={subj.subjectId} className="px-3 py-3 text-center border border-gray-300">
                          <span className={`text-xs px-2 py-1 rounded-full ${getProgressBgColor(subj.percentage)}`}>
                            {subj.submitted}/{subj.totalTasks}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {visibleStudents.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                {data.students.length === 0 ? t('ไม่พบนักเรียนในห้องนี้') : t('ไม่มีนักเรียนตามที่เลือก')}
              </div>
            )}
          </div>
        </>
      )}

      {/* No class selected */}
      {!loading && !selectedClass && (
        <div className="bg-white rounded-lg shadow p-10 text-center">
          <p className="text-gray-500 text-lg">{t('เลือกห้องเรียนด้านบนเพื่อดูผล')}</p>
        </div>
      )}
    </div>
  );
};

export default ClassMonitor;
