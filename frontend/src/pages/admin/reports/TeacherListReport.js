import { t } from '../../../i18n';
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import PageHeader from '../../../components/ui/PageHeader';

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title={t("รายชื่อครู")}>
        <button
          onClick={handlePrint}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center justify-center gap-2 print:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>{t("พิมพ์รายงาน")}</button>
      </PageHeader>

      {/* Report Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden print:overflow-visible">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">{t("รายชื่อครูทั้งหมด")}</h2>
          <p className="text-sm text-gray-500">{t("จำนวน {value1} คน", { value1: teachers.length })}</p>
        </div>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="min-w-[560px] w-full divide-y divide-gray-200">
            <thead className="bg-th print:bg-transparent">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("ลำดับ")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("รหัสครู")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("ชื่อ-นามสกุล")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("อีเมล")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("วิชาที่สอน")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("สถานะ")}</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teachers.map((teacher, index) => (
                <tr key={teacher.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm font-medium text-gray-900">{teacher.teacherCode}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">{teacher.name}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-500">{teacher.email || '-'}</td>
                  <td className="px-3 sm:px-4 py-3 text-sm text-gray-900">
                    {teacher.subjects?.map(s => s.subjectName).join(', ') || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      teacher.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {teacher.status === 'ACTIVE' ? t('ใช้งาน') : t('ไม่ใช้งาน')}
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
