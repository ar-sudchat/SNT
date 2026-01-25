import React, { useState, useEffect, useCallback, useRef } from 'react';
import { subjectAPI, teacherAPI, academicYearAPI, gradeAPI } from '../../services/api';
import { SmartTable, SmartComboBox } from '../../components/ui';

const ManageSubjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [filterAcademicYear, setFilterAcademicYear] = useState(null);
  const [filterGrade, setFilterGrade] = useState(null);
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
        setError('ไม่สามารถโหลดข้อมูลได้');
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
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [filterAcademicYear, filterGrade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        teacherId: parseInt(formData.teacherId),
        gradeId: formData.gradeId ? parseInt(formData.gradeId) : null,
        academicYearId: formData.academicYearId ? parseInt(formData.academicYearId) : null
      };
      if (editingSubject) {
        await subjectAPI.update(editingSubject.id, data);
      } else {
        await subjectAPI.create(data);
      }
      fetchData();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('ต้องการลบวิชานี้หรือไม่?')) {
      try {
        await subjectAPI.delete(id);
        fetchData();
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถลบได้');
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
        teacherId: subject.teacherId,
        gradeId: subject.gradeId,
        academicYearId: subject.academicYearId,
        description: subject.description || '',
        status: subject.status
      });
    } else {
      setEditingSubject(null);
      setFormData({
        subjectCode: '',
        subjectName: '',
        teacherId: null,
        gradeId: null,
        academicYearId: currentAcademicYear?.id || null,
        description: '',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSubject(null);
    setError('');
  };

  // Table columns
  const columns = [
    {
      key: 'subjectCode',
      label: 'รหัสวิชา',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'subjectName',
      label: 'ชื่อวิชา',
      sortable: true
    },
    {
      key: 'grade.gradeName',
      label: 'ชั้นเรียน',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: 'teacher.name',
      label: 'ครูผู้สอน',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: 'academicYear.year',
      label: 'ปีการศึกษา',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: '_count.tasks',
      label: 'จำนวนงาน',
      render: (value) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
          {value || 0} งาน
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
        <h1 className="text-2xl font-bold text-gray-800">จัดการวิชา</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มวิชา
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
      </div>

      {/* Table */}
      <SmartTable
        data={subjects}
        columns={columns}
        loading={loading}
        title="รายการวิชา"
        exportFileName="subjects"
        searchable
        exportable
        pagination
        emptyMessage="ไม่พบข้อมูลวิชา"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingSubject ? 'แก้ไขวิชา' : 'เพิ่มวิชา'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  รหัสวิชา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subjectCode}
                  onChange={(e) => setFormData({ ...formData, subjectCode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อวิชา <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subjectName}
                  onChange={(e) => setFormData({ ...formData, subjectName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
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
                  required
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows="3"
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

export default ManageSubjects;
