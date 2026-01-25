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

  // Calculate overall stats
  const getOverallStats = () => {
    if (!data?.tasks || data.tasks.length === 0) {
      return { totalTasks: 0, totalSubmitted: 0, totalNotSubmitted: 0, completionRate: 0 };
    }

    const totalTasks = data.tasks.length;
    const totalPossible = data.totalStudents * totalTasks;
    const totalSubmitted = data.tasks.reduce((sum, t) => sum + (t.approved || 0) + (t.rejected || 0), 0);
    const totalNotSubmitted = totalPossible - totalSubmitted;
    const completionRate = totalPossible > 0 ? (totalSubmitted / totalPossible) * 100 : 0;

    return { totalTasks, totalSubmitted, totalNotSubmitted, completionRate };
  };

  const stats = data ? getOverallStats() : null;

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/teacher" className="text-blue-600 hover:underline text-sm">
            &larr; กลับ
          </Link>
          <h1 className="text-xl font-bold text-gray-800 mt-1">
            {data?.subject?.subjectName}
          </h1>
          <p className="text-gray-500 text-sm">รหัส: {data?.subject?.subjectCode}</p>
        </div>
        <Link
          to="/teacher/scan"
          className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          สแกน QR
        </Link>
      </div>

      {/* Quick Stats - Compact horizontal */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-center flex-1">
            <div className="text-2xl font-bold text-blue-600">{data?.totalStudents || 0}</div>
            <div className="text-xs text-gray-500">นักเรียน</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-2xl font-bold text-gray-700">{stats?.totalTasks || 0}</div>
            <div className="text-xs text-gray-500">งาน</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-2xl font-bold text-green-600">{stats?.completionRate?.toFixed(0) || 0}%</div>
            <div className="text-xs text-gray-500">ส่งแล้ว</div>
          </div>
        </div>
      </div>

      {/* Task List - Compact */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-gray-800">รายการงาน</h2>
        </div>

        {data?.tasks?.length > 0 ? (
          <div className="divide-y">
            {data.tasks.map((task) => {
              const submitted = (task.approved || 0) + (task.rejected || 0);
              const notSubmitted = (data.totalStudents || 0) - submitted;
              const rate = data.totalStudents > 0 ? (submitted / data.totalStudents) * 100 : 0;

              return (
                <div key={task.taskId} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800 text-sm">
                      {task.taskNumber}. {task.taskName}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      notSubmitted === 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {notSubmitted === 0 ? 'ครบ' : `ค้าง ${notSubmitted}`}
                    </span>
                  </div>

                  {/* Simple progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          rate === 100 ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${rate}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500 w-14 text-right">
                      {submitted}/{data.totalStudents}
                    </span>
                  </div>

                  {/* Show breakdown only if has rejections */}
                  {task.rejected > 0 && (
                    <div className="mt-1 text-xs text-red-600">
                      ไม่ผ่าน: {task.rejected} คน
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            ยังไม่มีงานในวิชานี้
          </div>
        )}
      </div>

      {/* Quick Link */}
      <Link
        to={`/teacher/subject/${id}/students`}
        className="block w-full py-3 text-center bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
      >
        ดูรายชื่อนักเรียนทั้งหมด &rarr;
      </Link>
    </div>
  );
};

export default SubjectSummary;
