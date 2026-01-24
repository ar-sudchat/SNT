import React, { useState, useEffect } from 'react';
import { reportAPI } from '../../services/api';

const StudentPortal = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await reportAPI.studentSubmissions();
      setSubjects(response.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="flex items-center text-green-600">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            ผ่าน
          </span>
        );
      case 'REJECTED':
        return (
          <span className="flex items-center text-red-600">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            ไม่ผ่าน
          </span>
        );
      case 'PENDING':
        return (
          <span className="flex items-center text-yellow-600">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            รอตรวจ
          </span>
        );
      default:
        return (
          <span className="flex items-center text-gray-500">
            <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
            ยังไม่ส่ง
          </span>
        );
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">งานของฉัน</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {subjects.map((subject) => (
          <div key={subject.subject.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-4">
              <h2 className="text-lg font-semibold">{subject.subject.subjectName}</h2>
              <p className="text-blue-100 text-sm">รหัสวิชา: {subject.subject.subjectCode}</p>
            </div>

            <div className="divide-y">
              {subject.tasks.map((task) => (
                <div key={task.taskId} className="px-6 py-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-800">
                        งาน {task.taskNumber}: {task.taskName}
                      </h3>
                      {task.deadline && (
                        <p className="text-sm text-gray-500 mt-1">
                          กำหนดส่ง: {new Date(task.deadline).toLocaleDateString('th-TH')}
                        </p>
                      )}
                      {task.submission?.notes && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-50 px-3 py-2 rounded">
                          <span className="font-medium">หมายเหตุจากครู:</span> {task.submission.notes}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {getStatusIcon(task.submission?.status)}
                      {task.submission?.reviewDate && (
                        <p className="text-xs text-gray-400 mt-1">
                          ตรวจเมื่อ: {new Date(task.submission.reviewDate).toLocaleDateString('th-TH')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary footer */}
            <div className="bg-gray-50 px-6 py-3 flex justify-between text-sm">
              <span className="text-green-600">
                ผ่าน: {subject.tasks.filter(t => t.submission?.status === 'APPROVED').length}
              </span>
              <span className="text-red-600">
                ไม่ผ่าน: {subject.tasks.filter(t => t.submission?.status === 'REJECTED').length}
              </span>
              <span className="text-gray-500">
                ยังไม่ส่ง: {subject.tasks.filter(t => !t.submission || t.submission?.status === 'NOT_SUBMITTED').length}
              </span>
            </div>
          </div>
        ))}
      </div>

      {subjects.length === 0 && !error && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">ไม่มีงาน</h3>
          <p className="mt-1 text-sm text-gray-500">ยังไม่มีงานที่ต้องส่ง</p>
        </div>
      )}
    </div>
  );
};

export default StudentPortal;
