import { t } from '../../../i18n';
import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import PageHeader from '../../../components/ui/PageHeader';
import { SmartComboBox } from '../../../components/ui';

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
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title={t("รายชื่อนักเรียน")}>
        <button
          onClick={handlePrint}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center justify-center gap-2 print:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>{t("พิมพ์รายงาน")}</button>
      </PageHeader>

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4 print:hidden">
        <label className="block text-sm font-medium text-gray-700 mb-2">{t("กรองตามห้องเรียน")}</label>
        <SmartComboBox
          options={[{ value: '', label: t('ทั้งหมด') }, ...classes.map(c => ({ value: String(c.id), label: c.className }))]}
          value={selectedClass}
          onChange={(v) => setSelectedClass(v ?? '')}
          clearable={false}
          ariaLabel={t("กรองตามห้องเรียน")}
          className="w-full sm:w-64"
        />
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden print:overflow-visible">
        <div className="p-4 border-b print:border-b-2">
          <h2 className="text-lg font-semibold">{selectedClass ? t("รายชื่อนักเรียน - {className}", { className: classes.find(c => c.id === parseInt(selectedClass))?.className }) : t("รายชื่อนักเรียน - ทั้งหมด")}</h2>
          <p className="text-sm text-gray-500">{t("จำนวน {value1} คน", { value1: filteredStudents.length })}</p>
        </div>
        <div className="overflow-x-auto print:overflow-visible">
          <table className="min-w-[560px] w-full divide-y divide-gray-200">
            <thead className="bg-th print:bg-transparent">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("ลำดับ")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("รหัสนักเรียน")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("ชื่อ-นามสกุล")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("ห้องเรียน")}</th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-white print:text-black uppercase">{t("สถานะ")}</th>
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
                      {student.status === 'ACTIVE' ? t('ใช้งาน') : t('ไม่ใช้งาน')}
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
