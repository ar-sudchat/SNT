import { t } from '../../i18n';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { subjectAPI, teacherAPI, academicYearAPI, gradeAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';
import QuickFilterBar from '../../components/ui/QuickFilterBar';
import PageHeader from '../../components/ui/PageHeader';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../components/ui/DialogProvider';

const toId = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

const SKIP_DETAIL_MAX = 5;
const normCode = (c) => String(c || '').replace(/\s+/g, '').toLowerCase();

// รับ "ว14101 วิทยาศาสตร์ 4" / "ว14101, วิทยาศาสตร์" / วางสองคอลัมน์จาก Excel (คั่นด้วย tab)
const parseSubjectLines = (text) => {
  const rows = [];
  const seen = new Map();
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    let code = '';
    let name = '';
    if (line.includes('\t')) {
      const parts = line.split('\t').map((x) => x.trim()).filter(Boolean);
      code = parts[0] || '';
      name = parts.slice(1).join(' ');
    } else {
      const m = line.match(/^([^\s,，]+)[\s,，]+(.+)$/);
      if (m) { code = m[1]; name = m[2].replace(/^[\s,，]+|[\s,，]+$/g, ''); }
      else code = line;
    }
    let problem = '';
    if (!name) problem = t('ไม่มีชื่อวิชา');
    else if (seen.has(normCode(code))) problem = t("รหัสซ้ำกับบรรทัด {value1}", { value1: seen.get(normCode(code)) });
    if (!seen.has(normCode(code))) seen.set(normCode(code), rows.length + 1);
    rows.push({ line: rows.length + 1, code, name, problem });
  });
  return rows;
};

