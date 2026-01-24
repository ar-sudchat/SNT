import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportAPI } from '../../services/api';

const AdminDashboard = () => {
  const [overview, setOverview] = useState(null);
  const [statistics, setStatistics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [overviewRes, statsRes] = await Promise.all([
        reportAPI.adminOverview(),
        reportAPI.adminStatistics()
      ]);
      setOverview(overviewRes.data);
      setStatistics(statsRes.data);
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

  const quickLinks = [
    { path: '/admin/grades', label: 'จัดการชั้นปี', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { path: '/admin/classes', label: 'จัดการห้องเรียน', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
    { path: '/admin/students', label: 'จัดการนักเรียน', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { path: '/admin/teachers', label: 'จัดการครู', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { path: '/admin/subjects', label: 'จัดการวิชา', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    { path: '/admin/tasks', label: 'จัดการงาน', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { path: '/admin/qrcode', label: 'สร้าง QR Code', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' },
    { path: '/admin/import', label: 'Import ข้อมูล', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard ผู้บริหาร</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-blue-600">{overview?.counts?.students || 0}</div>
          <div className="text-gray-500">นักเรียน</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-green-600">{overview?.counts?.teachers || 0}</div>
          <div className="text-gray-500">ครู</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-purple-600">{overview?.counts?.subjects || 0}</div>
          <div className="text-gray-500">วิชา</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-3xl font-bold text-orange-600">{overview?.counts?.tasks || 0}</div>
          <div className="text-gray-500">งาน</div>
        </div>
      </div>

      {/* Submission Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">สถิติการส่งงาน</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{overview?.submissions?.approved || 0}</div>
            <div className="text-sm text-gray-500">ผ่าน</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{overview?.submissions?.rejected || 0}</div>
            <div className="text-sm text-gray-500">ไม่ผ่าน</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{overview?.submissions?.pending || 0}</div>
            <div className="text-sm text-gray-500">รอตรวจ</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{overview?.submissions?.notSubmitted || 0}</div>
            <div className="text-sm text-gray-500">ยังไม่ส่ง</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{overview?.submissionRate || 0}%</div>
            <div className="text-sm text-gray-500">อัตราผ่าน</div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {quickLinks.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition-shadow flex flex-col items-center text-center"
          >
            <svg className="w-8 h-8 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} />
            </svg>
            <span className="text-sm text-gray-700">{link.label}</span>
          </Link>
        ))}
      </div>

      {/* Task Statistics */}
      {statistics.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">สถิติการส่งงานแต่ละงาน</h2>
          </div>
          <div className="overflow-x-auto">
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
                {statistics.slice(0, 10).map((stat) => (
                  <tr key={stat.taskId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stat.subjectName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">งาน {stat.taskNumber}: {stat.taskName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-green-600">{stat.approved}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600">{stat.rejected}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{stat.notSubmitted}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <span className={`px-2 py-1 rounded ${parseFloat(stat.approvalRate) >= 80 ? 'bg-green-100 text-green-800' : parseFloat(stat.approvalRate) >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {stat.approvalRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
