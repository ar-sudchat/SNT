import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { monitorAPI, subjectAPI, academicYearAPI, gradeAPI, classAPI, submissionAPI } from '../../services/api';
import { SmartComboBox } from '../../components/ui';

const SubjectMonitor = () => {
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
  const [selectedCells, setSelectedCells] = useState([]); // For batch operations
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Search term for filtering students

  // Update URL when filters change
  const updateURL = useCallback((ay, grade, cls, subj) => {
    const params = new URLSearchParams();
    if (ay) params.set('ay', ay);
    if (grade) params.set('grade', grade);
    if (cls) params.set('class', cls);
    if (subj) params.set('subject', subj);
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
        setError('ไม่สามารถโหลดข้อมูลได้');
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
      setError(err.response?.data?.error || 'ไม่สามารถโหลดข้อมูลได้');
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
      setError('ไม่สามารถ Export ได้');
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
          const totalTasks = prev.tasks.length;
          const submitted = newSubmissions.filter(s => s.status !== 'NOT_SUBMITTED').length;
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
      setError('ไม่สามารถบันทึกได้');
    } finally {
      setSavingCell(null);
    }
  };

  // Batch Mark All for a specific task
  const handleBatchMarkAll = async (taskId, task) => {
    if (!data || !window.confirm(`ต้องการให้ทุกคนผ่านงาน "${task.taskName}" หรือไม่?`)) return;

    const studentsToUpdate = data.students.filter(student => {
      const sub = student.submissions.find(s => s.taskId === taskId);
      return !sub || sub.status === 'NOT_SUBMITTED';
    });

    if (studentsToUpdate.length === 0) {
      alert('ทุกคนส่งงานครบแล้ว');
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
      setError('ไม่สามารถบันทึกได้');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Monitor รายวิชา</h1>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
          <div className="sm:w-52">
            <label className="block text-sm font-medium text-gray-700 mb-1">ปีการศึกษา</label>
            <SmartComboBox
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
              placeholder="เลือกปีการศึกษา"
              searchable
            />
          </div>
          <div className="sm:w-52">
            <label className="block text-sm font-medium text-gray-700 mb-1">ชั้นเรียน</label>
            <SmartComboBox
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
              placeholder="ทุกชั้น"
              searchable
              clearable
            />
          </div>
          <div className="sm:w-52">
            <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน</label>
            <SmartComboBox
              options={classes}
              value={filterClass}
              onChange={(val) => {
                setFilterClass(val);
                updateURL(filterAcademicYear, filterGrade, val, selectedSubject);
              }}
              labelKey="className"
              valueKey="id"
              placeholder="ทุกห้อง"
              searchable
              clearable
            />
          </div>
          <div className="sm:w-72">
            <label className="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
            <SmartComboBox
              options={subjects}
              value={selectedSubject}
              onChange={(val) => {
                setSelectedSubject(val);
                updateURL(filterAcademicYear, filterGrade, filterClass, val);
              }}
              labelKey="subjectName"
              valueKey="id"
              placeholder="เลือกวิชา"
              searchable
              clearable
            />
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && selectedSubject && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      )}

      {/* Subject Summary */}
      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">วิชา</p>
              <p className="text-xl font-bold text-gray-800">{data.subject.subjectName}</p>
              <p className="text-xs text-gray-400">{data.subject.subjectCode}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">จำนวนนักเรียน</p>
              <p className="text-2xl font-bold text-blue-600">{data.summary.totalStudents}</p>
              <p className="text-xs text-gray-400">คน</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">จำนวนงาน</p>
              <p className="text-2xl font-bold text-purple-600">{data.summary.totalTasks}</p>
              <p className="text-xs text-gray-400">งาน</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">ความคืบหน้าเฉลี่ย</p>
              <p className="text-2xl font-bold text-green-600">{data.summary.avgProgress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${getProgressColor(data.summary.avgProgress)}`}
                  style={{ width: `${data.summary.avgProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">รายชื่อนักเรียน</h2>
                <p className="text-sm text-gray-500">
                  {quickGradeMode ? 'คลิกที่ช่องสถานะเพื่อเปลี่ยน' : 'คลิกที่แถวเพื่อดูรายละเอียด'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search Input */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ค้นหา ชื่อ/เลขที่/รหัส..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-full sm:w-56"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <button
                  onClick={handleExportExcel}
                  disabled={exporting}
                  className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {exporting ? 'กำลัง Export...' : 'Export Excel'}
                </button>
                <button
                  onClick={() => setQuickGradeMode(!quickGradeMode)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    quickGradeMode
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {quickGradeMode ? 'ปิดโหมดแก้ไข' : 'Quick Grade'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase border border-gray-300 w-12">
                      เลขที่
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[200px] border border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      นักเรียน
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border border-gray-300">
                      ห้อง
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border border-gray-300">
                      ความคืบหน้า
                    </th>
                    {/* Task columns */}
                    {data.tasks.map(task => (
                      <th
                        key={task.id}
                        className="px-3 py-3 text-center text-xs font-medium text-gray-500 min-w-[80px] border border-gray-300"
                        title={task.taskName}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="uppercase">งาน {task.taskNumber}</span>
                          {quickGradeMode && (
                            <button
                              onClick={() => handleBatchMarkAll(task.id, task)}
                              disabled={savingCell?.taskId === task.id}
                              className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors disabled:opacity-50"
                              title={`ให้ทุกคนผ่าน ${task.taskName}`}
                            >
                              {savingCell?.taskId === task.id && savingCell?.batch ? '...' : 'ผ่านทั้งหมด'}
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {data.students
                    .filter(student => {
                      // Filter by search term only (class filtering is done at API level)
                      if (!searchTerm) return true;
                      const term = searchTerm.toLowerCase();
                      return (
                        student.name?.toLowerCase().includes(term) ||
                        student.studentCode?.toLowerCase().includes(term) ||
                        String(student.studentNumber || '').includes(term)
                      );
                    })
                    .map((student) => (
                    <tr
                      key={student.id}
                      onClick={() => handleStudentClick(student.id)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-2 py-3 text-center text-sm font-medium text-gray-900 border border-gray-300">
                        {student.studentNumber || '-'}
                      </td>
                      <td className="px-4 py-3 sticky left-0 bg-white z-10 border border-gray-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <p className="font-medium text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.studentCode}</p>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-700 border border-gray-300">
                        {student.className}
                      </td>
                      <td className="px-4 py-3 text-center border border-gray-300">
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
                      {/* Task status */}
                      {data.tasks.map(task => {
                        const submission = student.submissions.find(s => s.taskId === task.id);
                        const status = submission?.status || 'NOT_SUBMITTED';
                        const isSaving = savingCell?.studentId === student.id && savingCell?.taskId === task.id;
                        return (
                          <td key={task.id} className="px-3 py-3 text-center border border-gray-300">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={(e) => handleQuickGrade(e, student.id, task.id, status, task)}
                                disabled={!quickGradeMode || isSaving}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${getStatusColor(status)} ${
                                  quickGradeMode ? 'cursor-pointer hover:scale-110 hover:shadow-md' : 'cursor-default'
                                } ${isSaving ? 'animate-pulse' : ''}`}
                                title={`${task.taskName} - ${status === 'APPROVED' ? 'อนุมัติ' : status === 'PENDING' ? 'รอตรวจ' : status === 'REJECTED' ? 'ไม่อนุมัติ' : 'ยังไม่ส่ง'}${quickGradeMode ? ' (คลิกเพื่อเปลี่ยน)' : ''}`}
                              >
                                {isSaving ? '...' : getStatusIcon(status)}
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.students.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                ไม่พบนักเรียนในวิชานี้
              </div>
            )}
          </div>
        </>
      )}

      {/* No subject selected */}
      {!loading && !selectedSubject && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-gray-500 text-lg mb-2">เลือกวิชาเพื่อดูข้อมูล</p>
          <p className="text-gray-400 text-sm">เลือกปีการศึกษาและวิชาจากด้านบน</p>
        </div>
      )}
    </div>
  );
};

export default SubjectMonitor;
