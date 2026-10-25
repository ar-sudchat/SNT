import { t, dateLocale } from '../../i18n';
import React, { useState, useEffect, useCallback } from 'react';
import { academicYearAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';
import PageHeader from '../../components/ui/PageHeader';

const shortDate = (v) => (v ? new Date(v).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: '2-digit' }) : '-');

const ManageAcademicYears = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
  const [showModal, setShowModal] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const { validate, reset: resetErrors, errorFor } = useFormErrors();
  const [formData, setFormData] = useState({
    year: '',
    name: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    status: 'ACTIVE'
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await academicYearAPI.getAll();
      setAcademicYears(response.data);
    } catch (err) {
      setError(t('ไม่สามารถโหลดข้อมูลได้'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget, [
      { key: 'year', message: t('กรุณากรอกปีการศึกษา'), missing: !String(formData.year ?? '').trim() },
    ])) return;
    try {
      const data = {
        ...formData,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null
      };
      if (editingYear) {
        await academicYearAPI.update(editingYear.id, data);
      } else {
        await academicYearAPI.create(data);
      }
      fetchData();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.error || t('เกิดข้อผิดพลาด'));
    }
  };

  const handleSetCurrent = async (id) => {
    try {
      await academicYearAPI.setCurrent(id);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || t('ไม่สามารถตั้งปีการศึกษาปัจจุบันได้'));
    }
  };

  const handleDeleteClick = (item) => {
    setDeleteConfirm({ show: true, item });
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm.item) {
      try {
        await academicYearAPI.delete(deleteConfirm.item.id);
        fetchData();
      } catch (err) {
        setError(err.response?.data?.error || t('ไม่สามารถลบได้'));
      }
    }
  };

  const openModal = (year = null) => {
    if (year) {
      setEditingYear(year);
      setFormData({
        year: year.year,
        name: year.name || '',
        startDate: year.startDate ? year.startDate.split('T')[0] : '',
        endDate: year.endDate ? year.endDate.split('T')[0] : '',
        isCurrent: year.isCurrent,
        status: year.status
      });
    } else {
      setEditingYear(null);
      const currentThaiYear = new Date().getFullYear() + 543;
      setFormData({
        year: currentThaiYear.toString(),
        name: `ปีการศึกษา ${currentThaiYear}`,
        startDate: '',
        endDate: '',
        isCurrent: false,
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingYear(null);
    setError('');
  };

  // Table columns
  const columns = [
    {
      key: 'year',
      mobilePrimary: true,
      label: t('ปีการศึกษา'),
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{value}</span>
          {row.isCurrent && (
            <span className="px-2 py-0.5 bg-brand-100 text-brand-800 text-xs rounded-full">{t("ปัจจุบัน")}</span>
          )}
        </div>
      )
    },
    {
      key: 'name',
      hideOnMobile: true,
      label: t('ชื่อ'),
      render: (value) => value || '-'
    },
    {
      key: 'startDate',
      mobileSecondary: true,
      label: t('วันเริ่มต้น'),
      render: (value, row) => (
        <>
          <span className="md:hidden">
            {value || row.endDate ? `${shortDate(value)} - ${shortDate(row.endDate)}` : t('ยังไม่ระบุช่วงเวลา')}
          </span>
          <span className="hidden md:inline">{value ? new Date(value).toLocaleDateString(dateLocale()) : '-'}</span>
        </>
      )
    },
    {
      key: 'endDate',
      hideOnMobile: true,
      label: t('วันสิ้นสุด'),
      render: (value) => value ? new Date(value).toLocaleDateString(dateLocale()) : '-'
    },
    {
      key: '_count.classes',
      mobileSecondary: true,
      label: t('ห้องเรียน'),
      render: (value) => (
        <span className="px-2 py-1 bg-brand-100 text-brand-800 text-xs rounded-full">{t("{value1} ห้อง", { value1: value || 0 })}</span>
      )
    },
    {
      key: '_count.subjects',
      hideOnMobile: true,
      label: t('วิชา'),
      render: (value) => (
        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">{t("{value1} วิชา", { value1: value || 0 })}</span>
      )
    },
    {
      key: 'status',
      label: t('สถานะ'),
      mobileBadge: true,
      render: (value) => value === 'INACTIVE' ? (
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700 whitespace-nowrap">{t("ไม่ใช้งาน")}</span>
      ) : null
    },
    {
      key: 'actions',
      label: t('จัดการ'),
      exportable: false,
      hideOnMobile: true,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {!row.isCurrent && (
            <button
              onClick={(e) => { e.stopPropagation(); handleSetCurrent(row.id); }}
              className="px-3 py-2 min-h-[44px] text-brand-600 hover:bg-brand-50 rounded text-sm"
            >{t("ตั้งเป็นปัจจุบัน")}</button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* Header */}
      <PageHeader title={t("ปีการศึกษา")}>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>{t("เพิ่มปีการศึกษา")}</button>
      </PageHeader>
      <AddFab onClick={() => openModal()} label={t("เพิ่มปีการศึกษา")} />

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Table */}
      <SmartTable
        data={academicYears}
        columns={columns}
        loading={loading}
        exportFileName="academic_years"
        searchable
        exportable
        pagination
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t("เพิ่มปีการศึกษา")}</button>
            
          </>
        }
        emptyMessage={t("ยังไม่มีปีการศึกษา")}
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingYear ? t('แก้ไขปีการศึกษา') : t('เพิ่มปีการศึกษา')}
        onClose={closeModal}
        id="academic-year-form"
        initialWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {editingYear && (
              <button
                type="button"
                onClick={() => { const target = editingYear; closeModal(); handleDeleteClick(target); }}
                className="px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 sm:mr-auto"
              >{t("ลบ…")}</button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">{t("ยกเลิก")}</button>
                <button type="submit" form="academic-year-form" className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t("บันทึก")}</button>
          </div>
        }
      >
        <div className="p-4">
          <form id="academic-year-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              <div data-field="year">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ปีการศึกษา (พ.ศ.) ")}<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder={t("เช่น 2567")}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                  {errorFor('year', !String(formData.year ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('year', !String(formData.year ?? '').trim())}</p>}
              </div>

              <label htmlFor="isCurrent" className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  id="isCurrent"
                  checked={formData.isCurrent}
                  onChange={(e) => setFormData({ ...formData, isCurrent: e.target.checked })}
                  className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-gray-700">{t("ตั้งเป็นปีการศึกษาปัจจุบัน")}</span>
              </label>

              <details className="border rounded-lg px-3 py-2">
                <summary className="cursor-pointer text-sm text-gray-600 select-none">{t("ข้อมูลเพิ่มเติม (ไม่บังคับ)")}</summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชื่อ")}</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={t("เช่น ปีการศึกษา 2567")}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("วันเริ่มต้น")}</label>
                      <input
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("วันสิ้นสุด")}</label>
                      <input
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("สถานะ")}</label>
                    <SmartComboBox
                      options={[{ value: 'ACTIVE', label: t('ใช้งาน') }, { value: 'INACTIVE', label: t('ไม่ใช้งาน') }]}
                      value={formData.status}
                      onChange={(v) => v && setFormData({ ...formData, status: v })}
                      searchable={false}
                      clearable={false}
                      ariaLabel={t("สถานะ")}
                    />
                  </div>
                </div>
              </details>

              {editingYear && !editingYear.isCurrent && (
                <button
                  type="button"
                  onClick={() => { const id = editingYear.id; closeModal(); handleSetCurrent(id); }}
                  className="w-full px-4 py-2 min-h-[44px] text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50"
                >{t("ตั้งเป็นปีการศึกษาปัจจุบัน")}</button>
              )}

          </form>
        </div>
      </WindowModal>
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title={t("ยืนยันการลบ")}
        message={t("ต้องการลบปีการศึกษา \"{value1}\" หรือไม่?", { value1: deleteConfirm.item?.year })}
        confirmText={t("ลบ")}
        cancelText={t("ยกเลิก")}
        type="danger"
      />
    </div>
  );
};

export default ManageAcademicYears;
