import { t } from '../../i18n';
import React, { useState, useEffect, useCallback } from 'react';
import { teacherAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';
import PageHeader from '../../components/ui/PageHeader';

const ManageTeachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, teacher: null });
  const [errorAlert, setErrorAlert] = useState({ show: false, message: '' });
  const { validate, reset: resetErrors, errorFor } = useFormErrors();
  const [formData, setFormData] = useState({
    teacherCode: '',
    name: '',
    email: '',
    status: 'ACTIVE'
  });

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await teacherAPI.getAll();
      setTeachers(response.data);
    } catch (err) {
      setErrorAlert({ show: true, message: err.response?.data?.error || t('ไม่สามารถโหลดข้อมูลได้') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget, [
      { key: 'teacherCode', message: t('กรุณากรอกรหัสครู'), missing: !String(formData.teacherCode ?? '').trim() },
      { key: 'name', message: t('กรุณากรอกชื่อ-นามสกุล'), missing: !String(formData.name ?? '').trim() },
    ])) return;
    try {
      if (editingTeacher) {
        await teacherAPI.update(editingTeacher.id, formData);
      } else {
        await teacherAPI.create(formData);
      }
      fetchTeachers();
      closeModal();
    } catch (err) {
      setErrorAlert({ show: true, message: err.response?.data?.error || t('เกิดข้อผิดพลาด') });
    }
  };

  const handleDeleteClick = (teacher) => {
    setDeleteConfirm({ show: true, teacher });
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm.teacher) {
      try {
        await teacherAPI.delete(deleteConfirm.teacher.id);
        fetchTeachers();
      } catch (err) {
        setErrorAlert({ show: true, message: err.response?.data?.error || t('ไม่สามารถลบได้') });
      }
    }
  };

  const openModal = (teacher = null) => {
    if (teacher) {
      setEditingTeacher(teacher);
      setFormData({
        teacherCode: teacher.teacherCode,
        name: teacher.name,
        email: teacher.email || '',
        status: teacher.status
      });
    } else {
      setEditingTeacher(null);
      setFormData({ teacherCode: '', name: '', email: '', status: 'ACTIVE' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingTeacher(null);
  };

  // Table columns configuration
  const columns = [
    {
      key: 'teacherCode',
      mobileSecondary: true,
      label: t('รหัสครู'),
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'name',
      mobilePrimary: true,
      label: t('ชื่อ-นามสกุล'),
      sortable: true
    },
    {
      key: 'subjects',
      mobileSecondary: true,
      label: t('วิชาที่สอน'),
      render: (value) => (
        <>
          <span className="md:hidden">{t("{value1} วิชา", { value1: value?.length || 0 })}</span>
          <span className="hidden md:inline px-2 py-1 bg-brand-100 text-brand-800 text-xs rounded-full">{t("{value1} วิชา", { value1: value?.length || 0 })}</span>
        </>
      )
    },
    {
      key: 'status',
      label: t('สถานะ'),
      mobileBadge: true,
      render: (value) => value === 'INACTIVE' ? (
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700 whitespace-nowrap">{t("ไม่ใช้งาน")}</span>
      ) : null
    }
  ];

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* Header */}
      <PageHeader title={t("ครู")}>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>{t("เพิ่มครู")}</button>
      </PageHeader>
      <AddFab onClick={() => openModal()} label={t("เพิ่มครู")} />

      {/* Smart Table */}
      <SmartTable
        data={teachers}
        columns={columns}
        loading={loading}
        exportFileName="teachers"
        searchable
        exportable
        pagination
        pageSize={10}
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t("เพิ่มครู")}</button>
            
          </>
        }
        emptyMessage={t("ยังไม่มีครู")}
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingTeacher ? t('แก้ไขครู') : t('เพิ่มครู')}
        onClose={closeModal}
        id="teacher-form"
        initialWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {editingTeacher && (
              <button
                type="button"
                onClick={() => { const target = editingTeacher; closeModal(); handleDeleteClick(target); }}
                className="px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 sm:mr-auto"
              >{t("ลบ…")}</button>
            )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50"
                >{t("ยกเลิก")}</button>
                <button
                  type="submit" form="teacher-form"
                  className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                >{t("บันทึก")}</button>
          </div>
        }
      >
        <div className="p-4">
          <form id="teacher-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              <div data-field="teacherCode">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("รหัสครู ")}<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.teacherCode}
                  onChange={(e) => setFormData({ ...formData, teacherCode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                  {errorFor('teacherCode', !String(formData.teacherCode ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('teacherCode', !String(formData.teacherCode ?? '').trim())}</p>}
              </div>

              <div data-field="name">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชื่อ-นามสกุล ")}<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                  {errorFor('name', !String(formData.name ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('name', !String(formData.name ?? '').trim())}</p>}
              </div>

              <details className="border rounded-lg px-3 py-2">
                <summary className="cursor-pointer text-sm text-gray-600 select-none">{t("ข้อมูลเพิ่มเติม (ไม่บังคับ)")}</summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("อีเมล")}</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                    />
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

          </form>
        </div>
      </WindowModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, teacher: null })}
        onConfirm={handleDeleteConfirm}
        title={t("ยืนยันการลบ")}
        message={t("ต้องการลบครู \"{value1}\" หรือไม่?", { value1: deleteConfirm.teacher?.name })}
        confirmText={t("ลบ")}
        cancelText={t("ยกเลิก")}
        type="danger"
      />

      {/* Error Alert Dialog */}
      <ConfirmDialog
        isOpen={errorAlert.show}
        onClose={() => setErrorAlert({ show: false, message: '' })}
        title={t("เกิดข้อผิดพลาด")}
        message={errorAlert.message}
        confirmText={t("ตกลง")}
        type="danger"
        mode="alert"
      />
    </div>
  );
};

export default ManageTeachers;

