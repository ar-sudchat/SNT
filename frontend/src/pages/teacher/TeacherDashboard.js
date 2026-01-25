import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { reportAPI } from '../../services/api';

const TeacherDashboard = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    try {
      const response = await reportAPI.teacherSubjects();
      setSubjects(response.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลวิชาได้');
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">วิชาของฉัน</h1>
      </div>

      {/* Main Action - Scan QR */}
      <Link
        to="/teacher/scan"
        className="block w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg active:scale-98"
      >
        <div className="flex items-center justify-center gap-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          <span className="text-lg font-semibold">สแกน QR ตรวจงาน</span>
        </div>
      </Link>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Subject List - Compact for mobile */}
      <div className="space-y-3">
        {subjects.map((subject) => (
          <Link
            key={subject.id}
            to={`/teacher/subject/${subject.id}`}
            className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow active:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 truncate">
                  {subject.subjectName}
                </h3>
                <p className="text-xs text-gray-500">
                  {subject.subjectCode}
                </p>
              </div>
              <div className="flex gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {subject.tasks?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500">งาน</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">
                    {subject._count?.qrcodes || 0}
                  </div>
                  <div className="text-xs text-gray-500">นร.</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

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
