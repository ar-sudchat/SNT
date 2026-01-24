import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reportAPI } from '../../services/api';

const SubjectSummary = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSummary();
  }, [id]);

  const fetchSummary = async () => {
    try {
      const response = await reportAPI.subjectSummary(id);
      setData(response.data);
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/teacher" className="text-blue-600 hover:underline text-sm">
            &larr; กลับ
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">
            {data?.subject?.subjectName}
          </h1>
          <p className="text-gray-500">รหัสวิชา: {data?.subject?.subjectCode}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{data?.totalStudents}</div>
          <div className="text-gray-500 text-sm">นักเรียนทั้งหมด</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data?.tasks?.map((task) => (
          <div key={task.taskId} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              งาน {task.taskNumber}: {task.taskName}
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  ผ่าน
                </span>
                <span className="font-semibold text-green-600">{task.approved} คน</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                  ไม่ผ่าน
                </span>
                <span className="font-semibold text-red-600">{task.rejected} คน</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                  รอตรวจ
                </span>
                <span className="font-semibold text-yellow-600">{task.pending} คน</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="flex items-center">
                  <span className="w-3 h-3 bg-gray-400 rounded-full mr-2"></span>
                  ยังไม่ส่ง
                </span>
                <span className="font-semibold text-gray-600">{task.notSubmitted} คน</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-green-500 h-2.5 rounded-full"
                  style={{
                    width: `${data.totalStudents > 0 ? (task.approved / data.totalStudents) * 100 : 0}%`
                  }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                อัตราผ่าน: {data.totalStudents > 0 ? ((task.approved / data.totalStudents) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        ))}
      </div>

      {(!data?.tasks || data.tasks.length === 0) && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">ยังไม่มีงานในวิชานี้</p>
        </div>
      )}
    </div>
  );
};

export default SubjectSummary;
