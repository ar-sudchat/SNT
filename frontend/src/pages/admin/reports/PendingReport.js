import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

const PendingReport = () => {
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [submissionsRes, classesRes] = await Promise.all([
        api.get('/submissions?status=NOT_SUBMITTED'),
        api.get('/classes')
      ]);
      setPendingSubmissions(submissionsRes.data.filter(s => s.status === 'NOT_SUBMITTED' || s.status === 'REJECTED'));
      setClasses(classesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = selectedClass
    ? pendingSubmissions.filter(s => s.student?.classId === parseInt(selectedClass))
    : pendingSubmissions;

  // Group by student
  const groupedByStudent = filteredSubmissions.reduce((acc, sub) => {
    const studentId = sub.student?.id;
    if (!acc[studentId]) {
      acc[studentId] = {
        student: sub.student,
        tasks: []
      };
    }
    acc[studentId].tasks.push(sub.task);
    return acc;
  }, {});

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
          <h1 className="text-2xl font-bold text-gray-800">นักเรียนค้างส่งงาน</h1>
          <p className="text-gray-600">รายงานนักเรียนที่ยังไม่ส่งงานหรืองานไม่ผ่าน</p>
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

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4 print:hidden">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          กรองตามห้องเรียน
        </label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="w-full sm:w-64 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">ทั้งหมด</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.className}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="bg-red-50 rounded-lg shadow p-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-full">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">{Object.keys(groupedByStudent).length}</div>
            <div className="text-sm text-red-600">นักเรียนที่มีงานค้าง</div>
          </div>
          <div className="ml-8">
            <div className="text-2xl font-bold text-red-600">{filteredSubmissions.length}</div>
            <div className="text-sm text-red-600">งานที่ยังไม่ส่ง/ไม่ผ่าน</div>
          </div>
        </div>
      </div>

      {/* Student List */}
      <div className="space-y-4">
        {Object.values(groupedByStudent).map(({ student, tasks }) => (
          <div key={student.id} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{student.name}</h3>
                  <p className="text-sm text-gray-500">{student.studentCode} - {student.class?.className}</p>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  ค้าง {tasks.length} งาน
                </span>
              </div>
            </div>
            <div className="p-4">
              <div className="grid gap-2">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium text-gray-900">{task.taskName}</span>
                      <span className="ml-2 text-sm text-gray-500">({task.subject?.subjectName})</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {task.deadline ? `กำหนดส่ง: ${new Date(task.deadline).toLocaleDateString('th-TH')}` : 'ไม่มีกำหนด'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {Object.keys(groupedByStudent).length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <svg className="w-16 h-16 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900">ไม่มีนักเรียนค้างส่งงาน</h3>
            <p className="text-gray-500">นักเรียนทุกคนส่งงานครบแล้ว</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingReport;
