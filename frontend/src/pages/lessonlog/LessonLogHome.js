import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/navConfig';
import useLessonContext from './useLessonContext';
import LessonContextBar from './LessonContextBar';
import { SmartTable, WindowModal } from '../../components/ui';
import CreateRecord from './CreateRecord';
import { shortName } from './lessonLogCore';

const PATH = {
  check: 'M5 13l4 4L19 7',
  doc: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  chev: 'M9 5l7 7-7 7',
  plus: 'M12 4v16m8-8H4'
};

const linkBtn = 'flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50';

const LessonLogHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ctx = useLessonContext();
  const { classes, subjects, classId, subjectId } = ctx;

  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [exportMsg, setExportMsg] = useState('');

  // ส่งออก Word จากแถวที่ติ๊กหรือคลิกขวา (เฉพาะที่บันทึกเสร็จแล้ว)
  const exportWord = async (rows) => {
    const ids = rows.filter(r => r.status === 'DONE').map(r => r.id);
    if (!ids.length) { setExportMsg('ส่งออกได้เฉพาะบันทึกที่เสร็จแล้ว'); return; }
    setExportMsg('กำลังสร้างไฟล์ Word…');
    try {
      const r = await assessmentAPI.exportDocx(ids);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(r.data);
      a.download = `บันทึกหลังแผน-${classes.find(c => c.id === classId)?.className || 'ห้องเรียน'}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      setExportMsg(ids.length < rows.length ? `ส่งออก ${ids.length} รายการ (ข้ามที่ยังไม่เสร็จ ${rows.length - ids.length})` : '');
    } catch (e) {
      setExportMsg('ส่งออกไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  };

  const myTeacherId = user?.teacher?.id || null;
  const canManage = user?.role === 'ADMIN' || !!user?.canManage;

  useEffect(() => {
    let cancelled = false;
    assessmentAPI.templates()
      .then(res => { if (!cancelled) setTemplates(res.data || []); })
      .catch(() => { /* chip labels fall back to the record's own template name */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ctx.loading) return undefined;
    if (!classId) { setRecords([]); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError('');
    assessmentAPI.records(subjectId ? { classId, subjectId } : { classId })
      .then(res => { if (!cancelled) setRecords(res.data || []); })
      .catch(e => { if (!cancelled) setError(e.response?.data?.error || 'โหลดบันทึกไม่สำเร็จ'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ctx.loading, classId, subjectId, reloadKey]);

  // Label of a record's type: the template's short name, else the snapshot name on the record.
  const typeLabel = (r) => {
    const t = templates.find(x => x.id === r.templateId);
    return shortName(t || { key: r.templateKey, name: r.templateName });
  };

  // One chip per template that actually has records here.
  const typeChips = useMemo(() => {
    const seen = new Map();
    records.forEach(r => {
      const cur = seen.get(r.templateId);
      if (cur) cur.count += 1;
      else seen.set(r.templateId, { id: r.templateId, count: 1, label: typeLabel(r) });
    });
    return Array.from(seen.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, templates]);

  // A filter whose type no longer has records (class/subject changed) falls back to "all".
  const activeFilter = filter === 'all' || typeChips.some(c => c.id === filter) ? filter : 'all';
  const visible = activeFilter === 'all' ? records : records.filter(r => r.templateId === activeFilter);

  const subjectName = (id) => subjects.find(x => x.id === id)?.subjectName || '-';
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-');

  // ตารางบนคอม: ดูรายละเอียดได้มากกว่ารายการบนมือถือ
  const tableColumns = [
    { key: 'name', label: 'ชื่อเรื่อง / แผน', sortable: true, render: (v) => <span className="font-medium text-gray-900">{v}</span> },
    { key: 'templateId', label: 'ประเภท', sortable: true, render: (_, r) => typeLabel(r), exportValue: (r) => typeLabel(r) },
    { key: 'subjectId', label: 'วิชา', sortable: true, render: (v) => (v ? subjectName(v) : '-'), exportValue: (r) => (r.subjectId ? subjectName(r.subjectId) : '') },
    { key: 'dateText', label: 'วันที่สอน', render: (v) => v || '-' },
    { key: 'teacherName', label: 'ครู', sortable: true, render: (v) => v || '-' },
    { key: 'updatedAt', label: 'แก้ไขล่าสุด', sortable: true, render: (v) => fmtDate(v), exportValue: (r) => fmtDate(r.updatedAt) },
    {
      key: 'status', label: 'สถานะ', sortable: true, exportValue: (r) => (r.status === 'DONE' ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ'),
      render: (v) => (v === 'DONE'
        ? <span className="whitespace-nowrap rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">เสร็จแล้ว</span>
        : <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">ยังไม่เสร็จ</span>)
    }
  ];

  const chips = (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0" role="group" aria-label="กรองตามประเภท">
      {[{ id: 'all', label: 'ทั้งหมด', count: records.length }, ...typeChips].map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => setFilter(c.id)}
          aria-pressed={activeFilter === c.id}
          className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
            activeFilter === c.id
              ? 'border-brand-600 bg-brand-50 text-brand-700'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {c.label} {c.count}
        </button>
      ))}
    </div>
  );

  // ---------- states without a class ----------
  if (ctx.loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-brand-600" role="status" aria-label="กำลังโหลด" />
      </div>
    );
  }
  if (ctx.error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600">{ctx.error}</div>;
  }
  if (!classes.length) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">บันทึกหลังแผน</h1>
        <div className="rounded-lg bg-white p-5 shadow">
          <h2 className="font-semibold text-gray-800">ยังไม่มีห้องเรียนในกลุ่มนี้</h2>
          {canManage ? (
            <>
              <p className="mt-1 text-sm text-gray-600">ตั้งค่าห้องเรียนและนำเข้ารายชื่อนักเรียนก่อน แล้วจึงเริ่มบันทึกได้</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/admin/classes" className={linkBtn}>ตั้งค่าห้องเรียน</Link>
                <Link to="/admin/import" className={linkBtn}>นำเข้ารายชื่อนักเรียน</Link>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-600">แจ้งผู้ดูแลกลุ่มให้ตั้งค่าห้องเรียนและนำเข้ารายชื่อนักเรียน</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 pb-24 sm:pb-0 lg:max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">บันทึกหลังแผน</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="hidden min-h-[44px] items-center gap-2 rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700 sm:inline-flex"
        >
          <Icon d={PATH.plus} className="h-5 w-5" /> สร้างบันทึก / แบบประเมิน
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600">
          <span>{error}</span>
        </div>
      )}

      <LessonContextBar ctx={ctx} />

      {/* Records */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-600" role="status" aria-label="กำลังโหลด" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-lg bg-white p-5 shadow">
          <h2 className="font-semibold text-gray-800">ยังไม่มีบันทึกของห้องนี้</h2>
          <p className="mt-1 text-sm text-gray-600">
            กด "สร้างบันทึก / แบบประเมิน" เลือกประเภท ตั้งชื่อเอง แล้วเริ่มบันทึกได้เลย
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <SmartTable
              data={visible}
              columns={tableColumns}
              onRowClick={(r) => navigate(`/lesson-log/${r.id}`)}
              searchable
              pagination
              pageSize={25}
              emptyMessage="ไม่มีบันทึก"
              toolbarStart={chips}
              selectable
              bulkActions={[{ label: 'ส่งออกเป็น Word', onClick: exportWord }]}
              rowActions={[
                { label: 'ส่งออกเป็น Word', onClick: (r) => exportWord([r]), show: (r) => r.status === 'DONE' },
                { label: 'สรุปผลรายคน', onClick: () => navigate('/lesson-log/summary') },
                { label: 'จัดการแบบประเมิน', onClick: () => navigate('/lesson-log/templates') },
                { label: 'ส่งออก Word หลายรายการ…', onClick: () => navigate('/lesson-log/export') }
              ]}
              exportFileName="บันทึกหลังแผน"
            />
          </div>

          <div className="md:hidden">{chips}</div>

          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow md:hidden">
            {visible.map(r => {
              const done = r.status === 'DONE';
              const mine = !r.teacherId || r.teacherId === myTeacherId;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/lesson-log/${r.id}`)}
                    className="flex min-h-[64px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 sm:px-4"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-700'}`}>
                      <Icon d={done ? PATH.check : PATH.doc} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-900">{r.name}</span>
                      <span className="block truncate text-sm text-gray-500">
                        {typeLabel(r)}{r.dateText ? ` · ${r.dateText}` : ''}
                      </span>
                      {!mine && r.teacherName && <span className="block truncate text-xs text-gray-400">{r.teacherName}</span>}
                    </span>
                    {done ? (
                      <Icon d={PATH.chev} className="h-5 w-5 shrink-0 text-gray-400" />
                    ) : (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">ยังไม่เสร็จ</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {exportMsg && <p role="status" className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{exportMsg}</p>}

      {/* Secondary actions: บนคอมอยู่ในการติ๊ก/คลิกขวาของตารางแล้ว · มือถือยังใช้ปุ่ม */}
      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3 md:hidden">
        <Link to="/lesson-log/export" className={linkBtn}>ส่งออกเป็น Word</Link>
        <Link to="/lesson-log/summary" className={linkBtn}>สรุปผลรายคน</Link>
        <Link to="/lesson-log/templates" className={linkBtn}>แบบประเมิน</Link>
      </div>

      {/* Primary action on phones: above the bottom bar (56px + safe area) */}
      <div
        className="fixed inset-x-0 z-20 px-3 sm:hidden print:hidden"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom) + 8px)' }}
      >
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="mx-auto flex min-h-[48px] w-full max-w-lg items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white shadow-lg hover:bg-brand-700"
        >
          <Icon d={PATH.plus} className="h-5 w-5" /> สร้างบันทึก / แบบประเมิน
        </button>
      </div>

      <WindowModal open={createOpen} id="lesson-create" title="สร้างบันทึก / แบบประเมิน" onClose={() => setCreateOpen(false)} initialWidth="max-w-5xl">
        {createOpen && <CreateRecord ctx={ctx} embedded onDone={(ids) => { setCreateOpen(false); setReloadKey(k => k + 1); setExportMsg(`สร้างบันทึกแล้ว ${ids.length} ห้อง`); }} />}
      </WindowModal>
    </div>
  );
};

export default LessonLogHome;
