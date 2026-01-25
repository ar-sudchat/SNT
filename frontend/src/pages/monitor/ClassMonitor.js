import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { monitorAPI, classAPI, academicYearAPI, gradeAPI } from '../../services/api';
import { SmartComboBox } from '../../components/ui';

const ClassMonitor = () => {
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
  const [currentPage, setCurrentPage] = useState(urlPage ? parseInt(urlPage) : 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Update URL when filters change
  const updateURL = useCallback((ay, grade, cls, subj, search, page) => {
    const params = new URLSearchParams();
    if (ay) params.set('ay', ay);
    if (grade) params.set('grade', grade);
    if (cls) params.set('class', cls);
    if (subj) params.set('subject', subj);
    if (search) params.set('search', search);
    if (page && page > 1) params.set('page', page);
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
      setError(err.response?.data?.error || 'ไม่สามารถโหลดข้อมูลได้');
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
          <h1 className="text-2xl font-bold text-gray-800">Monitor ห้องเรียน</h1>
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
                setSelectedClass(null);
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
                setSelectedClass(null);
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
          <div className="sm:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน</label>
            <SmartComboBox
              options={classes}
              value={selectedClass}
              onChange={(val) => {
                setSelectedClass(val);
                setSelectedSubject(null);
                updateURL(filterAcademicYear, filterGrade, val, null);
              }}
              labelKey="className"
              valueKey="id"
              placeholder="เลือกห้องเรียน"
              searchable
              clearable
            />
          </div>
          {data?.summary?.subjects?.length > 0 && (
            <div className="sm:w-64">
              <label className="block text-sm font-medium text-gray-700 mb-1">กรองวิชา</label>
              <SmartComboBox
                options={data.summary.subjects}
                value={selectedSubject}
                onChange={(val) => {
                  setSelectedSubject(val);
                  updateURL(filterAcademicYear, filterGrade, selectedClass, val);
                }}
                labelKey="subjectName"
                valueKey="id"
                placeholder="ทุกวิชา"
                searchable
                clearable
              />
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && selectedClass && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      )}

      {/* Class Summary */}
      {!loading && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">ห้องเรียน</p>
              <p className="text-2xl font-bold text-gray-800">{data.class.className}</p>
              <p className="text-xs text-gray-400">{data.class.grade?.gradeName}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">จำนวนนักเรียน</p>
              <p className="text-2xl font-bold text-blue-600">{data.class.totalStudents}</p>
              <p className="text-xs text-gray-400">คน</p>
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
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500">อนุมัติเฉลี่ย</p>
              <p className="text-2xl font-bold text-purple-600">{data.summary.avgApproved}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="h-2 rounded-full bg-purple-500"
                  style={{ width: `${data.summary.avgApproved}%` }}
                />
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">รายชื่อนักเรียน</h2>
                <p className="text-sm text-gray-500">คลิกที่แถวเพื่อดูรายละเอียด</p>
              </div>
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
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase border border-gray-300 w-12">
                      เลขที่
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border border-gray-300">
                      รหัสนักเรียน
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase border border-gray-300">
                      ชื่อ-นามสกุล
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border border-gray-300">
                      ความคืบหน้า
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase border border-gray-300">
                      อนุมัติแล้ว
                    </th>
                    {/* Subject columns */}
                    {data.summary.subjects.slice(0, 5).map(subject => (
                      <th
                        key={subject.id}
                        className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase border border-gray-300"
                        title={subject.subjectName}
                      >
                        {subject.subjectCode}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {data.students
                    .filter(student => {
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
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border border-gray-300">
                        {student.studentCode}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 border border-gray-300">
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
                      <td className="px-4 py-3 text-center text-sm text-gray-700 border border-gray-300">
                        {student.overallProgress.totalApproved}/{student.overallProgress.totalTasks}
                      </td>
                      {/* Subject progress */}
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

            {data.students.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                ไม่พบนักเรียนในห้องนี้
              </div>
            )}
          </div>
        </>
      )}

      {/* No class selected */}
      {!loading && !selectedClass && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-gray-500 text-lg mb-2">เลือกห้องเรียนเพื่อดูข้อมูล</p>
          <p className="text-gray-400 text-sm">เลือกปีการศึกษาและห้องเรียนจากด้านบน</p>
        </div>
      )}
    </div>
  );
};

export default ClassMonitor;
