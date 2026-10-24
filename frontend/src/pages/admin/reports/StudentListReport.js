import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

const StudentListReport = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [studentsRes, classesRes] = await Promise.all([
        api.get('/students'),
        api.get('/classes')
      ]);
      setStudents(studentsRes.data);
      setClasses(classesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = selectedClass
    ? students.filter(s => s.classId === parseInt(selectedClass))
    : students;

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">รายชื่อนักเรียน</h1>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center justify-center gap-2 print:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          พิมพ์รายงาน
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4 print:hidden">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          กรองตามห้องเรียน
        </label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 min-h-[44px] border rounded-lg focus:ring-2 focus:ring-brand-500"
        >
          <option value="">ทั้งหมด</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.className}</option>
          ))}
        </select>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden print:overflow-visible">
        <div className="p-4 border-b print:border-b-2">
          <h2 className="text-lg font-semibold">
            รายชื่อนักเรียน {selectedClass ? `- ${classes.find(c => c.id === parseInt(selectedClass))?.className}` : '- ทั้งหมด'}
          </h2>
          <p className="text-sm text-gray-500">จำนวน {filteredStudents.length} คน</p>
        </div>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="min-w-[560px] w-full divide-y divide-gray-200">
            <thead className="bg-th print:bg-transparent">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">ลำดับ</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">รหัสนักเรียน</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">ชื่อ-นามสกุล</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">ห้องเรียน</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">สถานะ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((student, index) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900">{student.studentCode}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">{student.name}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">{student.class?.className}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      student.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {student.status === 'ACTIVE' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
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

export default StudentListReport;
