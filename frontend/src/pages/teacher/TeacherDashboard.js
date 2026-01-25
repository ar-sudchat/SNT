import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportAPI } from '../../services/api';

// Simple Progress Ring Component
const ProgressRing = ({ progress, size = 120, strokeWidth = 10, color = '#3B82F6' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{progress}%</span>
      </div>
    </div>
  );
};

// Horizontal Bar Component
const HorizontalBar = ({ value, max, color, label, count }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium" style={{ color }}>{count} ({percentage.toFixed(0)}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="h-3 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const TeacherDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [statistics, setStatistics] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [overviewRes, statsRes, subjectsRes] = await Promise.all([
        reportAPI.teacherOverview(),
        reportAPI.teacherStatistics(),
        reportAPI.teacherSubjects()
      ]);
      setOverview(overviewRes.data);
      setStatistics(statsRes.data);
      setSubjects(subjectsRes.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Calculate totals for submission breakdown
  const totalSubmissions = overview?.submissions
    ? (overview.submissions.approved || 0) +
      (overview.submissions.rejected || 0) +
      (overview.submissions.pending || 0) +
      (overview.submissions.notSubmitted || 0)
    : 0;

  const quickLinks = [
    { path: '/teacher/scan', label: 'สแกน QR', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', color: 'text-blue-600' },
    { path: '/admin/tasks', label: 'งาน', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', color: 'text-orange-600' },
    { path: '/admin/qrcode', label: 'สร้าง QR', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z', color: 'text-pink-600' },
    { path: '/monitor/class', label: 'Monitor ห้อง', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', color: 'text-indigo-600' },
    { path: '/monitor/subject', label: 'Monitor วิชา', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'text-purple-600' },
    { path: '/admin/students', label: 'นักเรียน', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', color: 'text-green-600' }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard ครู</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overview Summary Card */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">ภาพรวมวิชาของฉัน</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{overview?.counts?.students || 0}</div>
              <div className="text-sm text-gray-500">นักเรียน</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{overview?.counts?.subjects || 0}</div>
              <div className="text-sm text-gray-500">วิชา</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">{overview?.counts?.tasks || 0}</div>
              <div className="text-sm text-gray-500">งาน</div>
            </div>
          </div>
        </div>

        {/* Approval Rate Ring */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">อัตราผ่านงาน</h2>
          <div className="flex items-center justify-center">
            <ProgressRing
              progress={parseFloat(overview?.submissionRate) || 0}
              size={140}
              strokeWidth={12}
              color={
                (parseFloat(overview?.submissionRate) || 0) >= 80 ? '#10B981' :
                (parseFloat(overview?.submissionRate) || 0) >= 50 ? '#F59E0B' : '#EF4444'
              }
            />
          </div>
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              จากงานที่ส่งทั้งหมด {(overview?.submissions?.approved || 0) + (overview?.submissions?.rejected || 0) + (overview?.submissions?.pending || 0)} ชิ้น
            </p>
          </div>
        </div>

        {/* Submission Breakdown */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">สถานะการส่งงาน</h2>
          <HorizontalBar
            value={overview?.submissions?.approved || 0}
            max={totalSubmissions}
            color="#10B981"
            label="ผ่าน"
            count={overview?.submissions?.approved || 0}
          />
          <HorizontalBar
            value={overview?.submissions?.pending || 0}
            max={totalSubmissions}
            color="#F59E0B"
            label="รอตรวจ"
            count={overview?.submissions?.pending || 0}
          />
          <HorizontalBar
            value={overview?.submissions?.rejected || 0}
            max={totalSubmissions}
            color="#EF4444"
            label="ไม่ผ่าน"
            count={overview?.submissions?.rejected || 0}
          />
          <HorizontalBar
            value={overview?.submissions?.notSubmitted || 0}
            max={totalSubmissions}
            color="#9CA3AF"
            label="ยังไม่ส่ง"
            count={overview?.submissions?.notSubmitted || 0}
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg hover:scale-105 transition-all flex flex-col items-center text-center"
          >
            <svg className={`w-8 h-8 ${link.color} mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
            </svg>
            <span className="text-xs text-gray-700">{link.label}</span>
          </Link>
        ))}
      </div>

      {/* My Subjects */}
      {subjects.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">วิชาของฉัน</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((subject) => (
                <Link
                  key={subject.id}
                  to={`/teacher/subject/${subject.id}`}
                  className="block p-4 border-2 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-800 truncate">{subject.subjectName}</h3>
                  <p className="text-xs text-gray-500 mb-2">{subject.subjectCode}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-blue-600 font-medium">{subject.tasks?.length || 0} งาน</span>
                    <span className="text-green-600 font-medium">{subject._count?.qrcodes || 0} นร.</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Task Statistics - Visual Cards */}
      {statistics.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">งานที่ต้องติดตาม</h2>
            <p className="text-sm text-gray-500">งานที่มีอัตราผ่านต่ำกว่า 80%</p>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statistics
                .filter(stat => parseFloat(stat.approvalRate) < 80)
                .slice(0, 6)
                .map((stat) => {
                  const rate = parseFloat(stat.approvalRate);
                  const rateColor = rate >= 60 ? '#F59E0B' : '#EF4444';
                  const bgColor = rate >= 60 ? 'bg-yellow-50' : 'bg-red-50';

                  return (
                    <Link
                      key={stat.taskId}
                      to={`/teacher/subject/${stat.subjectId}`}
                      className={`${bgColor} rounded-lg p-4 hover:shadow-md transition-shadow`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 truncate flex-1">
                          {stat.subjectName}
                        </span>
                        <span
                          className="text-lg font-bold ml-2"
                          style={{ color: rateColor }}
                        >
                          {stat.approvalRate}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        งาน {stat.taskNumber}: {stat.taskName}
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-600">ผ่าน {stat.approved}</span>
                        <span className="text-red-600">ไม่ผ่าน {stat.rejected}</span>
                        <span className="text-gray-400">ยังไม่ส่ง {stat.notSubmitted}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{ width: `${rate}%`, backgroundColor: rateColor }}
                        />
                      </div>
                    </Link>
                  );
                })}
            </div>

            {statistics.filter(stat => parseFloat(stat.approvalRate) < 80).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ทุกงานมีอัตราผ่านมากกว่า 80%
              </div>
            )}

            {statistics.filter(stat => parseFloat(stat.approvalRate) < 80).length > 6 && (
              <div className="text-center mt-4">
                <Link
                  to="/monitor/subject"
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  ดูเพิ่มเติม ({statistics.filter(stat => parseFloat(stat.approvalRate) < 80).length - 6} รายการ) &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Tasks Summary Table */}
      {statistics.length > 0 && (
        <details className="bg-white rounded-xl shadow-lg overflow-hidden">
          <summary className="px-6 py-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 inline">สถิติการส่งงานทั้งหมด</h2>
              <span className="text-sm text-gray-500 ml-2">({statistics.length} รายการ)</span>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="overflow-x-auto border-t">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วิชา</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">งาน</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">ผ่าน</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">ไม่ผ่าน</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">ยังไม่ส่ง</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">อัตราผ่าน</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statistics.map((stat) => (
                  <tr key={stat.taskId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">{stat.subjectName}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">งาน {stat.taskNumber}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-green-600 font-medium">{stat.approved}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-red-600 font-medium">{stat.rejected}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center text-gray-400">{stat.notSubmitted}</td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${stat.approvalRate}%`,
                              backgroundColor: parseFloat(stat.approvalRate) >= 80 ? '#10B981' :
                                parseFloat(stat.approvalRate) >= 50 ? '#F59E0B' : '#EF4444'
                            }}
                          />
                        </div>
                        <span className={`font-medium ${
                          parseFloat(stat.approvalRate) >= 80 ? 'text-green-600' :
                          parseFloat(stat.approvalRate) >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {stat.approvalRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {subjects.length === 0 && !error && (
        <div className="text-center py-8 bg-white rounded-lg shadow">
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">ไม่มีวิชา</h3>
          <p className="mt-1 text-xs text-gray-500">ยังไม่มีวิชาที่คุณรับผิดชอบ</p>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
