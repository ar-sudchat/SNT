import { t, dateLocale } from '../../../i18n';
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import PageHeader from '../../../components/ui/PageHeader';
import { SmartComboBox } from '../../../components/ui';

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
      'NOT_SUBMITTED': { label: t('ยังไม่ส่ง'), class: 'bg-gray-100 text-gray-800' },
      'PENDING': { label: t('รอตรวจ'), class: 'bg-yellow-100 text-yellow-800' },
      'APPROVED': { label: t('ผ่าน'), class: 'bg-green-100 text-green-800' },
      'REJECTED': { label: t('ไม่ผ่าน'), class: 'bg-red-100 text-red-800' }
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title={t("สรุปการส่งงาน")}>
        <button
          onClick={handlePrint}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center justify-center gap-2 print:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>{t("พิมพ์รายงาน")}</button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-800">{summary.total}</div>
          <div className="text-sm text-gray-500">{t("ทั้งหมด")}</div>
        </div>
        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
          <div className="text-sm text-green-600">{t("ผ่าน")}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-yellow-600">{summary.pending}</div>
          <div className="text-sm text-yellow-600">{t("รอตรวจ")}</div>
        </div>
        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-red-600">{summary.rejected}</div>
          <div className="text-sm text-red-600">{t("ไม่ผ่าน")}</div>
        </div>
        <div className="bg-gray-50 rounded-lg shadow p-4 col-span-2 md:col-span-1">
          <div className="text-2xl font-bold text-gray-600">{summary.notSubmitted}</div>
          <div className="text-sm text-gray-500">{t("ยังไม่ส่ง")}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("วิชา")}</label>
            <SmartComboBox
              options={[{ value: '', label: t('ทั้งหมด') }, ...subjects.map(s => ({ value: String(s.id), label: s.subjectName }))]}
              value={filters.subjectId}
              onChange={(v) => setFilters({...filters, subjectId: v ?? ''})}
              clearable={false}
              ariaLabel={t("วิชา")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("ห้องเรียน")}</label>
            <SmartComboBox
              options={[{ value: '', label: t('ทั้งหมด') }, ...classes.map(c => ({ value: String(c.id), label: c.className }))]}
              value={filters.classId}
              onChange={(v) => setFilters({...filters, classId: v ?? ''})}
              clearable={false}
              ariaLabel={t("ห้องเรียน")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("สถานะ")}</label>
            <SmartComboBox
              options={[{ value: '', label: t('ทั้งหมด') }, { value: 'APPROVED', label: t('ผ่าน') }, { value: 'PENDING', label: t('รอตรวจ') }, { value: 'REJECTED', label: t('ไม่ผ่าน') }, { value: 'NOT_SUBMITTED', label: t('ยังไม่ส่ง') }]}
              value={filters.status}
              onChange={(v) => setFilters({...filters, status: v ?? ''})}
              clearable={false}
              searchable={false}
              ariaLabel={t("สถานะ")}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden print:overflow-visible">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="min-w-[640px] w-full divide-y divide-gray-200">
            <thead className="bg-th print:bg-transparent">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("นักเรียน")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("ห้อง")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("วิชา")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("งาน")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("วันที่ส่ง")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("สถานะ")}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSubmissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{sub.student?.name}</div>
                    <div className="text-gray-500">{sub.student?.studentCode}</div>
                  </td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">{sub.student?.class?.className}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">{sub.task?.subject?.subjectName}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">{sub.task?.taskName}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-500">
                    {sub.submitDate ? new Date(sub.submitDate).toLocaleDateString(dateLocale()) : '-'}
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
