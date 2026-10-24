import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { taskAPI, subjectAPI, academicYearAPI, classAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';
import PageHeader from '../../components/ui/PageHeader';

const toId = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const SCORING_LABEL = { SUBMISSION_ONLY: 'ส่ง/ไม่ส่ง', PASS_FAIL: 'ผ่าน/ไม่ผ่าน', SCORED: 'คิดคะแนน' };
const shortDate = (v) => new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

const ManageTasks = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
  const [errorAlert, setErrorAlert] = useState({ show: false, message: '' });
  const [filterSubject, setFilterSubject] = useState(null);
  const [filterAcademicYear, setFilterAcademicYear] = useState(null);
  const [filterGrade, setFilterGrade] = useState(null);
  const { validate, reset: resetErrors, errorFor } = useFormErrors();
  const [formData, setFormData] = useState({
    gradeId: null,
    classIds: [], // ว่าง = ทุกห้องของชั้น
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
        const academicYearRes = await academicYearAPI.getAll();
        setAcademicYears(academicYearRes.data);

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
      const taskParams = {};
      if (filterSubject) taskParams.subjectId = filterSubject;
      if (filterAcademicYear) taskParams.academicYearId = filterAcademicYear;
      if (filterGrade) taskParams.gradeId = filterGrade;

      const subjectParams = {};
      if (filterAcademicYear) subjectParams.academicYearId = filterAcademicYear;

      const [taskRes, subjectRes, classRes] = await Promise.all([
        taskAPI.getAll(taskParams),
        subjectAPI.getAll(subjectParams),
        classAPI.getAll(subjectParams)
      ]);
      setTasks(taskRes.data);
      setSubjects(subjectRes.data);
      setClasses(classRes.data);
    } catch (err) {
      setErrorAlert({ show: true, message: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterAcademicYear, filterGrade]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget, [
      { key: 'subjectId', message: 'กรุณาเลือกวิชา', missing: toId(formData.subjectId) === null },
      { key: 'taskName', message: 'กรุณากรอกชื่องาน', missing: !String(formData.taskName ?? '').trim() },
      { key: 'maxScore', message: 'กรุณากรอกคะแนนเต็ม', missing: formData.scoringType === 'SCORED' && !(parseFloat(formData.maxScore) >= 0 && formData.maxScore !== '') },
    ])) return;
    const subjectId = toId(formData.subjectId);
    if (subjectId === null) {
      setErrorAlert({ show: true, message: 'กรุณาเลือกวิชา' });
      return;
    }
    try {
      const { gradeId, ...rest } = formData; // ชั้นใช้กรองวิชา/ห้องในฟอร์ม ไม่ส่งไปเซิร์ฟเวอร์
      const data = {
        ...rest,
        subjectId,
        // ช่องนี้อยู่ในส่วนที่พับไว้ ถ้าว่างให้ใช้เลขถัดไปอัตโนมัติ
        taskNumber: parseInt(formData.taskNumber) || nextTaskNumber(formData.subjectId),
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
      setErrorAlert({ show: true, message: err.response?.data?.error || 'เกิดข้อผิดพลาด' });
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
        setErrorAlert({ show: true, message: err.response?.data?.error || 'ไม่สามารถลบได้' });
      }
    }
  };

  // เลขงานถัดไปของวิชา (คำนวณจากงานที่โหลดมา)
  const nextTaskNumber = (subjectId) => {
    if (!subjectId) return 1;
    const nums = tasks.filter(t => t.subjectId === subjectId).map(t => t.taskNumber || 0);
    return nums.length ? Math.max(...nums) + 1 : 1;
  };

  const openModal = (task = null) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        gradeId: toId(task.subject?.gradeId),
        classIds: (task.rooms || []).map(r => r.classId),
        subjectId: toId(task.subjectId ?? task.subject?.id),
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
      const preSubject = subjects.find(sj => sj.id === toId(filterSubject));
      setFormData({ gradeId: toId(preSubject?.gradeId ?? filterGrade), classIds: [], subjectId: toId(filterSubject), taskName: '', taskNumber: nextTaskNumber(toId(filterSubject)), description: '', deadline: '', scoringType: 'SUBMISSION_ONLY', maxScore: '', status: 'ACTIVE' });
    }
    setShowModal(true);
  };

  // รับร่างงานจากผู้ช่วย AI (ส่งมาทาง router state) แล้วเปิดฟอร์มสร้างงานพร้อมค่าที่กรอกไว้
  useEffect(() => {
    const draft = location.state?.aiDraft;
    if (!draft) return;
    const validTypes = ['SUBMISSION_ONLY', 'PASS_FAIL', 'SCORED'];
    const scoringType = validTypes.includes(draft.scoringType) ? draft.scoringType : 'SUBMISSION_ONLY';
    setEditingTask(null);
    setFormData({
      gradeId: null,
      classIds: [],
      subjectId: null,
      taskName: draft.taskName || '',
      taskNumber: 1,
      description: draft.description || '',
      deadline: '',
      scoringType,
      maxScore: scoringType === 'SCORED' && draft.maxScore ? draft.maxScore : '',
      status: 'ACTIVE'
    });
    setShowModal(true);
    // ล้าง state เพื่อไม่ให้เปิดซ้ำเมื่อรีเฟรชหน้า
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingTask(null);
  };

  // ชั้นจากวิชาและห้องของปีที่เลือก · วิชาและห้องในฟอร์มกรองตามชั้น
  const grades = (() => {
    const map = new Map();
    [...subjects.map(sj => sj.grade), ...classes.map(c => c.grade)].forEach(g => { if (g && !map.has(g.id)) map.set(g.id, g); });
    return [...map.values()].sort((a, b) => a.gradeName.localeCompare(b.gradeName, 'th'));
  })();
  const formSubjects = formData.gradeId ? subjects.filter(sj => sj.gradeId === formData.gradeId) : subjects;
  const formClasses = formData.gradeId ? classes.filter(c => c.gradeId === formData.gradeId && c.status !== 'INACTIVE') : [];
  const toggleRoom = (id) => setFormData(f => {
    const next = f.classIds.includes(id) ? f.classIds.filter(x => x !== id) : [...f.classIds, id];
    return { ...f, classIds: next.length === formClasses.length ? [] : next }; // ครบทุกห้อง = ทุกห้อง
  });
  const roomLabel = (task) => (task.rooms && task.rooms.length
    ? task.rooms.map(r => r.class?.className).filter(Boolean).sort((a, b) => a.localeCompare(b, 'th')).join(', ')
    : 'ทุกห้อง');

  // Table columns
  const columns = [
    {
      key: 'subject.subjectName',
      mobileSecondary: true,
      label: 'วิชา',
      sortable: true
    },
    {
      key: 'taskName',
      mobilePrimary: true,
      label: 'ชื่องาน',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'rooms',
      mobileSecondary: true,
      label: 'ห้อง',
      render: (_, row) => <span className={row.rooms?.length ? 'text-gray-900' : 'text-gray-500'}>{roomLabel(row)}</span>,
      exportValue: (row) => roomLabel(row)
    },
    {
      key: 'taskNumber',
      hideOnMobile: true,
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
      mobileSecondary: true,
      label: 'กำหนดส่ง',
      render: (value) => (value ? (
        <>
          <span className="md:hidden">ส่ง {shortDate(value)}</span>
          <span className="hidden md:inline">{new Date(value).toLocaleDateString('th-TH')}</span>
        </>
      ) : '-')
    },
    {
      key: 'scoringType',
      mobileSecondary: true,
      label: 'การให้คะแนน',
      render: (value, row) => (SCORING_LABEL[value] || SCORING_LABEL.SUBMISSION_ONLY) + (value === 'SCORED' && row.maxScore ? ` (${row.maxScore})` : '')
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

  const activeFilterCount = ((filterSubject) ? 1 : 0) + ((filterAcademicYear) ? 1 : 0) + ((filterGrade) ? 1 : 0);
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
              setFilterSubject(null);
            }}
            labelKey="year"
            valueKey="id"
            placeholder="ทุกปีการศึกษา"
            clearable
            searchable
          />
        </div>
        <div className="sm:w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">ชั้น</label>
          <SmartComboBox
            options={grades}
            value={filterGrade}
            onChange={(val) => { setFilterGrade(val); setFilterSubject(null); }}
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
            options={filterGrade ? subjects.filter(sj => sj.gradeId === filterGrade) : subjects}
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
    </>
  );

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      <PageHeader title="งาน">
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มงาน
        </button>
      </PageHeader>
      <AddFab onClick={() => openModal()} label="เพิ่มงาน" />

      {/* Filter: จอ sm ขึ้นไปแสดงในแถว · มือถือใช้ปุ่ม 'ตัวกรอง' ใน SmartTable */}
      <div className="hidden sm:block bg-white rounded-lg shadow p-4">
        {filterControls}
      </div>

      {/* Table */}
      <SmartTable
        filters={filterControls}
        activeFilterCount={activeFilterCount}
        data={tasks}
        columns={columns}
        loading={loading}
        exportFileName="tasks"
        searchable
        exportable
        pagination
        onClearFilters={() => { setFilterSubject(null); setFilterAcademicYear(null); setFilterGrade(null); }}
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">เพิ่มงาน</button>
            
          </>
        }
        emptyMessage="ยังไม่มีงาน"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingTask ? 'แก้ไขงาน' : 'เพิ่มงาน'}
        onClose={closeModal}
        id="task-form"
        initialWidth="max-w-3xl"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {editingTask && (
              <button
                type="button"
                onClick={() => { const target = editingTask; closeModal(); handleDeleteClick(target); }}
                className="px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 sm:mr-auto"
              >
                ลบ…
              </button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button type="submit" form="task-form" className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                  บันทึก
                </button>
          </div>
        }
      >
        <div className="p-4">
          <form id="task-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Row 1: ชั้น → วิชา (งานแยกตามชั้น) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชั้น</label>
                  <SmartComboBox
                    options={grades}
                    value={formData.gradeId}
                    onChange={(val) => setFormData(f => {
                      const keep = subjects.find(sj => sj.id === f.subjectId && sj.gradeId === val);
                      return { ...f, gradeId: toId(val), classIds: [], subjectId: keep ? f.subjectId : null };
                    })}
                    labelKey="gradeName"
                    valueKey="id"
                    placeholder="เลือกชั้น"
                    searchable
                    clearable
                    ariaLabel="ชั้น"
                  />
                </div>
                <div data-field="subjectId">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วิชา <span className="text-red-500">*</span>
                  </label>
                  <SmartComboBox
                    options={formSubjects}
                    value={formData.subjectId}
                    onChange={(val) => setFormData(f => {
                      const sj = subjects.find(x => x.id === toId(val));
                      const gradeId = sj?.gradeId ?? f.gradeId;
                      return { ...f, subjectId: val, gradeId, classIds: gradeId === f.gradeId ? f.classIds : [], taskNumber: editingTask ? f.taskNumber : nextTaskNumber(val) };
                    })}
                    labelKey="subjectName"
                    valueKey="id"
                    placeholder="เลือกวิชา"
                    searchable
                    error={errorFor('subjectId', toId(formData.subjectId) === null)}
                  />
                </div>
              </div>

              {/* ห้องที่ได้งานนี้: เลือกได้หลายห้องในชั้นเดียวกัน */}
              {formClasses.length > 0 && (
                <div role="group" aria-label="ห้องที่ได้งานนี้">
                  <p className="block text-sm font-medium text-gray-700 mb-1">ห้องที่ได้งานนี้</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={formData.classIds.length === 0}
                      onClick={() => setFormData(f => ({ ...f, classIds: [] }))}
                      className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${formData.classIds.length === 0 ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      ทุกห้อง ({formClasses.length})
                    </button>
                    {formClasses.map(c => {
                      const on = formData.classIds.length === 0 || formData.classIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={formData.classIds.includes(c.id)}
                          onClick={() => (formData.classIds.length === 0 ? setFormData(f => ({ ...f, classIds: [c.id] })) : toggleRoom(c.id))}
                          className={`min-h-[44px] rounded-full border px-4 text-sm ${on ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                          {on ? '✓ ' : ''}{c.className}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.classIds.length === 0 ? 'ทุกห้องของชั้นนี้ได้งาน รวมห้องที่เพิ่มทีหลัง · แตะชื่อห้องเพื่อเลือกเฉพาะห้อง' : `ลงงานให้ ${formData.classIds.length} ห้อง · แตะเพื่อเพิ่มหรือเอาออก`}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div data-field="taskName">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่องาน <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.taskName}
                    onChange={(e) => setFormData({ ...formData, taskName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                  {errorFor('taskName', !String(formData.taskName ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('taskName', !String(formData.taskName ?? '').trim())}</p>}
                </div>
              </div>

              {/* กำหนดส่ง + ประเภทคะแนน */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ประเภทการให้คะแนน <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-col gap-1">
                    <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.scoringType === 'SUBMISSION_ONLY' ? 'border-brand-500 bg-brand-50' : 'hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="scoringType"
                        value="SUBMISSION_ONLY"
                        checked={formData.scoringType === 'SUBMISSION_ONLY'}
                        onChange={(e) => setFormData({ ...formData, scoringType: e.target.value, maxScore: '' })}
                        className="w-4 h-4 text-brand-600"
                      />
                      <span className="text-sm text-gray-900">ส่ง/ไม่ส่ง</span>
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.scoringType === 'PASS_FAIL' ? 'border-brand-500 bg-brand-50' : 'hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="scoringType"
                        value="PASS_FAIL"
                        checked={formData.scoringType === 'PASS_FAIL'}
                        onChange={(e) => setFormData({ ...formData, scoringType: e.target.value, maxScore: '' })}
                        className="w-4 h-4 text-brand-600"
                      />
                      <span className="text-sm text-gray-900">ผ่าน/ไม่ผ่าน</span>
                    </label>
                    <label className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.scoringType === 'SCORED' ? 'border-brand-500 bg-brand-50' : 'hover:bg-gray-50'
                    }`}>
                      <input
                        type="radio"
                        name="scoringType"
                        value="SCORED"
                        checked={formData.scoringType === 'SCORED'}
                        onChange={(e) => setFormData({ ...formData, scoringType: e.target.value })}
                        className="w-4 h-4 text-brand-600"
                      />
                      <span className="text-sm text-gray-900">คิดคะแนน</span>
                      {formData.scoringType === 'SCORED' && (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={formData.maxScore}
                          onChange={(e) => setFormData({ ...formData, maxScore: e.target.value })}
                          data-field="maxScore"
                          aria-label="คะแนนเต็ม"
                          className={`w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500 ml-auto ${errorFor('maxScore', !formData.maxScore) ? 'border-red-500' : ''}`}
                          placeholder="เต็ม"
                        />
                      )}
                    </label>
                  </div>
                  {errorFor('maxScore', !formData.maxScore) && <p className="mt-1 text-sm text-red-500">{errorFor('maxScore', !formData.maxScore)}</p>}
                </div>
              </div>

              <details className="border rounded-lg px-3 py-2" open={!!formData.description}>
                <summary className="cursor-pointer text-sm text-gray-600 select-none">ข้อมูลเพิ่มเติม (งานที่ {formData.taskNumber} · {formData.status === 'ACTIVE' ? 'ใช้งาน' : 'ไม่ใช้งาน'})</summary>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">งานที่</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.taskNumber}
                      onChange={(e) => setFormData({ ...formData, taskNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                    <SmartComboBox
                      options={[{ value: 'ACTIVE', label: 'ใช้งาน' }, { value: 'INACTIVE', label: 'ไม่ใช้งาน' }]}
                      value={formData.status}
                      onChange={(v) => v && setFormData({ ...formData, status: v })}
                      searchable={false}
                      clearable={false}
                      ariaLabel="สถานะ"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                      rows={2}
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
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title="ยืนยันการลบ"
        message={`ต้องการลบงาน "${deleteConfirm.item?.taskName}" หรือไม่?`}
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

export default ManageTasks;
