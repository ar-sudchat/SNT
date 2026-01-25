import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

const TeacherListReport = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeachers();
  }, []);

  const fetchTeachers = async () => {
    try {
      const response = await api.get('/teachers');
      setTeachers(response.data);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">รายชื่อครู</h1>
          <p className="text-gray-600">รายงานรายชื่อครูทั้งหมดในระบบ</p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 print:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          พิมพ์รายงาน
        </button>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">รายชื่อครูทั้งหมด</h2>
          <p className="text-sm text-gray-500">จำนวน {teachers.length} คน</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลำดับ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">รหัสครู</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ-นามสกุล</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">อีเมล</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วิชาที่สอน</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teachers.map((teacher, index) => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{teacher.teacherCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{teacher.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{teacher.email || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {teacher.subjects?.map(s => s.subjectName).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      teacher.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {teacher.status === 'ACTIVE' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TeacherListReport;
