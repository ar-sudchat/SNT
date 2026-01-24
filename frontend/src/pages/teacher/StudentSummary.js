import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reportAPI } from '../../services/api';

const StudentSummary = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [id]);

  const fetchSummary = async () => {
    try {
      const response = await reportAPI.studentSummary(id);
      setData(response.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'APPROVED':
        return <span className="text-green-500 text-xl">&#10003;</span>;
      case 'REJECTED':
        return <span className="text-red-500 text-xl">&#10007;</span>;
      case 'PENDING':
        return <span className="text-yellow-500">&#9679;</span>;
      default:
        return <span className="text-gray-400">&#9675;</span>;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'APPROVED': return 'ผ่าน';
      case 'REJECTED': return 'ไม่ผ่าน';
      case 'PENDING': return 'รอตรวจ';
      default: return 'ยังไม่ส่ง';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/teacher" className="text-blue-600 hover:underline text-sm">
          &larr; กลับ
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 mt-2">
          {data?.student?.name}
        </h1>
        <p className="text-gray-500">
          รหัส: {data?.student?.studentCode} | ห้อง: {data?.student?.class?.className}
        </p>
      </div>

      <div className="space-y-6">
        {data?.subjects?.map((subject) => (
          <div key={subject.subject.id} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-blue-600 mb-4">
              {subject.subject.subjectName}
            </h3>

            <div className="space-y-3">
              {subject.tasks.map((task) => (
                <div
                  key={task.taskId}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(task.submission?.status)}
                    <span>
                      งาน {task.taskNumber}: {task.taskName}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className={`px-2 py-1 rounded ${
                      task.submission?.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      task.submission?.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      task.submission?.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {getStatusText(task.submission?.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 pt-4 border-t flex justify-between text-sm">
              <span className="text-gray-500">
                ผ่าน: {subject.tasks.filter(t => t.submission?.status === 'APPROVED').length}/{subject.tasks.length}
              </span>
              <span className="text-gray-500">
                ไม่ผ่าน: {subject.tasks.filter(t => t.submission?.status === 'REJECTED').length}
              </span>
              <span className="text-gray-500">
                ยังไม่ส่ง: {subject.tasks.filter(t => !t.submission?.status || t.submission?.status === 'NOT_SUBMITTED').length}
              </span>
            </div>
          </div>
        ))}
      </div>

      {(!data?.subjects || data.subjects.length === 0) && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">ยังไม่มีข้อมูลวิชา</p>
        </div>
      )}
    </div>
  );
};

export default StudentSummary;
