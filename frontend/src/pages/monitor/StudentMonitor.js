import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { monitorAPI } from '../../services/api';
import { SmartComboBox } from '../../components/ui';

const StudentMonitor = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlightSubjectId = searchParams.get('subjectId');

  // Get "from" params for back navigation
  const fromAy = searchParams.get('fromAy');
  const fromClass = searchParams.get('fromClass');
  const fromSubject = searchParams.get('fromSubject');

  const handleBack = () => {
    // If we have "from" params, navigate back to ClassMonitor with those filters
    if (fromClass || fromAy) {
      const params = new URLSearchParams();
      if (fromAy) params.set('ay', fromAy);
      if (fromClass) params.set('class', fromClass);
      if (fromSubject) params.set('subject', fromSubject);
      navigate(`/monitor/class?${params.toString()}`);
    } else {
      navigate(-1);
    }
  };

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterSubjectId, setFilterSubjectId] = useState(null);

  // Date filter state - default to 'month' (เดือนนี้)
  const [dateFilter, setDateFilter] = useState('month'); // 'all', 'today', 'week', 'month', 'custom'
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await monitorAPI.getStudentMonitor(id);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusLabel = (status) => {
    const labels = {
      NOT_SUBMITTED: 'ยังไม่ส่ง',
      PENDING: 'รอตรวจ',
      APPROVED: 'อนุมัติ',
      REJECTED: 'ปฏิเสธ'
    };
    return labels[status] || 'ยังไม่ส่ง';
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get date range based on filter
  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilter) {
      case 'today':
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        return { start: today, end: endOfDay };
      case 'week': {
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
      }
      case 'month': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);
        return { start: startOfMonth, end: endOfMonth };
      }
      case 'custom':
        if (customDateStart && customDateEnd) {
          const start = new Date(customDateStart);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customDateEnd);
          end.setHours(23, 59, 59, 999);
          return { start, end };
        }
        return null;
      default:
        return null; // 'all' - no filter
    }
  };

  // Check if task deadline is within date range
  const isTaskInDateRange = (task) => {
    if (dateFilter === 'all') return true;
    if (!task.deadline) return false;

    const dateRange = getDateRange();
    if (!dateRange) return true;

    const taskDate = new Date(task.deadline);
    return taskDate >= dateRange.start && taskDate <= dateRange.end;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">!</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            ย้อนกลับ
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { student, overallProgress, subjects } = data;

  // Filter subjects if filter is selected
  const filteredSubjects = filterSubjectId
    ? subjects.filter(s => s.id === filterSubjectId)
    : subjects;

  // Get max task count for table columns
  const maxTaskCount = Math.max(...subjects.map(s => s.tasks?.length || 0), 5);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>ย้อนกลับ</span>
      </button>

      {/* Header - Student Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{student.name}</h1>
              <p className="text-gray-500">
                รหัส: {student.studentCode} | ห้อง: {student.class?.className}
              </p>
              <p className="text-sm text-gray-400">
                {student.class?.grade?.gradeName} | ปี {student.class?.academicYear?.year}
              </p>
            </div>
          </div>

          {/* Overall Progress */}
          <div className="bg-gray-50 rounded-lg p-4 min-w-[200px]">
            <p className="text-sm text-gray-500 mb-2">ความคืบหน้ารวม</p>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-blue-600">{overallProgress.percentage}%</span>
              <span className="text-sm text-gray-500 mb-1">
                ({overallProgress.totalSubmitted}/{overallProgress.totalTasks} งาน)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(overallProgress.percentage)}`}
                style={{ width: `${overallProgress.percentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              อนุมัติแล้ว {overallProgress.totalApproved} งาน ({overallProgress.approvedPercentage}%)
            </p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col gap-4">
          {/* Subject Filter Row */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap">
            <div className="sm:w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">กรองวิชา</label>
              <SmartComboBox
                options={subjects.map(s => ({ id: s.id, name: `${s.subjectCode} - ${s.subjectName}` }))}
                value={filterSubjectId}
                onChange={setFilterSubjectId}
                labelKey="name"
                valueKey="id"
                placeholder="แสดงทุกวิชา"
                searchable
                clearable
              />
            </div>
            <div className="text-sm text-gray-500">
              แสดง {filteredSubjects.length} จาก {subjects.length} วิชา
            </div>
          </div>

          {/* Date Filter Row */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 flex-wrap border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">กรองตามกำหนดส่ง</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    dateFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  onClick={() => setDateFilter('today')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    dateFilter === 'today'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  วันนี้
                </button>
                <button
                  onClick={() => setDateFilter('week')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    dateFilter === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  สัปดาห์นี้
                </button>
                <button
                  onClick={() => setDateFilter('month')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    dateFilter === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  เดือนนี้
                </button>
                <button
                  onClick={() => setDateFilter('custom')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    dateFilter === 'custom'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  กำหนดเอง
                </button>
              </div>
            </div>

            {/* Custom Date Range */}
            {dateFilter === 'custom' && (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">จาก</label>
                  <input
                    type="date"
                    value={customDateStart}
                    onChange={(e) => setCustomDateStart(e.target.value)}
                    className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ถึง</label>
                  <input
                    type="date"
                    value={customDateEnd}
                    onChange={(e) => setCustomDateEnd(e.target.value)}
                    className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subject Task Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">ตารางการส่งงาน</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-20 min-w-[200px] border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                  วิชา
                </th>
                {/* Generate task number headers based on max tasks */}
                {Array.from({ length: maxTaskCount }, (_, i) => (
                  <th key={i} className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[80px] border-r border-gray-100">
                    งาน {i + 1}
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[100px]">
                  ความคืบหน้า
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSubjects.map((subject) => (
                <tr
                  key={subject.id}
                  className={`hover:bg-gray-50 ${
                    highlightSubjectId && subject.id === parseInt(highlightSubjectId)
                      ? 'bg-blue-50'
                      : ''
                  }`}
                >
                  {/* Subject Name */}
                  <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <div>
                      <p className="font-medium text-gray-900">{subject.subjectName}</p>
                      <p className="text-xs text-gray-500">{subject.subjectCode}</p>
                    </div>
                  </td>

                  {/* Task Status Cells */}
                  {Array.from({ length: maxTaskCount }, (_, i) => {
                    const task = subject.tasks?.find(t => t.taskNumber === i + 1);
                    const status = task?.submission?.status || 'NOT_SUBMITTED';
                    const isInRange = task ? isTaskInDateRange(task) : false;

                    return (
                      <td key={i} className="px-3 py-3 border-r border-gray-100">
                        <div className="flex items-center justify-center">
                        {task ? (
                          isInRange ? (
                            <span
                              className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-medium ${
                                status === 'APPROVED'
                                  ? 'bg-green-100 text-green-700'
                                  : status === 'PENDING'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : status === 'REJECTED'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-400'
                              }`}
                              title={`${task.taskName} - ${getStatusLabel(status)}${task.deadline ? ` (กำหนด: ${new Date(task.deadline).toLocaleDateString('th-TH')})` : ''}`}
                            >
                              {status === 'APPROVED' ? '✓' : status === 'PENDING' ? '○' : status === 'REJECTED' ? '✗' : '-'}
                            </span>
                          ) : (
                            <span className="w-10 h-10 rounded-lg flex items-center justify-center text-xs text-gray-300 bg-gray-50" title="ไม่อยู่ในช่วงวันที่เลือก">
                              -
                            </span>
                          )
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Progress */}
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getProgressColor(subject.progress.percentage)}`}
                          style={{ width: `${subject.progress.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700">
                        {subject.progress.percentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {subjects.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            ไม่พบวิชาสำหรับชั้นนี้
          </div>
        )}
      </div>

      {/* Status Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">สัญลักษณ์สถานะ:</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center font-medium">✓</span>
            <span className="text-gray-600">อนุมัติแล้ว</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-700 flex items-center justify-center font-medium">○</span>
            <span className="text-gray-600">รอตรวจ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-medium">✗</span>
            <span className="text-gray-600">ปฏิเสธ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gray-100 text-gray-400 flex items-center justify-center font-medium">-</span>
            <span className="text-gray-600">ยังไม่ส่ง</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentMonitor;
