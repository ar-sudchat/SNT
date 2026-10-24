import React, { useState, useEffect, useCallback } from 'react';
import { gradeAPI } from '../../services/api';
import { SmartTable, SmartComboBox, ConfirmDialog, WindowModal } from '../../components/ui';
import useFormErrors from '../../utils/useFormErrors';
import { AddFab } from '../../components/ui/SmartTable';
import PageHeader from '../../components/ui/PageHeader';
import { useDialog } from '../../components/ui/DialogProvider';

// ทางลัดชั้นปีที่ใช้บ่อย
const range = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`);
const PRESETS = [
  { label: 'ป.1–ป.6', names: range('ป.', 1, 6) },
  { label: 'ม.1–ม.3', names: range('ม.', 1, 3) },
  { label: 'ม.4–ม.6', names: range('ม.', 4, 6) },
  { label: 'อ.1–อ.3', names: range('อ.', 1, 3) },
];

// หนึ่งบรรทัดต่อหนึ่งชั้น หรือคั่นด้วยจุลภาค/เซมิโคลอน
const parseNames = (text) => {
  const seen = new Set();
  const out = [];
  String(text || '').split(/[\n,，;；]+/).forEach((raw) => {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (!name) return;
    const k = name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(name);
  });
  return out;
};
const normName = (n) => String(n || '').replace(/\s+/g, ' ').trim().toLowerCase();
const SKIP_DETAIL_MAX = 5;

const ManageGrades = () => {
  const dialog = useDialog();
  const [notice, setNotice] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [grades, setGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, item: null });
  const [showModal, setShowModal] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const { validate, reset: resetErrors, errorFor } = useFormErrors();
  const [formData, setFormData] = useState({
    gradeName: '',
    description: '',
    status: 'ACTIVE'
  });

  const fetchGrades = useCallback(async () => {
    try {
      setLoading(true);
      const response = await gradeAPI.getAll();
      setGrades(response.data);
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(e.currentTarget, [
      { key: 'gradeName', message: 'กรุณากรอกชื่อชั้นปี', missing: !String(formData.gradeName ?? '').trim() },
    ])) return;
    try {
      if (editingGrade) {
        await gradeAPI.update(editingGrade.id, formData);
      } else {
        await gradeAPI.create(formData);
      }
      fetchGrades();
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
        await gradeAPI.delete(deleteConfirm.item.id);
        fetchGrades();
      } catch (err) {
        setError(err.response?.data?.error || 'ไม่สามารถลบได้');
      }
    }
  };

  const openModal = (grade = null) => {
    if (grade) {
      setEditingGrade(grade);
      setFormData({
        gradeName: grade.gradeName,
        description: grade.description || '',
        status: grade.status
      });
    } else {
      setEditingGrade(null);
      setFormData({ gradeName: '', description: '', status: 'ACTIVE' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    resetErrors();
    setShowModal(false);
    setEditingGrade(null);
    setError('');
  };

  // ---- เพิ่มหลายชั้น ----
  const existingNames = new Set(grades.map((g) => normName(g.gradeName)));
  const bulkNames = parseNames(bulkText);
  const bulkNew = bulkNames.filter((n) => !existingNames.has(normName(n)));

  const openBulk = () => {
    setBulkText('');
    setBulkError('');
    setShowBulk(true);
  };
  const closeBulk = () => {
    if (bulkBusy) return;
    setShowBulk(false);
  };
  const addPreset = (names) => {
    setBulkText((prev) => parseNames(`${prev}\n${names.join('\n')}`).join('\n'));
  };

  const handleBulkCreate = async () => {
    if (!bulkNew.length || bulkBusy) return;
    setBulkBusy(true);
    setBulkError('');
    try {
      const res = await gradeAPI.bulkCreate(bulkNew.map((gradeName) => ({ gradeName })));
      const { created = 0, skipped = [] } = res.data || {};
      const createdN = Array.isArray(created) ? created.length : created;
      let msg = `เพิ่มแล้ว ${createdN}`;
      if (skipped.length) {
        const detail = skipped.slice(0, SKIP_DETAIL_MAX).map((x) => `${x.gradeName}: ${x.reason}`).join(', ');
        msg += ` · ข้าม ${skipped.length} (${detail}${skipped.length > SKIP_DETAIL_MAX ? ' ...' : ''})`;
      }
      setNotice(msg);
      setShowBulk(false);
      setBulkText('');
      fetchGrades();
    } catch (err) {
      setBulkError(err.response?.data?.error || 'เพิ่มไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setBulkBusy(false);
    }
  };

  // ---- ลบที่เลือก ----
  const handleBulkDelete = async (rows) => {
    if (!rows || !rows.length) return;
    const preview = rows.slice(0, 8).map((r) => r.gradeName).join(', ') + (rows.length > 8 ? ' ...' : '');
    const ok = await dialog.confirm({
      title: 'ลบชั้นปีที่เลือก',
      message: `ต้องการลบ ${rows.length} ชั้นปี\n${preview}\nชั้นที่ยังมีห้องเรียนอาจลบไม่ได้`,
      type: 'danger',
      confirmText: `ลบ ${rows.length} รายการ`,
      cancelText: 'ยกเลิก',
    });
    if (!ok) return;
    try {
      const res = await gradeAPI.bulkDelete(rows.map((r) => r.id));
      const { deleted = 0, failed = [] } = res.data || {};
      const deletedN = Array.isArray(deleted) ? deleted.length : deleted;
      setNotice(`ลบแล้ว ${deletedN}${failed.length ? ` · ลบไม่ได้ ${failed.length}` : ''}`);
      await fetchGrades();
      if (failed.length) {
        await dialog.alert({
          title: `ลบไม่ได้ ${failed.length} รายการ`,
          message: failed.map((f) => `${f.name}: ${f.reason}`).join('\n'),
          type: 'danger',
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'ไม่สามารถลบได้');
    }
  };

  // Table columns
  const columns = [
    {
      key: 'gradeName',
      mobilePrimary: true,
      label: 'ชั้นปี',
      sortable: true,
      render: (value) => <span className="font-medium text-gray-900">{value}</span>
    },
    {
      key: 'description',
      mobileSecondary: true,
      label: 'คำอธิบาย',
      render: (value) => value || '-'
    },
    {
      key: '_count.classes',
      hideOnMobile: true,
      label: 'ห้องเรียน',
      render: (value) => (
        <span className="px-2 py-1 bg-brand-100 text-brand-800 text-xs rounded-full">
          {value || 0} ห้อง
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

  return (
    <div className="space-y-4 pb-24 sm:pb-0">
      {/* Header */}
      <PageHeader title="ชั้นปี">
        <button
          type="button"
          onClick={openBulk}
          className="px-4 py-2 min-h-[44px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center"
        >
          เพิ่มหลายชั้น
        </button>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 hidden sm:flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          เพิ่มชั้นปี
        </button>
      </PageHeader>
      <AddFab onClick={() => openModal()} label="เพิ่มชั้นปี" />

      {/* ผลลัพธ์ */}
      {notice && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start justify-between gap-3">
          <span className="break-words min-w-0">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="ปิด" className="min-w-[44px] min-h-[44px] -my-3 -mr-2 flex items-center justify-center text-green-600 hover:text-green-800 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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

      {/* Table */}
      <SmartTable
        data={grades}
        columns={columns}
        loading={loading}
        exportFileName="grades"
        searchable
        exportable
        pagination
        selectable
        getRowId={(row) => row.id}
        bulkActions={[{ label: 'ลบที่เลือก', danger: true, onClick: handleBulkDelete }]}
        emptyAction={
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={openBulk} className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">เพิ่มหลายชั้น (ป.1–ป.6 ฯลฯ)</button>
            <button type="button" onClick={() => openModal()} className="px-4 py-2 min-h-[44px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">เพิ่มทีละชั้น</button>
          </div>
        }
        emptyMessage="ยังไม่มีชั้นปี"
        onRowClick={(row) => openModal(row)}
      />

      {/* Modal */}
      <WindowModal
        open={showModal}
        title={editingGrade ? 'แก้ไขชั้นปี' : 'เพิ่มชั้นปี'}
        onClose={closeModal}
        id="grade-form"
        initialWidth="max-w-md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {editingGrade && (
              <button
                type="button"
                onClick={() => { const target = editingGrade; closeModal(); handleDeleteClick(target); }}
                className="px-4 py-2 min-h-[44px] border border-red-300 text-red-600 rounded-lg hover:bg-red-50 sm:mr-auto"
              >
                ลบ…
              </button>
            )}
                <button type="button" onClick={closeModal} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button type="submit" form="grade-form" className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                  บันทึก
                </button>
          </div>
        }
      >
        <div className="p-4">
          <form id="grade-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              <div data-field="gradeName">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อชั้นปี <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.gradeName}
                  onChange={(e) => setFormData({ ...formData, gradeName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
                />
                  {errorFor('gradeName', !String(formData.gradeName ?? '').trim()) && <p className="mt-1 text-sm text-red-500">{errorFor('gradeName', !String(formData.gradeName ?? '').trim())}</p>}
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
                    <SmartComboBox
                      options={[{ value: 'ACTIVE', label: 'ใช้งาน' }, { value: 'INACTIVE', label: 'ไม่ใช้งาน' }]}
                      value={formData.status}
                      onChange={(v) => v && setFormData({ ...formData, status: v })}
                      searchable={false}
                      clearable={false}
                      ariaLabel="สถานะ"
                    />
                  </div>
                </div>
              </details>

          </form>
        </div>
      </WindowModal>

      {/* เพิ่มหลายชั้น */}
      <WindowModal
        open={showBulk}
        title="เพิ่มหลายชั้น"
        onClose={closeBulk}
        id="grade-bulk"
        initialWidth="max-w-lg"
        footer={
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" onClick={closeBulk} disabled={bulkBusy} className="px-4 py-2 min-h-[44px] border rounded-lg hover:bg-gray-50 disabled:opacity-50">
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleBulkCreate}
              disabled={!bulkNew.length || bulkBusy}
              className="px-4 py-2 min-h-[44px] bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkBusy ? 'กำลังเพิ่ม...' : bulkNew.length ? `เพิ่ม ${bulkNew.length} ชั้น` : 'เพิ่มชั้น'}
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-4">
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">เลือกทางลัด</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => addPreset(p.names)}
                  className="px-4 min-h-[44px] rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="grade-bulk-text" className="block text-sm font-medium text-gray-700">หนึ่งบรรทัดต่อหนึ่งชั้น</label>
              {bulkText && (
                <button type="button" onClick={() => setBulkText('')} className="min-h-[44px] px-2 text-sm text-gray-500 hover:text-gray-700 underline">
                  ล้าง
                </button>
              )}
            </div>
            <textarea
              id="grade-bulk-text"
              data-autofocus
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={'ป.1\nป.2\nป.3'}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-1 text-xs text-gray-500">พิมพ์คั่นด้วยจุลภาคก็ได้ เช่น ป.1, ป.2, ป.3</p>
          </div>

          {bulkNames.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                จะสร้าง {bulkNew.length} ชั้น{bulkNames.length > bulkNew.length ? ` · มีแล้ว ${bulkNames.length - bulkNew.length}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                {bulkNames.map((n) => {
                  const exists = existingNames.has(normName(n));
                  return (
                    <span
                      key={n}
                      className={`px-3 py-1 rounded-full text-sm ${exists ? 'bg-gray-100 text-gray-500' : 'bg-brand-100 text-brand-800'}`}
                    >
                      {n}{exists ? ' · มีแล้ว' : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {bulkError && <p role="alert" className="text-sm text-red-600">{bulkError}</p>}
        </div>
      </WindowModal>

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title="ยืนยันการลบ"
        message={`ต้องการลบชั้นปี "${deleteConfirm.item?.gradeName}" หรือไม่?`}
        confirmText="ลบ"
        cancelText="ยกเลิก"
        type="danger"
      />
    </div>
  );
};

export default ManageGrades;
