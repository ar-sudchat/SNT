import React, { useState, useEffect, useCallback } from 'react';
import { studentAPI, classAPI, gradeAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { useNavigate } from 'react-router-dom';
import { AddFab } from '../../components/ui/SmartTable';

const toId = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const ManageStudents = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
  const [errorAlert, setErrorAlert] = useState({ show: false, message: '' });
  const [filterGrade, setFilterGrade] = useState(null);
  const [filterClass, setFilterClass] = useState(null);
  const { validate, reset: resetErrors, errorFor } = useFormErrors();
  const [formData, setFormData] = useState({
    studentCode: '',
    studentNumber: '',
    name: '',
    classId: null,
    email: '',
    status: 'ACTIVE'
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterClass) params.classId = filterClass;
      if (filterGrade) params.gradeId = filterGrade;

      const classParams = {};
      if (filterGrade) classParams.gradeId = filterGrade;

      const [studentRes, classRes, gradeRes] = await Promise.all([
        studentAPI.getAll(params),
        classAPI.getAll(classParams),
        gradeAPI.getAll()
      ]);
      setStudents(studentRes.data);
      setClasses(classRes.data);
      setGrades(gradeRes.data);
    } catch (err) {
      setErrorAlert({ show: true, message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setLoading(false);
    }
  }, [filterClass, filterGrade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget, [
      { key: 'studentCode', message: 'กรุณากรอกรหัสนักเรียน', missing: !String(formData.studentCode ?? '').trim() },
      { key: 'name', message: 'กรุณากรอกชื่อ-นามสกุล', missing: !String(formData.name ?? '').trim() },
      { key: 'classId', message: 'กรุณาเลือกห้องเรียน', missing: toId(formData.classId) === null },
    ])) return;
    const classId = toId(formData.classId);
    if (classId === null) {
      setErrorAlert({ show: true, message: 'กรุณาเลือกห้องเรียน' });
      return;
    }
    try {
      const data = {
        ...formData,
        classId,
        studentNumber: formData.studentNumber ? parseInt(formData.studentNumber) : null
      };
      if (editingStudent) {
        await studentAPI.update(editingStudent.id, data);
      } else {
        await studentAPI.create(data);
      }
      fetchData();
      closeModal();
    } catch (err) {
      setErrorAlert({ show: true, message: err.response?.data?.error || 'เกิดข้อผิดพลาด' });
    }
  };

  const handleDeleteClick = (item) => {
    setDeleteConfirm({ show: true, item });
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirm.item) {
      try {
        await studentAPI.delete(deleteConfirm.item.id);
        fetchData();
      } catch (err) {
        setErrorAlert({ show: true, message: err.response?.data?.error || 'ไม่สามารถลบได้' });
      }
    }
  };

  const openModal = (student = null) => {
    if (student) {
      setEditingStudent(student);
      setFormData({
        studentCode: student.studentCode,
        studentNumber: student.studentNumber || '',
        name: student.name,
        classId: toId(student.classId ?? student.class?.id),
        email: student.email || '',
        status: student.status
      });
    } else {
      setEditingStudent(null);
      setFormData({ studentCode: '', studentNumber: '', name: '', classId: toId(filterClass), email: '', status: 'ACTIVE' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingStudent(null);
  };

  // Table columns configuration
  const columns = [
    {
      key: 'studentNumber',
      hideOnMobile: true,
      label: 'เลขที่',
      sortable: true,
      width: '60px',
      render: (value) => <span className="text-center">{value || '-'}</span>
    },
    {
      key: 'studentCode',
      mobileSecondary: true,
      label: 'รหัส',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'name',
      mobilePrimary: true,
      label: 'ชื่อ-นามสกุล',
      sortable: true
    },
    {
      key: 'class.className',
      mobileSecondary: true,
      label: 'ห้องเรียน',
      sortable: true
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

  const activeFilterCount = ((filterGrade) ? 1 : 0) + ((filterClass) ? 1 : 0);
  const filterControls = (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="sm:w-52">
          <label className="block text-sm font-medium text-gray-700 mb-1">ชั้นเรียน</label>
          <SmartComboBox
            options={grades}
            value={filterGrade}
            onChange={(val) => {
              setFilterGrade(val);
              setFilterClass(null); // Reset class when grade changes
            }}
            labelKey="gradeName"
            valueKey="id"
            placeholder="ทุกชั้น"
            clearable
            searchable
          />
        </div>
        <div className="sm:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน</label>
          <SmartComboBox
            options={classes}
            value={filterClass}
            onChange={setFilterClass}
            labelKey="className"
            valueKey="id"
            placeholder="ทุกห้องเรียน"
            clearable
            searchable
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <AddFab onClick={() => openModal()} label="เพิ่มนักเรียน" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">นักเรียน</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มนักเรียน
        </button>
      </div>

      {/* Filter: จอ sm ขึ้นไปแสดงในแถว · มือถือใช้ปุ่ม 'ตัวกรอง' ใน SmartTable */}
      <div className="hidden sm:block bg-white rounded-lg shadow p-4">
        {filterControls}
      </div>

      {/* Table */}
      <SmartTable
        filters={filterControls}
        activeFilterCount={activeFilterCount}
        data={students}
        columns={columns}
        loading={loading}
        exportFileName="students"
        searchable
        exportable
        pagination
        pageSize={10}
        onClearFilters={() => { setFilterGrade(null); setFilterClass(null); }}
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">เพิ่มนักเรียน</button>
            <button type="button" onClick={() => navigate('/admin/import')} className="px-4 py-2 min-h-[44px] border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">นำเข้าจากไฟล์</button>
          </>
        }
        emptyMessage="ยังไม่มีนักเรียน"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingStudent ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียน'}
        onClose={closeModal}
        id="student-form"
        initialWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {editingStudent && (
              <button
                type="button"
                onClick={() => { const target = editingStudent; closeModal(); handleDeleteClick(target); }}
                className="px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 sm:mr-auto"
              >
                ลบ…
              </button>
            )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit" form="student-form"
                  className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700"
                >
                  บันทึก
                </button>
          </div>
        }
      >
        <div className="p-4">
          <form id="student-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div data-field="studentCode">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    รหัสนักเรียน <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.studentCode}
                    onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  {errorFor('studentCode', !String(formData.studentCode ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('studentCode', !String(formData.studentCode ?? '').trim())}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เลขที่
                  </label>
                  <input
                    type="number"
                    value={formData.studentNumber}
                    onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    min="1"
                    placeholder="เลขที่ในห้อง"
                  />
                </div>
              </div>

              <div data-field="name">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ-นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                  {errorFor('name', !String(formData.name ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('name', !String(formData.name ?? '').trim())}</p>}
              </div>

              <div data-field="classId">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ห้องเรียน <span className="text-red-500">*</span>
                </label>
                <SmartComboBox
                  options={classes}
                  value={formData.classId}
                  onChange={(val) => setFormData({ ...formData, classId: val })}
                  labelKey="className"
                  valueKey="id"
                  placeholder="เลือกห้องเรียน"
                  searchable
                    error={errorFor('classId', toId(formData.classId) === null)}
                  />
              </div>

              <details className="border rounded-lg px-3 py-2">
                <summary className="cursor-pointer text-sm text-gray-600 select-none">ข้อมูลเพิ่มเติม (ไม่บังคับ)</summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title="ยืนยันการลบ"
        message={`ต้องการลบนักเรียน "${deleteConfirm.item?.name}" หรือไม่?`}
        confirmText="ลบ"
        cancelText="ยกเลิก"
        type="danger"
      />

      {/* Error Alert Dialog */}
      <ConfirmDialog
        isOpen={errorAlert.show}
        onClose={() => setErrorAlert({ show: false, message: '' })}
        title="เกิดข้อผิดพลาด"
        message={errorAlert.message}
        confirmText="ตกลง"
        type="danger"
        mode="alert"
      />
    </div>
  );
};

export default ManageStudents;
