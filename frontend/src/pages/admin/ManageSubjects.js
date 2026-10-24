import React, { useState, useEffect, useCallback, useRef } from 'react';
import { subjectAPI, teacherAPI, academicYearAPI, gradeAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';

const toId = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const ManageSubjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
  const [errorAlert, setErrorAlert] = useState({ show: false, message: '' });
  const [filterAcademicYear, setFilterAcademicYear] = useState(null);
  const [filterGrade, setFilterGrade] = useState(null);
  const { validate, reset: resetErrors, errorFor } = useFormErrors();
  const [formData, setFormData] = useState({
    subjectCode: '',
    subjectName: '',
    teacherId: null,
    gradeId: null,
    academicYearId: null,
    description: '',
    status: 'ACTIVE'
  });

  // Track if initial load is done
  const initialLoadDone = useRef(false);

  // Initial load - fetch academic years and grades first
  useEffect(() => {
    const initializeFilters = async () => {
      try {
        const [academicYearRes, gradeRes, teacherRes] = await Promise.all([
          academicYearAPI.getAll(),
          gradeAPI.getAll(),
          teacherAPI.getAll()
        ]);
        setAcademicYears(academicYearRes.data);
        setGrades(gradeRes.data);
        setTeachers(teacherRes.data);

        // Set current academic year as default filter
        const currentYear = academicYearRes.data.find(y => y.isCurrent);
        if (currentYear) {
          setFilterAcademicYear(currentYear.id);
        }
        initialLoadDone.current = true;
      } catch (err) {
        setErrorAlert({ show: true, message: 'ไม่สามารถโหลดข้อมูลได้' });
        initialLoadDone.current = true;
      }
    };
    initializeFilters();
  }, []);

  const fetchData = useCallback(async () => {
    if (!initialLoadDone.current) return;

    try {
      setLoading(true);
      const params = {};
      if (filterAcademicYear) params.academicYearId = filterAcademicYear;
      if (filterGrade) params.gradeId = filterGrade;

      const subjectRes = await subjectAPI.getAll(params);
      setSubjects(subjectRes.data);
    } catch (err) {
      setErrorAlert({ show: true, message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setLoading(false);
    }
  }, [filterAcademicYear, filterGrade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget, [
      { key: 'subjectCode', message: 'กรุณากรอกรหัสวิชา', missing: !String(formData.subjectCode ?? '').trim() },
      { key: 'subjectName', message: 'กรุณากรอกชื่อวิชา', missing: !String(formData.subjectName ?? '').trim() },
      { key: 'teacherId', message: 'กรุณาเลือกครูผู้สอน', missing: toId(formData.teacherId) === null },
    ])) return;
    const teacherId = toId(formData.teacherId);
    if (teacherId === null) {
      setErrorAlert({ show: true, message: 'กรุณาเลือกครูผู้สอน' });
      return;
    }
    try {
      const data = {
        ...formData,
        teacherId,
        gradeId: toId(formData.gradeId),
        academicYearId: toId(formData.academicYearId)
      };
      if (editingSubject) {
        await subjectAPI.update(editingSubject.id, data);
      } else {
        await subjectAPI.create(data);
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
        await subjectAPI.delete(deleteConfirm.item.id);
        fetchData();
      } catch (err) {
        setErrorAlert({ show: true, message: err.response?.data?.error || 'ไม่สามารถลบได้' });
      }
    }
  };

  const openModal = (subject = null) => {
    // Find current academic year for default
    const currentAcademicYear = academicYears.find(ay => ay.isCurrent);

    if (subject) {
      setEditingSubject(subject);
      setFormData({
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        teacherId: toId(subject.teacherId ?? subject.teacher?.id),
        gradeId: toId(subject.gradeId ?? subject.grade?.id),
        academicYearId: toId(subject.academicYearId ?? subject.academicYear?.id),
        description: subject.description || '',
        status: subject.status
      });
    } else {
      setEditingSubject(null);
      setFormData({
        subjectCode: '',
        subjectName: '',
        teacherId: null,
        gradeId: filterGrade || null,
        academicYearId: filterAcademicYear || currentAcademicYear?.id || null,
        description: '',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingSubject(null);
  };

  // Table columns
  const columns = [
    {
      key: 'subjectCode',
      mobileSecondary: true,
      label: 'รหัสวิชา',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'subjectName',
      mobilePrimary: true,
      label: 'ชื่อวิชา',
      sortable: true
    },
    {
      key: 'grade.gradeName',
      mobileSecondary: true,
      label: 'ชั้นเรียน',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: 'teacher.name',
      mobileSecondary: true,
      label: 'ครูผู้สอน',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: '_count.tasks',
      hideOnMobile: true,
      label: 'จำนวนงาน',
      render: (value) => (
        <span className="px-2 py-1 bg-brand-100 text-brand-800 text-xs rounded-full">
          {value || 0} งาน
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

  const activeFilterCount = ((filterAcademicYear) ? 1 : 0) + ((filterGrade) ? 1 : 0);
  const filterControls = (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
        <div className="sm:w-52">
          <label className="block text-sm font-medium text-gray-700 mb-1">ปีการศึกษา</label>
          <SmartComboBox
            options={academicYears}
            value={filterAcademicYear}
            onChange={(val) => {
              setFilterAcademicYear(val);
              setFilterGrade(null);
            }}
            labelKey="year"
            valueKey="id"
            placeholder="ทุกปีการศึกษา"
            clearable
            searchable
          />
        </div>
        <div className="sm:w-52">
          <label className="block text-sm font-medium text-gray-700 mb-1">ชั้นเรียน</label>
          <SmartComboBox
            options={grades}
            value={filterGrade}
            onChange={setFilterGrade}
            labelKey="gradeName"
            valueKey="id"
            placeholder="ทุกชั้น"
            clearable
            searchable
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      <AddFab onClick={() => openModal()} label="เพิ่มวิชา" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">วิชา</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มวิชา
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
        data={subjects}
        columns={columns}
        loading={loading}
        exportFileName="subjects"
        searchable
        exportable
        pagination
        onClearFilters={() => { setFilterAcademicYear(null); setFilterGrade(null); }}
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">เพิ่มวิชา</button>
            
          </>
        }
        emptyMessage="ยังไม่มีวิชา"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingSubject ? 'แก้ไขวิชา' : 'เพิ่มวิชา'}
        onClose={closeModal}
        id="subject-form"
        initialWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {editingSubject && (
              <button
                type="button"
                onClick={() => { const target = editingSubject; closeModal(); handleDeleteClick(target); }}
                className="px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 sm:mr-auto"
              >
                ลบ…
              </button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button type="submit" form="subject-form" className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                  บันทึก
                </button>
          </div>
        }
      >
        <div className="p-4">
          <form id="subject-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              <div data-field="subjectCode">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสวิชา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subjectCode}
                  onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                  {errorFor('subjectCode', !String(formData.subjectCode ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('subjectCode', !String(formData.subjectCode ?? '').trim())}</p>}
              </div>

              <div data-field="subjectName">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อวิชา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                  {errorFor('subjectName', !String(formData.subjectName ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('subjectName', !String(formData.subjectName ?? '').trim())}</p>}
              </div>

              <div data-field="teacherId">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ครูผู้สอน <span className="text-red-500">*</span>
                </label>
                <SmartComboBox
                  options={teachers}
                  value={formData.teacherId}
                  onChange={(val) => setFormData({ ...formData, teacherId: val })}
                  labelKey="name"
                  valueKey="id"
                  placeholder="เลือกครูผู้สอน"
                  searchable
                    error={errorFor('teacherId', toId(formData.teacherId) === null)}
                  />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชั้นเรียน</label>
                <SmartComboBox
                  options={grades}
                  value={formData.gradeId}
                  onChange={(val) => setFormData({ ...formData, gradeId: val })}
                  labelKey="gradeName"
                  valueKey="id"
                  placeholder="เลือกชั้นเรียน"
                  searchable
                  clearable
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ปีการศึกษา</label>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title="ยืนยันการลบ"
        message={`ต้องการลบวิชา "${deleteConfirm.item?.subjectName}" หรือไม่?`}
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

export default ManageSubjects;
