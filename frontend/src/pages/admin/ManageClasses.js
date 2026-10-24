import React, { useState, useEffect, useCallback, useRef } from 'react';
import { classAPI, gradeAPI, teacherAPI, academicYearAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';

const toId = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const ManageClasses = () => {
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
  const [errorAlert, setErrorAlert] = useState({ show: false, message: '' });
  const [filterGrade, setFilterGrade] = useState(null);
  const [filterAcademicYear, setFilterAcademicYear] = useState(null);
  const { validate, reset: resetErrors, errorFor } = useFormErrors();
  const [formData, setFormData] = useState({
    className: '',
    gradeId: null,
    teacherId: null,
    academicYearId: null,
    capacity: 40,
    description: '',
    status: 'ACTIVE'
  });

  const yearDefaulted = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterGrade) params.gradeId = filterGrade;
      if (filterAcademicYear) params.academicYearId = filterAcademicYear;

      const [classRes, gradeRes, teacherRes, academicYearRes] = await Promise.all([
        classAPI.getAll(params),
        gradeAPI.getAll(),
        teacherAPI.getAll(),
        academicYearAPI.getAll()
      ]);
      setClasses(classRes.data);
      setGrades(gradeRes.data);
      setTeachers(teacherRes.data);
      setAcademicYears(academicYearRes.data);
      // ครั้งแรก: เลือกปีการศึกษาปัจจุบันให้อัตโนมัติ
      if (!yearDefaulted.current) {
        yearDefaulted.current = true;
        const cur = academicYearRes.data.find(y => y.isCurrent);
        if (cur && !filterAcademicYear) setFilterAcademicYear(cur.id);
      }
    } catch (err) {
      setErrorAlert({ show: true, message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setLoading(false);
    }
  }, [filterGrade, filterAcademicYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget, [
      { key: 'className', message: 'กรุณากรอกชื่อห้อง', missing: !String(formData.className ?? '').trim() },
      { key: 'gradeId', message: 'กรุณาเลือกชั้นปี', missing: toId(formData.gradeId) === null },
    ])) return;
    const gradeId = toId(formData.gradeId);
    if (gradeId === null) {
      setErrorAlert({ show: true, message: 'กรุณาเลือกชั้นปี' });
      return;
    }
    const capacity = parseInt(formData.capacity);
    try {
      const data = {
        ...formData,
        gradeId,
        teacherId: toId(formData.teacherId),
        academicYearId: toId(formData.academicYearId),
        capacity: Number.isNaN(capacity) ? 40 : capacity
      };
      if (editingClass) {
        await classAPI.update(editingClass.id, data);
      } else {
        await classAPI.create(data);
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
        await classAPI.delete(deleteConfirm.item.id);
        fetchData();
      } catch (err) {
        setErrorAlert({ show: true, message: err.response?.data?.error || 'ไม่สามารถลบได้' });
      }
    }
  };

  const openModal = (classData = null) => {
    // Find current academic year for default
    const currentAcademicYear = academicYears.find(ay => ay.isCurrent);

    if (classData) {
      setEditingClass(classData);
      setFormData({
        className: classData.className,
        gradeId: toId(classData.gradeId ?? classData.grade?.id),
        teacherId: toId(classData.teacherId ?? classData.homeTeacher?.id),
        academicYearId: toId(classData.academicYearId ?? classData.academicYear?.id),
        capacity: classData.capacity,
        description: classData.description || '',
        status: classData.status
      });
    } else {
      setEditingClass(null);
      setFormData({
        className: '',
        gradeId: filterGrade || null,
        teacherId: null,
        academicYearId: filterAcademicYear || currentAcademicYear?.id || null,
        capacity: 40,
        description: '',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingClass(null);
  };

  // Table columns
  const columns = [
    {
      key: 'className',
      mobilePrimary: true,
      label: 'ห้องเรียน',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'grade.gradeName',
      mobileSecondary: true,
      label: 'ชั้นปี',
      sortable: true
    },
    {
      key: 'homeTeacher.name',
      mobileSecondary: true,
      label: 'ครูประจำชั้น',
      render: (value) => value || '-'
    },
    {
      key: '_count.students',
      mobileSecondary: true,
      label: 'นักเรียน',
      render: (value, row) => (
        <>
          <span className="md:hidden">{value || 0} คน</span>
          <span className="hidden md:inline px-2 py-1 bg-brand-100 text-brand-800 text-xs rounded-full">
            {value || 0}/{row.capacity}
          </span>
        </>
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

  const activeFilterCount = ((filterGrade) ? 1 : 0) + ((filterAcademicYear) ? 1 : 0);
  const filterControls = (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="sm:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">กรองตามชั้นปี</label>
          <SmartComboBox
            options={grades}
            value={filterGrade}
            onChange={setFilterGrade}
            labelKey="gradeName"
            valueKey="id"
            placeholder="ทุกชั้นปี"
            clearable
            searchable
          />
        </div>
        <div className="sm:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">กรองตามปีการศึกษา</label>
          <SmartComboBox
            options={academicYears}
            value={filterAcademicYear}
            onChange={setFilterAcademicYear}
            labelKey="year"
            valueKey="id"
            placeholder="ทุกปีการศึกษา"
            clearable
            searchable
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <AddFab onClick={() => openModal()} label="เพิ่มห้องเรียน" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">ห้องเรียน</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มห้องเรียน
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
        data={classes}
        columns={columns}
        loading={loading}
        exportFileName="classes"
        searchable
        exportable
        pagination
        onClearFilters={() => { setFilterGrade(null); setFilterAcademicYear(null); }}
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">เพิ่มห้องเรียน</button>
            
          </>
        }
        emptyMessage="ยังไม่มีห้องเรียน"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingClass ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน'}
        onClose={closeModal}
        id="class-form"
        initialWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {editingClass && (
              <button
                type="button"
                onClick={() => { const target = editingClass; closeModal(); handleDeleteClick(target); }}
                className="px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 sm:mr-auto"
              >
                ลบ…
              </button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button type="submit" form="class-form" className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                  บันทึก
                </button>
          </div>
        }
      >
        <div className="p-4">
          <form id="class-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              <div data-field="className">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อห้องเรียน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.className}
                  onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                  {errorFor('className', !String(formData.className ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('className', !String(formData.className ?? '').trim())}</p>}
              </div>

              <div data-field="gradeId">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชั้นปี <span className="text-red-500">*</span>
                </label>
                <SmartComboBox
                  options={grades}
                  value={formData.gradeId}
                  onChange={(val) => setFormData({ ...formData, gradeId: val })}
                  labelKey="gradeName"
                  valueKey="id"
                  placeholder="เลือกชั้นปี"
                  searchable
                    error={errorFor('gradeId', toId(formData.gradeId) === null)}
                  />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ครูประจำชั้น</label>
                <SmartComboBox
                  options={teachers}
                  value={formData.teacherId}
                  onChange={(val) => setFormData({ ...formData, teacherId: val })}
                  labelKey="name"
                  valueKey="id"
                  placeholder="เลือกครูประจำชั้น"
                  searchable
                  clearable
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ปีการศึกษา
                </label>
                <SmartComboBox
                  options={academicYears}
                  value={formData.academicYearId}
                  onChange={(val) => setFormData({ ...formData, academicYearId: val })}
                  labelKey="year"
                  valueKey="id"
                  placeholder="เลือกปีการศึกษา"
                  searchable
                  clearable
                />
              </div>

              <details className="border rounded-lg px-3 py-2">
                <summary className="cursor-pointer text-sm text-gray-600 select-none">ข้อมูลเพิ่มเติม (ไม่บังคับ)</summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ความจุ (คน)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title="ยืนยันการลบ"
        message={`ต้องการลบห้องเรียน "${deleteConfirm.item?.className}" หรือไม่?`}
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

export default ManageClasses;
