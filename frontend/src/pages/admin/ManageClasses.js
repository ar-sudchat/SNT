import React, { useState, useEffect, useCallback } from 'react';
import { classAPI, gradeAPI, teacherAPI, academicYearAPI } from '../../services/api';
import { SmartTable, SmartComboBox } from '../../components/ui';

const ManageClasses = () => {
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [filterGrade, setFilterGrade] = useState(null);
  const [filterAcademicYear, setFilterAcademicYear] = useState(null);
  const [formData, setFormData] = useState({
    className: '',
    gradeId: null,
    teacherId: null,
    academicYearId: null,
    capacity: 40,
    description: '',
    status: 'ACTIVE'
  });

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
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [filterGrade, filterAcademicYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        gradeId: parseInt(formData.gradeId),
        teacherId: formData.teacherId ? parseInt(formData.teacherId) : null,
        academicYearId: formData.academicYearId ? parseInt(formData.academicYearId) : null,
        capacity: parseInt(formData.capacity)
      };
      if (editingClass) {
        await classAPI.update(editingClass.id, data);
      } else {
        await classAPI.create(data);
      }
      fetchData();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('ต้องการลบห้องเรียนนี้หรือไม่?')) {
      try {
        await classAPI.delete(id);
        fetchData();
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถลบได้');
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
        gradeId: classData.gradeId,
        teacherId: classData.teacherId,
        academicYearId: classData.academicYearId,
        capacity: classData.capacity,
        description: classData.description || '',
        status: classData.status
      });
    } else {
      setEditingClass(null);
      setFormData({
        className: '',
        gradeId: null,
        teacherId: null,
        academicYearId: currentAcademicYear?.id || null,
        capacity: 40,
        description: '',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingClass(null);
    setError('');
  };

  // Table columns
  const columns = [
    {
      key: 'className',
      label: 'ห้องเรียน',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'grade.gradeName',
      label: 'ชั้นปี',
      sortable: true
    },
    {
      key: 'homeTeacher.name',
      label: 'ครูประจำชั้น',
      render: (value) => value || '-'
    },
    {
      key: 'academicYear.year',
      label: 'ปีการศึกษา',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: '_count.students',
      label: 'นักเรียน',
      render: (value, row) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
          {value || 0}/{row.capacity}
        </span>
      )
    },
    {
      key: 'status',
      label: 'สถานะ',
      render: (value) => (
        <span className={`px-2 py-1 text-xs rounded-full ${
          value === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value === 'ACTIVE' ? 'ใช้งาน' : 'ไม่ใช้งาน'}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'จัดการ',
      exportable: false,
      render: (_, row) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
          className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
        >
          ลบ
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">จัดการห้องเรียน</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มห้องเรียน
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

      {/* Filter */}
      <div className="bg-white rounded-lg shadow p-4">
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
      </div>

      {/* Table */}
      <SmartTable
        data={classes}
        columns={columns}
        loading={loading}
        title="รายการห้องเรียน"
        exportFileName="classes"
        searchable
        exportable
        pagination
        emptyMessage="ไม่พบข้อมูลห้องเรียน"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingClass ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อห้องเรียน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.className}
                  onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
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
                  required
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ความจุ (คน) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ACTIVE">ใช้งาน</option>
                  <option value="INACTIVE">ไม่ใช้งาน</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClasses;
