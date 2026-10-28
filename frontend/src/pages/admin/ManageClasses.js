import { t } from '../../i18n';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { classAPI, gradeAPI, teacherAPI, academicYearAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';
import QuickFilterBar from '../../components/ui/QuickFilterBar';
import PageHeader from '../../components/ui/PageHeader';
import { useDialog } from '../../components/ui/DialogProvider';

const toId = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const ManageClasses = () => {
  const dialog = useDialog();
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
  // Repeated-pattern helpers: all classes (unfiltered) to number the next room, and whether the name was auto-filled.
  const [allClasses, setAllClasses] = useState([]);
  const autoName = useRef(false);
  // Bulk add: several grades at once, e.g. ป.4 x 3 and ป.5 x 2.
  const [bulk, setBulk] = useState({ on: false, rows: [{ gradeId: null, count: 3 }] });
  const [creating, setCreating] = useState(false);
  const squash = (v) => String(v || '').replace(/[\s.]/g, '');
  const gradeById = (id) => grades.find(g => g.id === toId(id));
  // Room numbers already used for a grade, e.g. "ป.4" -> [1, 2].
  const roomsOf = (gradeName) => allClasses
    .map(c => String(c.className || '').match(/^(.*)\/(\d+)$/))
    .filter(m => m && squash(m[1]) === squash(gradeName))
    .map(m => Number(m[2]));
  const nextRoomName = (gradeName) => `${gradeName}/${Math.max(0, ...roomsOf(gradeName)) + 1}`;
  // Names a bulk add would create (rooms 1..count that do not exist yet).
  const bulkNames = (gradeName, count) => {
    const used = new Set(roomsOf(gradeName));
    return Array.from({ length: Math.max(0, Math.min(20, count)) }, (_, i) => i + 1).filter(n => !used.has(n)).map(n => `${gradeName}/${n}`);
  };
  // Preview of the whole bulk form: every wanted room, flagged when it already exists.
  const bulkPlan = () => {
    const seen = new Map();
    bulk.rows.forEach((row) => {
      const grade = gradeById(row.gradeId);
      if (!grade) return;
      const used = new Set(roomsOf(grade.gradeName));
      const count = Math.max(0, Math.min(20, Number(row.count) || 0));
      for (let n = 1; n <= count; n += 1) {
        const className = `${grade.gradeName}/${n}`;
        if (!seen.has(className)) seen.set(className, { className, gradeId: grade.id, exists: used.has(n) });
      }
    });
    return Array.from(seen.values());
  };
  const plan = bulk.on && !editingClass ? bulkPlan() : [];
  const toCreate = plan.filter(p => !p.exists);
  // ชั้นที่แถวอื่นเลือกไปแล้ว เลือกซ้ำไม่ได้ · ปุ่มเพิ่มชั้นตั้งชั้นถัดไปที่ยังว่างให้
  const usedGrades = (except) => new Set(bulk.rows.filter((_, idx) => idx !== except).map(r => toId(r.gradeId)).filter(Boolean));
  const nextFreeGrade = () => { const used = usedGrades(-1); return grades.find(g => !used.has(g.id))?.id ?? null; };
  const setBulkRow = (i, patch) => setBulk(b => ({ ...b, rows: b.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  const onNameChange = (value) => {
    autoName.current = false;
    const m = value.trim().match(/^(.*?)\s*\/\s*\d+$/);
    const grade = m && grades.find(g => squash(g.gradeName) === squash(m[1]));
    setFormData(f => ({ ...f, className: value, gradeId: grade && (f.gradeId == null || f.gradeId === '') ? grade.id : f.gradeId }));
  };
  const onGradeChange = (val) => {
    const grade = gradeById(val);
    setFormData(f => {
      const fill = grade && !editingClass && (!String(f.className || '').trim() || autoName.current);
      if (fill) autoName.current = true;
      return { ...f, gradeId: val, className: fill ? nextRoomName(grade.gradeName) : f.className };
    });
  };

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
      setErrorAlert({ show: true, message: t('ไม่สามารถโหลดข้อมูลได้') });
    } finally {
      setLoading(false);
    }
  }, [filterGrade, filterAcademicYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (bulk.on && !editingClass) {
      if (!toCreate.length) {
        setErrorAlert({ show: true, message: plan.length ? t('ห้องที่ต้องการมีอยู่แล้วทั้งหมด') : t('กรุณาเลือกชั้นปีและจำนวนห้อง') });
        return;
      }
      const yearId = toId(formData.academicYearId);
      const capacity = parseInt(formData.capacity) || 40;
      const items = toCreate.map(p => ({ className: p.className, gradeId: p.gradeId, academicYearId: yearId, capacity }));
      setCreating(true);
      try {
        const res = await classAPI.bulkCreate(items);
        const created = Array.isArray(res.data?.created) ? res.data.created.length : Number(res.data?.created) || 0;
        const skipped = res.data?.skipped || [];
        fetchData();
        closeModal();
        await dialog.alert({
          title: t('เพิ่มห้องเรียนเสร็จแล้ว'),
          type: skipped.length ? 'warning' : 'success',
          message: t("สร้างแล้ว {created} · ข้าม {value2}", { created: created, value2: skipped.length }) +
            (skipped.length ? '\n\n' + skipped.map(s => `${s.className}: ${s.reason}`).join('\n') : ''),
        });
      } catch (err) {
        setErrorAlert({ show: true, message: err.response?.data?.error || t('สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง') });
      } finally {
        setCreating(false);
      }
      return;
    }
    if (!validate(e.currentTarget, [
      { key: 'className', message: t('กรุณากรอกชื่อห้อง'), missing: !String(formData.className ?? '').trim() },
      { key: 'gradeId', message: t('กรุณาเลือกชั้นปี'), missing: toId(formData.gradeId) === null },
    ])) return;
    const gradeId = toId(formData.gradeId);
    if (gradeId === null) {
      setErrorAlert({ show: true, message: t('กรุณาเลือกชั้นปี') });
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
      setErrorAlert({ show: true, message: err.response?.data?.error || t('เกิดข้อผิดพลาด') });
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
        setErrorAlert({ show: true, message: err.response?.data?.error || t('ไม่สามารถลบได้') });
      }
    }
  };

  const handleBulkDelete = async (rows) => {
    if (!rows.length) return;
    const withStudents = rows.reduce((n, r) => n + (r._count?.students || 0), 0);
    const ok = await dialog.confirm({
      title: t("ลบห้องเรียน {value1} ห้อง", { value1: rows.length }),
      message: t("ต้องการลบห้องเรียนที่เลือก {value1} ห้องหรือไม่?", { value1: rows.length }) +
        (withStudents ? t("\n\nห้องเหล่านี้มีนักเรียนรวม {withStudents} คน ระบบอาจลบห้องที่ยังมีนักเรียนไม่ได้", { withStudents: withStudents }) : '') +
        t('\n\nลบแล้วกู้คืนไม่ได้'),
      confirmText: t("ลบ {value1} ห้อง", { value1: rows.length }),
      type: 'danger',
    });
    if (!ok) return;
    try {
      const res = await classAPI.bulkDelete(rows.map(r => r.id));
      const deleted = Array.isArray(res.data?.deleted) ? res.data.deleted.length : Number(res.data?.deleted) || 0;
      const failed = res.data?.failed || [];
      fetchData();
      await dialog.alert({
        title: t('ลบห้องเรียนเสร็จแล้ว'),
        type: failed.length ? 'warning' : 'success',
        message: t("ลบแล้ว {deleted} · ลบไม่ได้ {value2}", { deleted: deleted, value2: failed.length }) +
          (failed.length ? '\n\n' + failed.map(f => `${f.name || f.id}: ${f.reason}`).join('\n') : ''),
      });
    } catch (err) {
      fetchData();
      setErrorAlert({ show: true, message: err.response?.data?.error || t('ลบไม่สำเร็จ ลองใหม่อีกครั้ง') });
    }
  };

  const openModal = (classData = null) => {
    autoName.current = false;
    setBulk({ on: false, rows: [{ gradeId: toId(filterGrade), count: 3 }] });
    classAPI.getAll().then(r => setAllClasses(r.data || [])).catch(() => setAllClasses(classes));
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
      label: t('ห้องเรียน'),
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'grade.gradeName',
      mobileSecondary: true,
      label: t('ชั้นปี'),
      sortable: true
    },
    {
      key: 'homeTeacher.name',
      mobileSecondary: true,
      label: t('ครูประจำชั้น'),
      render: (value) => value || '-'
    },
    {
      key: '_count.students',
      mobileSecondary: true,
      label: t('นักเรียน'),
      render: (value, row) => (
        <>
          <span className="md:hidden">{t("{value1} คน", { value1: value || 0 })}</span>
          <span className="hidden md:inline px-2 py-1 bg-brand-100 text-brand-800 text-xs rounded-full">
            {value || 0}/{row.capacity}
          </span>
        </>
      )
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

  const activeFilterCount = ((filterGrade) ? 1 : 0) + ((filterAcademicYear) ? 1 : 0);
  const filterControls = (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="sm:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("กรองตามปีการศึกษา")}</label>
          <SmartComboBox
            options={academicYears}
            value={filterAcademicYear}
            onChange={setFilterAcademicYear}
            labelKey="year"
            valueKey="id"
            placeholder={t("ทุกปีการศึกษา")}
            clearable
            searchable
          />
        </div>
        <div className="sm:w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("กรองตามชั้นปี")}</label>
          <SmartComboBox
            options={grades}
            value={filterGrade}
            onChange={setFilterGrade}
            labelKey="gradeName"
            valueKey="id"
            placeholder={t("ทุกชั้นปี")}
            clearable
            searchable
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* Header */}
      <PageHeader title={t("ห้องเรียน")}>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>{t("เพิ่มห้องเรียน")}</button>
      </PageHeader>
      <AddFab onClick={() => openModal()} label={t("เพิ่มห้องเรียน")} />

      {/* Filter: จอ sm ขึ้นไปแสดงในแถว · มือถือใช้ปุ่ม 'ตัวกรอง' ใน SmartTable */}
      <div className="hidden sm:block bg-white rounded-lg shadow p-4">
        {filterControls}
      </div>

      {/* ตัวกรองด่วนบนมือถือ: ชั้น แตะได้ทันที */}
      <div className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-100 sm:hidden">
        <QuickFilterBar label={t('ชั้น')} allLabel={t('ทุกชั้น')} options={grades.map(g => ({ value: g.id, label: g.gradeName }))} value={filterGrade} onChange={setFilterGrade} />
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
        selectable
        getRowId={(row) => row.id}
        bulkActions={[{ label: t('ลบที่เลือก'), danger: true, onClick: handleBulkDelete }]}
        onClearFilters={() => { setFilterGrade(null); setFilterAcademicYear(null); }}
        emptyAction={
          <>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t("เพิ่มห้องเรียน")}</button>
            
          </>
        }
        emptyMessage={t("ยังไม่มีห้องเรียน")}
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingClass ? t('แก้ไขห้องเรียน') : t('เพิ่มห้องเรียน')}
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
              >{t("ลบ…")}</button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">{t("ยกเลิก")}</button>
                <button type="submit" form="class-form" disabled={creating || (bulk.on && !editingClass && !toCreate.length)} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed">
                  {bulk.on && !editingClass ? (creating ? t('กำลังสร้าง…') : t("สร้าง {value1} ห้อง", { value1: toCreate.length })) : t('บันทึก')}
                </button>
          </div>
        }
      >
        <div className="p-4">
          <form id="class-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ปีการศึกษา")}</label>
                <SmartComboBox
                  options={academicYears}
                  value={formData.academicYearId}
                  onChange={(val) => setFormData({ ...formData, academicYearId: val })}
                  labelKey="year"
                  valueKey="id"
                  placeholder={t("เลือกปีการศึกษา")}
                  searchable
                  clearable
                />
              </div>

              {!(bulk.on && !editingClass) && (
              <div data-field="gradeId">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชั้นปี ")}<span className="text-red-500">*</span>
                </label>
                <SmartComboBox
                  options={grades}
                  value={formData.gradeId}
                  onChange={onGradeChange}
                  labelKey="gradeName"
                  valueKey="id"
                  placeholder={t("เลือกชั้น")}
                  searchable
                    error={errorFor('gradeId', toId(formData.gradeId) === null)}
                  />
              </div>
              )}

              <div data-field="className">
                {!(bulk.on && !editingClass) && (
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชื่อห้องเรียน ")}<span className="text-red-500">*</span>
                </label>
                )}
                {!(bulk.on && !editingClass) && (
                <input
                  type="text"
                  value={formData.className}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder={t("เช่น ป.4/1 (เลือกชั้นปีแล้วระบบตั้งชื่อให้)")}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                )}
                {!editingClass && gradeById(formData.gradeId) && !bulk.on && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bulkNames(gradeById(formData.gradeId).gradeName, Math.max(0, ...roomsOf(gradeById(formData.gradeId).gradeName)) + 3).slice(0, 3).map(n => (
                      <button key={n} type="button" onClick={() => { autoName.current = false; setFormData(f => ({ ...f, className: n })); }}
                        className={`min-h-[36px] rounded-full border px-3 text-sm ${formData.className === n ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-700'}`}>{n}</button>
                    ))}
                  </div>
                )}
                {!editingClass && (
                  <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={bulk.on} onChange={(e) => setBulk(b => ({ ...b, on: e.target.checked, rows: b.rows.map((r, i) => (i === 0 && r.gradeId == null ? { ...r, gradeId: toId(formData.gradeId) } : r)) }))} className="h-5 w-5" />{t("เพิ่มหลายห้องพร้อมกัน")}</label>
                )}
                {bulk.on && !editingClass && (
                  <div className="mt-1 space-y-3 rounded-lg bg-gray-50 p-3 text-sm">
                    {bulk.rows.map((row, i) => (
                      <div key={i} className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="mb-1 block text-gray-700">{t("ชั้น")}</span>
                          <SmartComboBox
                            options={grades.filter(g => !usedGrades(i).has(g.id))}
                            value={row.gradeId}
                            onChange={(val) => setBulkRow(i, { gradeId: val })}
                            labelKey="gradeName"
                            valueKey="id"
                            placeholder={t("เลือกชั้น")}
                            searchable
                          />
                        </div>
                        <label className="w-20 shrink-0">
                          <span className="mb-1 block text-gray-700">{t("จำนวนห้อง")}</span>
                          <input type="number" min="1" max="20" inputMode="numeric" value={row.count}
                            onChange={(e) => setBulkRow(i, { count: e.target.value })}
                            className="min-h-[44px] w-full rounded-lg border px-2 py-1 text-base" />
                        </label>
                        {bulk.rows.length > 1 && (
                          <button type="button" aria-label={t("เอาชั้นนี้ออก")}
                            onClick={() => setBulk(b => ({ ...b, rows: b.rows.filter((_, idx) => idx !== i) }))}
                            className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg border border-gray-300 text-gray-600 hover:bg-white">✕</button>
                        )}
                      </div>
                    ))}
                    {usedGrades(-1).size < grades.length && (
                      <button type="button" onClick={() => setBulk(b => ({ ...b, rows: [...b.rows, { gradeId: nextFreeGrade(), count: 3 }] }))}
                        className="min-h-[44px] rounded-lg border border-dashed border-brand-400 px-3 text-brand-700 hover:bg-white">{t("+ เพิ่มชั้น")}</button>
                    )}
                    <div>
                      <p className="mb-1 text-gray-700">{t("จะสร้าง (สูงสุด 20 ห้องต่อชั้น)")}</p>
                      {plan.length ? (
                        <div className="flex flex-wrap gap-2">
                          {plan.map(p => (
                            <span key={p.className} className={`rounded-full border px-3 py-1 ${p.exists ? 'border-gray-200 bg-gray-100 text-gray-400' : 'border-brand-300 bg-brand-50 text-brand-800'}`}>
                              {p.className}{p.exists ? t(' · มีแล้ว') : ''}
                            </span>
                          ))}
                        </div>
                      ) : <p className="text-gray-500">{t("เลือกชั้นปีและจำนวนห้องด้านบน")}</p>}
                    </div>
                  </div>
                )}
                  {!bulk.on && errorFor('className', !String(formData.className ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('className', !String(formData.className ?? '').trim())}</p>}
              </div>



              {!(bulk.on && !editingClass) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ครูประจำชั้น")}</label>
                <SmartComboBox
                  options={teachers}
                  value={formData.teacherId}
                  onChange={(val) => setFormData({ ...formData, teacherId: val })}
                  labelKey="name"
                  valueKey="id"
                  placeholder={t("เลือกครูประจำชั้น")}
                  searchable
                  clearable
                />
              </div>
              )}

              <details className="border rounded-lg px-3 py-2">
                <summary className="cursor-pointer text-sm text-gray-600 select-none">{t("ข้อมูลเพิ่มเติม (ไม่บังคับ)")}</summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("ความจุ (คน)")}</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
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
        message={t("ต้องการลบห้องเรียน \"{value1}\" หรือไม่?", { value1: deleteConfirm.item?.className })}
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

export default ManageClasses;
