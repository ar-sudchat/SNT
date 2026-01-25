import React, { useState, useEffect, useCallback } from 'react';
import { studentAPI, classAPI, gradeAPI } from '../../services/api';
import { SmartTable, SmartComboBox } from '../../components/ui';

const ManageStudents = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [filterGrade, setFilterGrade] = useState(null);
  const [filterClass, setFilterClass] = useState(null);
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
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [filterClass, filterGrade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        classId: parseInt(formData.classId),
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
      setError(err.response?.data?.error || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('ต้องการลบนักเรียนนี้หรือไม่?')) {
      try {
        await studentAPI.delete(id);
        fetchData();
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถลบได้');
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
        classId: student.classId,
        email: student.email || '',
        status: student.status
      });
    } else {
      setEditingStudent(null);
      setFormData({ studentCode: '', studentNumber: '', name: '', classId: null, email: '', status: 'ACTIVE' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingStudent(null);
    setError('');
  };

  // Table columns configuration
  const columns = [
    {
      key: 'studentNumber',
      label: 'เลขที่',
      sortable: true,
      width: '60px',
      render: (value) => <span className="text-center">{value || '-'}</span>
    },
    {
      key: 'studentCode',
      label: 'รหัส',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'name',
      label: 'ชื่อ-นามสกุล',
      sortable: true
    },
    {
      key: 'class.className',
      label: 'ห้องเรียน',
      sortable: true
    },
    {
      key: 'email',
      label: 'อีเมล',
      render: (value) => value || '-'
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
        <h1 className="text-2xl font-bold text-gray-800">จัดการนักเรียน</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มนักเรียน
        </button>
      </div>

      {/* Error Alert */}
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
      </div>

      {/* Smart Table */}
      <SmartTable
        data={students}
        columns={columns}
        loading={loading}
        title="รายชื่อนักเรียน"
        exportFileName="students"
        searchable
        exportable
        pagination
        pageSize={10}
        emptyMessage="ไม่พบข้อมูลนักเรียน"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingStudent ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียน'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    รหัสนักเรียน <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.studentCode}
                    onChange={(e) => setFormData({ ...formData, studentCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เลขที่
                  </label>
                  <input
                    type="number"
                    value={formData.studentNumber}
                    onChange={(e) => setFormData({ ...formData, studentNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    placeholder="เลขที่ในห้อง"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อ-นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
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
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ACTIVE">ใช้งาน</option>
                  <option value="INACTIVE">ไม่ใช้งาน</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
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

export default ManageStudents;
