import React, { useState, useEffect, useCallback } from 'react';
import { gradeAPI } from '../../services/api';
import { SmartTable, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';

const ManageGrades = () => {
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
  const [showModal, setShowModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const { validate, reset: resetErrors, errorFor } = useFormErrors();
  const [formData, setFormData] = useState({
    gradeName: '',
    description: '',
    status: 'ACTIVE'
  });

  const fetchGrades = useCallback(async () => {
    try {
      setLoading(true);
      const response = await gradeAPI.getAll();
      setGrades(response.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget, [
      { key: 'gradeName', message: 'กรุณากรอกชื่อชั้นปี', missing: !String(formData.gradeName ?? '').trim() },
    ])) return;
    try {
      if (editingGrade) {
        await gradeAPI.update(editingGrade.id, formData);
      } else {
        await gradeAPI.create(formData);
      }
      fetchGrades();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeleteClick = (item) => {
    setDeleteConfirm({ show: true, item });
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm.item) {
      try {
        await gradeAPI.delete(deleteConfirm.item.id);
        fetchGrades();
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถลบได้');
      }
    }
  };

  const openModal = (grade = null) => {
    if (grade) {
      setEditingGrade(grade);
      setFormData({
        gradeName: grade.gradeName,
        description: grade.description || '',
        status: grade.status
      });
    } else {
      setEditingGrade(null);
      setFormData({ gradeName: '', description: '', status: 'ACTIVE' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingGrade(null);
    setError('');
  };

  // Table columns
  const columns = [
    {
      key: 'gradeName',
      mobilePrimary: true,
      label: 'ชั้นปี',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'description',
      mobileSecondary: true,
      label: 'คำอธิบาย',
      render: (value) => value || '-'
    },
    {
      key: '_count.classes',
      hideOnMobile: true,
      label: 'ห้องเรียน',
      render: (value) => (
        <span className="px-2 py-1 bg-brand-100 text-brand-800 text-xs rounded-full">
          {value || 0} ห้อง
        </span>
      )
    },
    {
      key: 'status',
      label: 'สถานะ',
      mobileBadge: true,
      render: (value) => value === 'INACTIVE' ? (
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700 whitespace-nowrap">ไม่ใช้งาน</span>
      ) : null
    }
  ];

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <AddFab onClick={() => openModal()} label="เพิ่มชั้นปี" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">ชั้นปี</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มชั้นปี
        </button>
      </div>

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
        data={grades}
        columns={columns}
        loading={loading}
        exportFileName="grades"
        searchable
        exportable
        pagination
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">เพิ่มชั้นปี</button>
            
          </>
        }
        emptyMessage="ยังไม่มีชั้นปี"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingGrade ? 'แก้ไขชั้นปี' : 'เพิ่มชั้นปี'}
        onClose={closeModal}
        id="grade-form"
        initialWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {editingGrade && (
              <button
                type="button"
                onClick={() => { const target = editingGrade; closeModal(); handleDeleteClick(target); }}
                className="px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 sm:mr-auto"
              >
                ลบ…
              </button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button type="submit" form="grade-form" className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                  บันทึก
                </button>
          </div>
        }
      >
        <div className="p-4">
          <form id="grade-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              <div data-field="gradeName">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อชั้นปี <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.gradeName}
                  onChange={(e) => setFormData({ ...formData, gradeName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                  {errorFor('gradeName', !String(formData.gradeName ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('gradeName', !String(formData.gradeName ?? '').trim())}</p>}
              </div>

              <details className="border rounded-lg px-3 py-2">
                <summary className="cursor-pointer text-sm text-gray-600 select-none">ข้อมูลเพิ่มเติม (ไม่บังคับ)</summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                      rows="3"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="ACTIVE">ใช้งาน</option>
                      <option value="INACTIVE">ไม่ใช้งาน</option>
                    </select>
                  </div>
                </div>
              </details>

          </form>
        </div>
      </WindowModal>

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title="ยืนยันการลบ"
        message={`ต้องการลบชั้นปี "${deleteConfirm.item?.gradeName}" หรือไม่?`}
        confirmText="ลบ"
        cancelText="ยกเลิก"
        type="danger"
      />
    </div>
  );
};

export default ManageGrades;
