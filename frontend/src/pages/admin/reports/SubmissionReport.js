import React, { useState, useEffect } from 'react';
import api from '../../../services/api';

const SubmissionReport = () => {
  const [submissions, setSubmissions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    subjectId: '',
    classId: '',
    status: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [submissionsRes, subjectsRes, classesRes] = await Promise.all([
        api.get('/submissions'),
        api.get('/subjects'),
        api.get('/classes')
      ]);
      setSubmissions(submissionsRes.data);
      setSubjects(subjectsRes.data);
      setClasses(classesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (filters.subjectId && sub.task?.subjectId !== parseInt(filters.subjectId)) return false;
    if (filters.classId && sub.student?.classId !== parseInt(filters.classId)) return false;
    if (filters.status && sub.status !== filters.status) return false;
    return true;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      'NOT_SUBMITTED': { label: 'ยังไม่ส่ง', class: 'bg-gray-100 text-gray-800' },
      'PENDING': { label: 'รอตรวจ', class: 'bg-yellow-100 text-yellow-800' },
      'APPROVED': { label: 'ผ่าน', class: 'bg-green-100 text-green-800' },
      'REJECTED': { label: 'ไม่ผ่าน', class: 'bg-red-100 text-red-800' }
    };
    const config = statusConfig[status] || statusConfig['NOT_SUBMITTED'];
    return <span className={`px-2 py-1 text-xs rounded-full ${config.class}`}>{config.label}</span>;
  };

  const handlePrint = () => {
    window.print();
  };

  // Calculate summary
  const summary = {
    total: filteredSubmissions.length,
    approved: filteredSubmissions.filter(s => s.status === 'APPROVED').length,
    pending: filteredSubmissions.filter(s => s.status === 'PENDING').length,
    rejected: filteredSubmissions.filter(s => s.status === 'REJECTED').length,
    notSubmitted: filteredSubmissions.filter(s => s.status === 'NOT_SUBMITTED').length
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
          <h1 className="text-2xl font-bold text-gray-800">สรุปการส่งงาน</h1>
          <p className="text-gray-600">รายงานสรุปการส่งงานทั้งหมดในระบบ</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-800">{summary.total}</div>
          <div className="text-sm text-gray-500">ทั้งหมด</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
          <div className="text-sm text-green-600">ผ่าน</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
          <div className="text-sm text-yellow-600">รอตรวจ</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-red-600">{summary.rejected}</div>
          <div className="text-sm text-red-600">ไม่ผ่าน</div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-600">{summary.notSubmitted}</div>
          <div className="text-sm text-gray-500">ยังไม่ส่ง</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
            <select
              value={filters.subjectId}
              onChange={(e) => setFilters({...filters, subjectId: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ทั้งหมด</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.subjectName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน</label>
            <select
              value={filters.classId}
              onChange={(e) => setFilters({...filters, classId: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ทั้งหมด</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.className}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">ทั้งหมด</option>
              <option value="APPROVED">ผ่าน</option>
              <option value="PENDING">รอตรวจ</option>
              <option value="REJECTED">ไม่ผ่าน</option>
              <option value="NOT_SUBMITTED">ยังไม่ส่ง</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">นักเรียน</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ห้อง</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วิชา</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">งาน</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่ส่ง</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSubmissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{sub.student?.name}</div>
                    <div className="text-gray-500">{sub.student?.studentCode}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{sub.student?.class?.className}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{sub.task?.subject?.subjectName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{sub.task?.taskName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {sub.submitDate ? new Date(sub.submitDate).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(sub.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SubmissionReport;
