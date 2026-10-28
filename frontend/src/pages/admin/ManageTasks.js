import { t, dateLocale } from '../../i18n';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { taskAPI, subjectAPI, academicYearAPI, classAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';
import QuickFilterBar from '../../components/ui/QuickFilterBar';
import PageHeader from '../../components/ui/PageHeader';

const toId = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const SCORING_LABEL = { SUBMISSION_ONLY: 'ส่ง/ไม่ส่ง', PASS_FAIL: 'ผ่าน/ไม่ผ่าน', SCORED: 'คิดคะแนน' };
const shortDate = (v) => new Date(v).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: '2-digit' });

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
  const [filterRoom, setFilterRoom] = useState(null); // กรองในเครื่อง: ห้อง
  const [filterDue, setFilterDue] = useState(null); // กรองในเครื่อง: upcoming | overdue
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
        setErrorAlert({ show: true, message: t('ไม่สามารถโหลดข้อมูลได้') });
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
      setErrorAlert({ show: true, message: t('ไม่สามารถโหลดข้อมูลได้') });
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
      { key: 'subjectId', message: t('กรุณาเลือกวิชา'), missing: toId(formData.subjectId) === null },
      { key: 'taskName', message: t('กรุณากรอกชื่องาน'), missing: !String(formData.taskName ?? '').trim() },
      { key: 'maxScore', message: t('กรุณากรอกคะแนนเต็ม'), missing: formData.scoringType === 'SCORED' && !(parseFloat(formData.maxScore) >= 0 && formData.maxScore !== '') },
    ])) return;
    const subjectId = toId(formData.subjectId);
    if (subjectId === null) {
      setErrorAlert({ show: true, message: t('กรุณาเลือกวิชา') });
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
      setErrorAlert({ show: true, message: err.response?.data?.error || t('เกิดข้อผิดพลาด') });
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
        setErrorAlert({ show: true, message: err.response?.data?.error || t('ไม่สามารถลบได้') });
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
    : t('ทุกห้อง'));

  // Table columns
  const columns = [
    {
      key: 'subject.subjectName',
      mobileSecondary: true,
      label: t('วิชา'),
      sortable: true
    },
    {
      key: 'taskName',
      mobilePrimary: true,
      label: t('ชื่องาน'),
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'rooms',
      mobileSecondary: true,
      label: t('ห้อง'),
      render: (_, row) => {
        const names = row.rooms?.length ? roomLabel(row).split(', ') : null;
        if (!names) return <span className="text-gray-600">{roomLabel(row)}</span>;
        const full = names.join(', ');
        return (
          <span className="font-medium text-gray-900" title={full}>
            <span className="md:hidden">{names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : full}</span>
            <span className="hidden md:inline">{full}</span>
          </span>
        );
      },
      exportValue: (row) => roomLabel(row)
    },
    {
      key: 'taskNumber',
      hideOnMobile: true,
      label: t('หมายเลข'),
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
      label: t('กำหนดส่ง'),
      render: (value, row) => (value ? (
        <span className={dueOf(row) === 'overdue' ? 'font-medium text-red-700' : 'text-gray-900'}>
          <span className="md:hidden">{t("ส่ง {value1}", { value1: shortDate(value) })}{dueOf(row) === 'overdue' ? ` · ${t('เลยกำหนด')}` : ''}</span>
          <span className="hidden md:inline">{new Date(value).toLocaleDateString(dateLocale())}</span>
        </span>
      ) : <span className="text-gray-500">{t('ไม่มีกำหนดส่ง')}</span>)
    },
    {
      key: 'scoringType',
      mobileSecondary: true,
      label: t('การให้คะแนน'),
      render: (value, row) => t(SCORING_LABEL[value] || SCORING_LABEL.SUBMISSION_ONLY) + (value === 'SCORED' && row.maxScore ? ` (${row.maxScore})` : '')
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

  // ตัวกรองด่วน (ชิป): วิชา → ห้อง → กำหนดส่ง · ห้อง/กำหนดส่งกรองในเครื่องจากงานที่โหลดมา
  const subjectGrade = (task) => task.subject?.gradeId ?? subjects.find(sj => sj.id === task.subjectId)?.gradeId;
  const inRoom = (task, room) => (task.rooms && task.rooms.length ? task.rooms.some(r => r.classId === room.id) : subjectGrade(task) === room.gradeId);
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const dueOf = (task) => (!task.deadline ? null : new Date(task.deadline).getTime() < startOfToday ? 'overdue' : 'upcoming');
  // เรียง: ใกล้ถึงกำหนดก่อน → เลยกำหนด (ล่าสุดก่อน) → ไม่มีกำหนดส่ง
  const dueRank = (task) => { const d = dueOf(task); return d === 'upcoming' ? 0 : d === 'overdue' ? 1 : 2; };
  const sortByDue = (list) => [...list].sort((a, b) => {
    const ra = dueRank(a); const rb = dueRank(b);
    if (ra !== rb) return ra - rb;
    const da = a.deadline ? new Date(a.deadline).getTime() : 0;
    const db = b.deadline ? new Date(b.deadline).getTime() : 0;
    if (ra === 0) return da - db;
    if (ra === 1) return db - da;
    return (a.taskNumber || 0) - (b.taskNumber || 0);
  });
  const roomScope = filterGrade ? classes.filter(c => c.gradeId === filterGrade)
    : filterSubject ? classes.filter(c => c.gradeId === subjects.find(sj => sj.id === filterSubject)?.gradeId) : classes;
  const byRoom = (list) => (filterRoom ? list.filter(tk => { const room = classes.find(c => c.id === filterRoom); return room ? inRoom(tk, room) : true; }) : list);
  const byDue = (list) => (filterDue ? list.filter(tk => dueOf(tk) === filterDue) : list);
  const visibleTasks = sortByDue(byDue(byRoom(tasks)));
  const subjectChips = subjects.filter(sj => !filterGrade || sj.gradeId === filterGrade)
    .map(sj => ({ value: sj.id, label: sj.subjectName }));
  const roomChips = [...roomScope].sort((a, b) => a.className.localeCompare(b.className, 'th'))
    .map(c => ({ value: c.id, label: c.className, count: byDue(tasks).filter(tk => inRoom(tk, c)).length }));
  const dueChips = [
    { value: 'upcoming', label: t('ยังไม่ถึงกำหนด'), count: byRoom(tasks).filter(tk => dueOf(tk) === 'upcoming').length },
    { value: 'overdue', label: t('เลยกำหนดแล้ว'), count: byRoom(tasks).filter(tk => dueOf(tk) === 'overdue').length }
  ];
  const currentYearId = academicYears.find(y => y.isCurrent)?.id ?? null;
  const clearAll = () => { setFilterSubject(null); setFilterAcademicYear(currentYearId); setFilterGrade(null); setFilterRoom(null); setFilterDue(null); };

  // ปีการศึกษาปัจจุบันเป็นค่าเริ่มต้น ไม่นับเป็นตัวกรองที่ผู้ใช้เปิดเอง
  const activeFilterCount = ((filterSubject) ? 1 : 0) + ((filterAcademicYear && filterAcademicYear !== currentYearId) ? 1 : 0) + ((filterGrade) ? 1 : 0) + ((filterRoom) ? 1 : 0) + ((filterDue) ? 1 : 0);
  const roomName = classes.find(c => c.id === filterRoom)?.className;
  const subjectName = subjects.find(sj => sj.id === filterSubject)?.subjectName;
  const dueName = filterDue === 'upcoming' ? t('ยังไม่ถึงกำหนด') : filterDue === 'overdue' ? t('เลยกำหนดแล้ว') : null;
  const gradeName = grades.find(g => g.id === filterGrade)?.gradeName;
  const filteredEmpty = !loading && visibleTasks.length === 0 && activeFilterCount > 0;
  const filterControls = (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
        <div className="sm:w-52">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("ปีการศึกษา")}</label>
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
            placeholder={t("ทุกปีการศึกษา")}
            clearable
            searchable
          />
        </div>
        <div className="sm:w-44">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชั้น")}</label>
          <SmartComboBox
            options={grades}
            value={filterGrade}
            onChange={(val) => { setFilterGrade(val); setFilterSubject(null); setFilterRoom(null); }}
            labelKey="gradeName"
            valueKey="id"
            placeholder={t("ทุกชั้น")}
            clearable
            searchable
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      <PageHeader title={t("งาน")}>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>{t("เพิ่มงาน")}</button>
      </PageHeader>
      <AddFab onClick={() => openModal()} label={t("เพิ่มงาน")} />

      {/* Filter: จอ sm ขึ้นไปแสดงในแถว · มือถือใช้ปุ่ม 'ตัวกรอง' ใน SmartTable */}
      <div className="hidden sm:block bg-white rounded-lg shadow p-4">
        {filterControls}
      </div>

      {/* ตัวกรองด่วน: แสดงนอกปุ่ม 'ตัวกรอง' ทุกขนาดจอ */}
      <div className="space-y-0.5 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100">
        <QuickFilterBar label={t('วิชา')} allLabel={t('ทุกวิชา')} options={subjectChips} value={filterSubject} onChange={(v) => { setFilterSubject(v); setFilterRoom(null); }} />
        <QuickFilterBar label={t('ห้อง')} allLabel={t('ทุกห้อง')} options={roomChips} value={filterRoom} onChange={setFilterRoom} />
        <QuickFilterBar label={t('กำหนดส่ง')} allLabel={t('ทั้งหมด')} options={dueChips} value={filterDue} onChange={setFilterDue} />
      </div>

      {/* สรุปตัวกรองที่เปิดอยู่ + ล้างทั้งหมด (จำนวนที่พบแสดงในหัวตารางอยู่แล้ว) */}
      {!loading && activeFilterCount > 0 && (
        <div className="flex min-h-[44px] items-center justify-between gap-3 px-1">
          <p className="min-w-0 text-sm text-gray-700">
            <span className="text-gray-600">{t('กรองอยู่')}: </span>
            <span className="font-medium text-gray-900">{[gradeName, subjectName, roomName, dueName].filter(Boolean).join(' · ') || t('ตามตัวกรอง')}</span>
          </p>
          <button type="button" onClick={clearAll} className="min-h-[44px] shrink-0 px-2 text-sm font-medium text-brand-700 hover:text-brand-800">{t('ล้างตัวกรอง')}</button>
        </div>
      )}

      {filteredEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-lg bg-white px-4 py-10 text-center shadow">
          <p className="text-gray-800">
            {roomName
              ? t('ไม่พบงานของห้อง {value1}', { value1: roomName }) + (dueName ? ` (${dueName})` : '')
              : t('ไม่พบงานที่ตรงกับตัวกรอง')}
          </p>
          <button type="button" onClick={clearAll} className="min-h-[44px] rounded-lg border border-brand-600 px-5 text-sm font-medium text-brand-700 hover:bg-brand-50">{t('ล้างตัวกรอง')}</button>
        </div>
      ) : (
      <SmartTable
        filters={filterControls}
        activeFilterCount={activeFilterCount}
        data={visibleTasks}
        columns={columns}
        loading={loading}
        exportFileName="tasks"
        searchable
        exportable
        pagination
        onClearFilters={clearAll}
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t("เพิ่มงาน")}</button>
            
          </>
        }
        emptyMessage={t("ยังไม่มีงาน")}
        onRowClick={(row) => openModal(row)}
      />
      )}

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingTask ? t('แก้ไขงาน') : t('เพิ่มงาน')}
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
              >{t("ลบ…")}</button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">{t("ยกเลิก")}</button>
                <button type="submit" form="task-form" className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t("บันทึก")}</button>
          </div>
        }
      >
        <div className="p-4">
          <form id="task-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Row 1: ชั้น → วิชา (งานแยกตามชั้น) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชั้น")}</label>
                  <SmartComboBox
                    options={grades}
                    value={formData.gradeId}
                    onChange={(val) => setFormData(f => {
                      const keep = subjects.find(sj => sj.id === f.subjectId && sj.gradeId === val);
                      return { ...f, gradeId: toId(val), classIds: [], subjectId: keep ? f.subjectId : null };
                    })}
                    labelKey="gradeName"
                    valueKey="id"
                    placeholder={t("เลือกชั้น")}
                    searchable
                    clearable
                    ariaLabel={t("ชั้น")}
                  />
                </div>
                <div data-field="subjectId">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("วิชา ")}<span className="text-red-500">*</span>
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
                    placeholder={t("เลือกวิชา")}
                    searchable
                    error={errorFor('subjectId', toId(formData.subjectId) === null)}
                  />
                </div>
              </div>

              {/* ห้องที่ได้งานนี้: เลือกได้หลายห้องในชั้นเดียวกัน */}
              {formClasses.length > 0 && (
                <div role="group" aria-label={t("ห้องที่ได้งานนี้")}>
                  <p className="block text-sm font-medium text-gray-700 mb-1">{t("ห้องที่ได้งานนี้")}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={formData.classIds.length === 0}
                      onClick={() => setFormData(f => ({ ...f, classIds: [] }))}
                      className={`min-h-[44px] rounded-full border px-4 text-sm font-medium ${formData.classIds.length === 0 ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
                    >{t("ทุกห้อง ({value1})", { value1: formClasses.length })}</button>
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
                    {formData.classIds.length === 0 ? t('ทุกห้องของชั้นนี้ได้งาน รวมห้องที่เพิ่มทีหลัง · แตะชื่อห้องเพื่อเลือกเฉพาะห้อง') : t("ลงงานให้ {value1} ห้อง · แตะเพื่อเพิ่มหรือเอาออก", { value1: formData.classIds.length })}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div data-field="taskName">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชื่องาน ")}<span className="text-red-500">*</span>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("กำหนดส่ง")}</label>
                  <input
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("ประเภทการให้คะแนน ")}<span className="text-red-500">*</span>
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
                      <span className="text-sm text-gray-900">{t("ส่ง/ไม่ส่ง")}</span>
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
                      <span className="text-sm text-gray-900">{t("ผ่าน/ไม่ผ่าน")}</span>
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
                      <span className="text-sm text-gray-900">{t("คิดคะแนน")}</span>
                      {formData.scoringType === 'SCORED' && (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={formData.maxScore}
                          onChange={(e) => setFormData({ ...formData, maxScore: e.target.value })}
                          data-field="maxScore"
                          aria-label={t("คะแนนเต็ม")}
                          className={`w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-brand-500 ml-auto ${errorFor('maxScore', !formData.maxScore) ? 'border-red-500' : ''}`}
                          placeholder={t("เต็ม")}
                        />
                      )}
                    </label>
                  </div>
                  {errorFor('maxScore', !formData.maxScore) && <p className="mt-1 text-sm text-red-500">{errorFor('maxScore', !formData.maxScore)}</p>}
                </div>
              </div>

              <details className="border rounded-lg px-3 py-2" open={!!formData.description}>
                <summary className="cursor-pointer text-sm text-gray-600 select-none">{t("ข้อมูลเพิ่มเติม (งานที่ {value1} · {value2})", { value1: formData.taskNumber, value2: formData.status === 'ACTIVE' ? t('ใช้งาน') : t('ไม่ใช้งาน') })}</summary>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("งานที่")}</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.taskNumber}
                      onChange={(e) => setFormData({ ...formData, taskNumber: e.target.value })}
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
                  <div className="sm:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("คำอธิบาย")}</label>
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
        title={t("ยืนยันการลบ")}
        message={t("ต้องการลบงาน \"{value1}\" หรือไม่?", { value1: deleteConfirm.item?.taskName })}
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

export default ManageTasks;