const ManageSubjects = () => {
  const { user } = useAuth();
  const dialog = useDialog();
  const [notice, setNotice] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkDefaults, setBulkDefaults] = useState({ gradeId: null, teacherId: null, academicYearId: null });
  const [searchParams, setSearchParams] = useSearchParams();
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
      const params = {};
      if (filterAcademicYear) params.academicYearId = filterAcademicYear;
      if (filterGrade) params.gradeId = filterGrade;

      const subjectRes = await subjectAPI.getAll(params);
      setSubjects(subjectRes.data);
    } catch (err) {
      setErrorAlert({ show: true, message: t('ไม่สามารถโหลดข้อมูลได้') });
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
      { key: 'subjectCode', message: t('กรุณากรอกรหัสวิชา'), missing: !String(formData.subjectCode ?? '').trim() },
      { key: 'subjectName', message: t('กรุณากรอกชื่อวิชา'), missing: !String(formData.subjectName ?? '').trim() },
      { key: 'teacherId', message: t('กรุณาเลือกครูผู้สอน'), missing: toId(formData.teacherId) === null },
    ])) return;
    const teacherId = toId(formData.teacherId);
    if (teacherId === null) {
      setErrorAlert({ show: true, message: t('กรุณาเลือกครูผู้สอน') });
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
      setErrorAlert({ show: true, message: err.response?.data?.error || t('เกิดข้อผิดพลาด') });
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
        setErrorAlert({ show: true, message: err.response?.data?.error || t('ไม่สามารถลบได้') });
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
        // ครูที่สร้างวิชาเอง (เจ้าของกลุ่ม) เป็นครูผู้สอนโดยอัตโนมัติ ถ้ามีครูคนเดียวก็เลือกให้เลย
        teacherId: toId(user?.teacher?.id) ?? (teachers.length === 1 ? toId(teachers[0].id) : null),
        gradeId: filterGrade || null,
        academicYearId: filterAcademicYear || currentAcademicYear?.id || null,
        description: '',
        status: 'ACTIVE'
      });
    }
    setShowModal(true);
  };

  // /admin/subjects?new=1 (จากหน้าแรกครู "สร้างวิชาแรก") เปิดฟอร์มเพิ่มวิชาทันทีเมื่อข้อมูลพร้อม
  useEffect(() => {
    if (searchParams.get('new') !== '1' || !initialLoadDone.current || loading) return;
    const next = new URLSearchParams(searchParams);
    next.delete('new');
    setSearchParams(next, { replace: true });
    openModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingSubject(null);
  };

  // ---- เพิ่มหลายวิชา ----
  const bulkRows = parseSubjectLines(bulkText);
  const existingCodes = new Set(subjects.map((x) => normCode(x.subjectCode)));
  const bulkValid = bulkRows.filter((r) => !r.problem);
  const bulkTeacherOk = toId(bulkDefaults.teacherId) !== null;

  const openBulk = () => {
    const currentAcademicYear = academicYears.find((ay) => ay.isCurrent);
    const myId = toId(user?.teacher?.id);
    const myListed = myId !== null && teachers.some((t) => Number(t.id) === myId);
    setBulkDefaults({
      teacherId: myListed ? myId : (teachers.length === 1 ? toId(teachers[0].id) : null),
      gradeId: filterGrade || null,
      academicYearId: filterAcademicYear || currentAcademicYear?.id || null,
    });
    setBulkText('');
    setBulkError('');
    setShowBulk(true);
  };
  const closeBulk = () => {
    if (bulkBusy) return;
    setShowBulk(false);
  };

  const handleBulkCreate = async () => {
    if (!bulkValid.length || !bulkTeacherOk || bulkBusy) return;
    setBulkBusy(true);
    setBulkError('');
    try {
      const items = bulkValid.map((r) => ({
        subjectCode: r.code,
        subjectName: r.name,
        gradeId: toId(bulkDefaults.gradeId),
        teacherId: toId(bulkDefaults.teacherId),
        academicYearId: toId(bulkDefaults.academicYearId),
      }));
      const res = await subjectAPI.bulkCreate(items);
      const { created = 0, skipped = [] } = res.data || {};
      const createdN = Array.isArray(created) ? created.length : created;
      let msg = t("เพิ่มแล้ว {createdN}", { createdN: createdN });
      if (skipped.length) {
        const detail = skipped.slice(0, SKIP_DETAIL_MAX).map((x) => `${x.subjectCode}: ${x.reason}`).join(', ');
        msg = t("เพิ่มแล้ว {createdN} · ข้าม {n} ({detail}{suffix})", { createdN, n: skipped.length, detail, suffix: skipped.length > SKIP_DETAIL_MAX ? ' ...' : '' });
      }
      setNotice(msg);
      setShowBulk(false);
      setBulkText('');
      fetchData();
    } catch (err) {
      setBulkError(err.response?.data?.error || t('เพิ่มไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setBulkBusy(false);
    }
  };

  // ---- ลบที่เลือก ----
  const handleBulkDelete = async (rows) => {
    if (!rows || !rows.length) return;
    const preview = rows.slice(0, 8).map((r) => `${r.subjectCode} ${r.subjectName}`).join('\n') + (rows.length > 8 ? '\n...' : '');
    const ok = await dialog.confirm({
      title: t('ลบวิชาที่เลือก'),
      message: t("ต้องการลบ {value1} วิชา\n{preview}\nวิชาที่มีงานอยู่อาจลบไม่ได้", { value1: rows.length, preview: preview }),
      type: 'danger',
      confirmText: t("ลบ {value1} รายการ", { value1: rows.length }),
      cancelText: t('ยกเลิก'),
    });
    if (!ok) return;
    try {
      const res = await subjectAPI.bulkDelete(rows.map((r) => r.id));
      const { deleted = 0, failed = [] } = res.data || {};
      const deletedN = Array.isArray(deleted) ? deleted.length : deleted;
      setNotice(failed.length ? t("ลบแล้ว {deletedN} · ลบไม่ได้ {n}", { deletedN, n: failed.length }) : t("ลบแล้ว {deletedN}", { deletedN }));
      await fetchData();
      if (failed.length) {
        await dialog.alert({
          title: t("ลบไม่ได้ {value1} รายการ", { value1: failed.length }),
          message: failed.map((f) => `${f.name}: ${f.reason}`).join('\n'),
          type: 'danger',
        });
      }
    } catch (err) {
      setErrorAlert({ show: true, message: err.response?.data?.error || t('ไม่สามารถลบได้') });
    }
  };

  // Table columns
  const columns = [
    {
      key: 'subjectCode',
      mobileSecondary: true,
      label: t('รหัสวิชา'),
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'subjectName',
      mobilePrimary: true,
      label: t('ชื่อวิชา'),
      sortable: true
    },
    {
      key: 'grade.gradeName',
      mobileSecondary: true,
      label: t('ชั้นเรียน'),
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: 'teacher.name',
      mobileSecondary: true,
      label: t('ครูผู้สอน'),
      sortable: true,
      render: (value) => value || '-'
    },
    {
      key: '_count.tasks',
      hideOnMobile: true,
      label: t('จำนวนงาน'),
      render: (value) => (
        <span className="px-2 py-1 bg-brand-100 text-brand-800 text-xs rounded-full">{t("{value1} งาน", { value1: value || 0 })}</span>
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

  const activeFilterCount = ((filterAcademicYear) ? 1 : 0) + ((filterGrade) ? 1 : 0);
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
            }}
            labelKey="year"
            valueKey="id"
            placeholder={t("ทุกปีการศึกษา")}
            allLabel={t("ทุกปีการศึกษา")}
            clearable
            searchable
          />
        </div>
        <div className="sm:w-52">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชั้นเรียน")}</label>
          <SmartComboBox
            options={grades}
            value={filterGrade}
            onChange={setFilterGrade}
            labelKey="gradeName"
            valueKey="id"
            placeholder={t("ทุกชั้น")}
            allLabel={t("ทุกชั้น")}
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
      <PageHeader title={t("วิชา")}>
        <button
          type="button"
          onClick={openBulk}
          className="px-4 py-2 min-h-[44px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center"
        >{t("เพิ่มหลายวิชา")}</button>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>{t("เพิ่มวิชา")}</button>
      </PageHeader>
      <AddFab onClick={() => openModal()} label={t("เพิ่มวิชา")} />

      {/* ผลลัพธ์ */}
      {notice && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start justify-between gap-3">
          <span className="break-words min-w-0">{notice}</span>
          <button onClick={() => setNotice('')} aria-label={t("ปิด")} className="min-w-[44px] min-h-[44px] -my-3 -mr-2 flex items-center justify-center text-green-600 hover:text-green-800 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
        data={subjects}
        columns={columns}
        loading={loading}
        exportFileName="subjects"
        searchable
        exportable
        pagination
        selectable
        getRowId={(row) => row.id}
        bulkActions={[{ label: t('ลบที่เลือก'), danger: true, onClick: handleBulkDelete }]}
        onClearFilters={() => { setFilterAcademicYear(null); setFilterGrade(null); }}
        emptyAction={
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={openBulk} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t("เพิ่มหลายวิชา")}</button>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{t("เพิ่มทีละวิชา")}</button>
          </div>
        }
        emptyMessage={t("ยังไม่มีวิชา")}
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingSubject ? t('แก้ไขวิชา') : t('เพิ่มวิชา')}
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
              >{t("ลบ…")}</button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">{t("ยกเลิก")}</button>
                <button type="submit" form="subject-form" className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">{t("บันทึก")}</button>
          </div>
        }
      >
        <div className="p-4">
          <form id="subject-form" onSubmit={handleSubmit} noValidate className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชั้นเรียน")}</label>
                <SmartComboBox
                  options={grades}
                  value={formData.gradeId}
                  onChange={(val) => setFormData({ ...formData, gradeId: val })}
                  labelKey="gradeName"
                  valueKey="id"
                  placeholder={t("เลือกชั้นเรียน")}
                  searchable
                  clearable
                />
              </div>

              <div data-field="subjectCode">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("รหัสวิชา ")}<span className="text-red-500">*</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชื่อวิชา ")}<span className="text-red-500">*</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("ครูผู้สอน ")}<span className="text-red-500">*</span>
                </label>
                <SmartComboBox
                  options={teachers}
                  value={formData.teacherId}
                  onChange={(val) => setFormData({ ...formData, teacherId: val })}
                  labelKey="name"
                  valueKey="id"
                  placeholder={t("เลือกครูผู้สอน")}
                  searchable
                    error={errorFor('teacherId', toId(formData.teacherId) === null)}
                  />
              </div>

              <details className="border rounded-lg px-3 py-2">
                <summary className="cursor-pointer text-sm text-gray-600 select-none">{t("ข้อมูลเพิ่มเติม (ไม่บังคับ)")}</summary>
                <div className="space-y-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("คำอธิบาย")}</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                      rows="3"
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

      {/* เพิ่มหลายวิชา */}
      <WindowModal
        open={showBulk}
        title={t("เพิ่มหลายวิชา")}
        onClose={closeBulk}
        id="subject-bulk"
        initialWidth="max-w-2xl"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" onClick={closeBulk} disabled={bulkBusy} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50 disabled:opacity-50">{t("ยกเลิก")}</button>
            <button
              type="button"
              onClick={handleBulkCreate}
              disabled={!bulkValid.length || !bulkTeacherOk || bulkBusy}
              className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkBusy ? t('กำลังเพิ่ม...') : bulkValid.length ? t("เพิ่ม {value1} วิชา", { value1: bulkValid.length }) : t('เพิ่มวิชา')}
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("ปีการศึกษา")}</label>
              <SmartComboBox
                options={academicYears}
                value={bulkDefaults.academicYearId}
                onChange={(val) => setBulkDefaults((d) => ({ ...d, academicYearId: val }))}
                labelKey="year"
                valueKey="id"
                placeholder={t("เลือกปีการศึกษา")}
                searchable
                clearable
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("ชั้นเรียน")}</label>
              <SmartComboBox
                options={grades}
                value={bulkDefaults.gradeId}
                onChange={(val) => setBulkDefaults((d) => ({ ...d, gradeId: val }))}
                labelKey="gradeName"
                valueKey="id"
                placeholder={t("ไม่ระบุชั้น")}
                searchable
                clearable
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("ครูผู้สอน ")}<span className="text-red-500">*</span>
              </label>
              <SmartComboBox
                options={teachers}
                value={bulkDefaults.teacherId}
                onChange={(val) => setBulkDefaults((d) => ({ ...d, teacherId: val }))}
                labelKey="name"
                valueKey="id"
                placeholder={t("เลือกครูผู้สอน")}
                searchable
              />
            </div>
          </div>
          {!bulkTeacherOk && <p className="text-sm text-amber-700">{t("เลือกครูผู้สอนก่อนจึงจะเพิ่มได้")}</p>}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="subject-bulk-text" className="block text-sm font-medium text-gray-700">{t("รหัส ชื่อวิชา — หนึ่งบรรทัดต่อหนึ่งวิชา")}</label>
              {bulkText && (
                <button type="button" onClick={() => setBulkText('')} className="min-h-[44px] px-2 text-sm text-gray-500 hover:text-gray-700 underline shrink-0">{t("ล้าง")}</button>
              )}
            </div>
            <textarea
              id="subject-bulk-text"
              data-autofocus
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={7}
              placeholder={t('ว14101 วิทยาศาสตร์ 4\nค14101 คณิตศาสตร์ 4\nท14101 ภาษาไทย 4')}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-500">{t("คั่นรหัสกับชื่อด้วยเว้นวรรคหรือจุลภาค · วางสองคอลัมน์ (รหัส, ชื่อ) จาก Excel ได้เลย")}</p>
          </div>

          {bulkRows.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">{bulkRows.length > bulkValid.length ? t("จะสร้าง {n} วิชา · มีปัญหา {bad} บรรทัด (จะไม่ถูกเพิ่ม)", { n: bulkValid.length, bad: bulkRows.length - bulkValid.length }) : t("จะสร้าง {n} วิชา", { n: bulkValid.length })}</p>
              <ul className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                {bulkRows.map((r) => {
                  const exists = !r.problem && existingCodes.has(normCode(r.code));
                  return (
                    <li key={r.line} className={`px-3 py-2 min-h-[44px] flex items-start gap-3 text-sm ${r.problem ? 'bg-red-50' : ''}`}>
                      <span className="text-gray-400 w-6 shrink-0 text-right">{r.line}</span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900 break-all">{r.code}</span>
                        {r.name && <span className="text-gray-700 break-words"> {r.name}</span>}
                        {r.problem && <p className="text-xs text-red-600 mt-0.5">{r.problem}</p>}
                        {exists && <p className="text-xs text-amber-700 mt-0.5">{t("มีรหัสนี้ในรายการแล้ว อาจถูกข้าม")}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {bulkError && <p role="alert" className="text-sm text-red-600">{bulkError}</p>}
        </div>
      </WindowModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title={t("ยืนยันการลบ")}
        message={t("ต้องการลบวิชา \"{value1}\" หรือไม่?", { value1: deleteConfirm.item?.subjectName })}
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

export default ManageSubjects;
