import React, { useState, useEffect, useCallback, useRef } from 'react';
import { taskAPI, subjectAPI, academicYearAPI, gradeAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog } from '../../components/ui';

const ManageTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
  const [filterSubject, setFilterSubject] = useState(null);
  const [filterAcademicYear, setFilterAcademicYear] = useState(null);
  const [filterGrade, setFilterGrade] = useState(null);
  const [formData, setFormData] = useState({
    subjectId: null,
    taskName: '',
    taskNumber: 1,
    description: '',
    deadline: '',
    scoringType: 'SUBMISSION_ONLY',
    maxScore: '',
    status: 'ACTIVE'
  });

  // Track if initial load is done
  const initialLoadDone = useRef(false);

  // Initial load - fetch academic years first to set default
  useEffect(() => {
    const initializeFilters = async () => {
      try {
        const [academicYearRes, gradeRes] = await Promise.all([
          academicYearAPI.getAll(),
          gradeAPI.getAll()
        ]);
        setAcademicYears(academicYearRes.data);
        setGrades(gradeRes.data);

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
      const taskParams = {};
      if (filterSubject) taskParams.subjectId = filterSubject;
      if (filterAcademicYear) taskParams.academicYearId = filterAcademicYear;
      if (filterGrade) taskParams.gradeId = filterGrade;

      const subjectParams = {};
      if (filterAcademicYear) subjectParams.academicYearId = filterAcademicYear;
      if (filterGrade) subjectParams.gradeId = filterGrade;

      const [taskRes, subjectRes] = await Promise.all([
        taskAPI.getAll(taskParams),
        subjectAPI.getAll(subjectParams)
      ]);
      setTasks(taskRes.data);
      setSubjects(subjectRes.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterAcademicYear, filterGrade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        subjectId: parseInt(formData.subjectId),
        taskNumber: parseInt(formData.taskNumber),
        deadline: formData.deadline || null,
        maxScore: formData.scoringType === 'SCORED' && formData.maxScore ? parseFloat(formData.maxScore) : null
      };
      if (editingTask) {
        await taskAPI.update(editingTask.id, data);
      } else {
        await taskAPI.create(data);
      }
      fetchData();
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
        await taskAPI.delete(deleteConfirm.item.id);
        fetchData();
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถลบได้');
      }
    }
  };

  const openModal = (task = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        subjectId: task.subjectId,
        taskName: task.taskName,
        taskNumber: task.taskNumber,
        description: task.description || '',
        deadline: task.deadline ? task.deadline.split('T')[0] : '',
        scoringType: task.scoringType || 'SUBMISSION_ONLY',
        maxScore: task.maxScore || '',
        status: task.status
      });
    } else {
      setEditingTask(null);
      setFormData({ subjectId: null, taskName: '', taskNumber: 1, description: '', deadline: '', scoringType: 'SUBMISSION_ONLY', maxScore: '', status: 'ACTIVE' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTask(null);
    setError('');
  };

  // Table columns
  const columns = [
    {
      key: 'subject.subjectName',
      label: 'วิชา',
      sortable: true
    },
    {
      key: 'subject.grade.gradeName',
      label: 'ชั้น',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: 'subject.academicYear.year',
      label: 'ปีการศึกษา',
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: 'taskName',
      label: 'ชื่องาน',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'taskNumber',
      label: 'หมายเลข',
      sortable: true,
      render: (value) => (
        <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
          #{value}
        </span>
      )
    },
    {
      key: 'deadline',
      label: 'กำหนดส่ง',
      render: (value) => value ? new Date(value).toLocaleDateString('th-TH') : '-'
    },
    {
      key: 'scoringType',
      label: 'ประเภทคะแนน',
      render: (value, row) => {
        const labels = {
          SUBMISSION_ONLY: 'ส่ง/ไม่ส่ง',
          PASS_FAIL: 'ผ่าน/ไม่ผ่าน',
          SCORED: `คะแนน (${row.maxScore || 0})`
        };
        const colors = {
          SUBMISSION_ONLY: 'bg-gray-100 text-gray-700',
          PASS_FAIL: 'bg-blue-100 text-blue-700',
          SCORED: 'bg-purple-100 text-purple-700'
        };
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${colors[value] || colors.SUBMISSION_ONLY}`}>
            {labels[value] || 'ส่ง/ไม่ส่ง'}
          </span>
        );
      }
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
          onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }}
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
        <h1 className="text-2xl font-bold text-gray-800">จัดการงาน</h1>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มงาน
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
                setFilterSubject(null);
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
              onChange={(val) => {
                setFilterGrade(val);
                setFilterSubject(null);
              }}
              labelKey="gradeName"
              valueKey="id"
              placeholder="ทุกชั้น"
              clearable
              searchable
            />
          </div>
          <div className="sm:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">วิชา</label>
            <SmartComboBox
              options={subjects}
              value={filterSubject}
              onChange={setFilterSubject}
              labelKey="subjectName"
              valueKey="id"
              placeholder="ทุกวิชา"
              clearable
              searchable
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <SmartTable
        data={tasks}
        columns={columns}
        loading={loading}
        title="รายการงาน"
        exportFileName="tasks"
        searchable
        exportable
        pagination
        emptyMessage="ไม่พบข้อมูลงาน"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingTask ? 'แก้ไขงาน' : 'เพิ่มงาน'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: วิชา + ชื่องาน */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วิชา <span className="text-red-500">*</span>
                  </label>
                  <SmartComboBox
                    options={subjects}
                    value={formData.subjectId}
                    onChange={(val) => setFormData({ ...formData, subjectId: val })}
                    labelKey="subjectName"
                    valueKey="id"
                    placeholder="เลือกวิชา"
                    searchable
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่องาน <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.taskName}
                    onChange={(e) => setFormData({ ...formData, taskName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Row 2: หมายเลข + กำหนดส่ง + สถานะ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex gap-3">
                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      งานที่ <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.taskNumber}
                      onChange={(e) => setFormData({ ...formData, taskNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
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
              </div>

              {/* Row 3: ประเภทคะแนน + คำอธิบาย (2 columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ประเภทการให้คะแนน <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col gap-1">
                    <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.scoringType === 'SUBMISSION_ONLY' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="scoringType"
                        value="SUBMISSION_ONLY"
                        checked={formData.scoringType === 'SUBMISSION_ONLY'}
                        onChange={(e) => setFormData({ ...formData, scoringType: e.target.value, maxScore: '' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-900">ส่ง/ไม่ส่ง</span>
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.scoringType === 'PASS_FAIL' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="scoringType"
                        value="PASS_FAIL"
                        checked={formData.scoringType === 'PASS_FAIL'}
                        onChange={(e) => setFormData({ ...formData, scoringType: e.target.value, maxScore: '' })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-900">ผ่าน/ไม่ผ่าน</span>
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.scoringType === 'SCORED' ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="scoringType"
                        value="SCORED"
                        checked={formData.scoringType === 'SCORED'}
                        onChange={(e) => setFormData({ ...formData, scoringType: e.target.value })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-900">คิดคะแนน</span>
                      {formData.scoringType === 'SCORED' && (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={formData.maxScore}
                          onChange={(e) => setFormData({ ...formData, maxScore: e.target.value })}
                          className="w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 ml-auto"
                          placeholder="เต็ม"
                          required
                        />
                      )}
                    </label>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 flex-1"
                    placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                  />
                </div>
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title="ยืนยันการลบ"
        message={`ต้องการลบงาน "${deleteConfirm.item?.taskName}" หรือไม่?`}
        confirmText="ลบ"
        cancelText="ยกเลิก"
        type="danger"
      />
    </div>
  );
};

export default ManageTasks;
