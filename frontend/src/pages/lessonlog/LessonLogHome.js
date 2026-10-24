import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/navConfig';
import useLessonContext from './useLessonContext';
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
  const { classes, subjects, classId, subjectId, cls, subject, setClassId, setSubjectId } = ctx;

  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [panelOpen, setPanelOpen] = useState(false);

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
  }, [ctx.loading, classId, subjectId]);

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

  const contextLabel = cls ? `${cls.className} · ${subject ? subject.subjectName : 'ทุกวิชา'}` : '';

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
    <div className="mx-auto max-w-3xl space-y-3 pb-24 sm:pb-0">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">บันทึกหลังแผน</h1>
        <Link
          to="/lesson-log/new"
          className="hidden min-h-[44px] items-center gap-2 rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700 sm:inline-flex"
        >
          <Icon d={PATH.plus} className="h-5 w-5" /> สร้างบันทึก / แบบประเมิน
        </Link>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-600">
          <span>{error}</span>
        </div>
      )}

      {/* Context bar */}
      <div className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 shadow sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">กำลังดู</p>
          <p className="truncate font-semibold text-gray-800">{contextLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(o => !o)}
          aria-expanded={panelOpen}
          className="min-h-[44px] shrink-0 rounded-lg bg-brand-50 px-4 font-medium text-brand-700 transition-colors hover:bg-brand-100"
        >
          {panelOpen ? 'ปิด' : 'เปลี่ยน'}
        </button>
      </div>

      {/* Class + subject: bottom sheet on phone, inline panel on lg+ */}
      {panelOpen && (
        <div
          className="modal-backdrop lg:static lg:z-auto lg:block lg:bg-transparent lg:p-0"
          onClick={(e) => { if (e.target === e.currentTarget) setPanelOpen(false); }}
        >
          <div
            className="modal-panel rounded-b-none p-4 sm:rounded-lg lg:max-h-none lg:max-w-none lg:rounded-lg lg:shadow"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
            role="dialog"
            aria-label="เลือกห้องและวิชา"
          >
            <div className="mb-3 flex items-center justify-between lg:hidden">
              <h2 className="text-base font-semibold text-gray-900">เลือกห้องและวิชา</h2>
              <button type="button" onClick={() => setPanelOpen(false)} className="min-h-[44px] px-3 text-sm text-gray-600">ปิด</button>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <label htmlFor="ll-class" className="mb-1 block text-sm font-medium text-gray-700">ห้องเรียน</label>
                <select
                  id="ll-class"
                  value={classId || ''}
                  onChange={(e) => { setClassId(Number(e.target.value) || null); setSubjectId(null); }}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3"
                >
                  {classes.map(c => <option key={c.id} value={c.id}>{c.className}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ll-subject" className="mb-1 block text-sm font-medium text-gray-700">วิชา</label>
                <select
                  id="ll-subject"
                  value={subjectId || ''}
                  onChange={(e) => setSubjectId(Number(e.target.value) || null)}
                  className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3"
                >
                  <option value="">ทุกวิชา</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.subjectName}</option>)}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="mt-4 min-h-[44px] w-full rounded-lg border border-gray-300 font-medium text-gray-700 hover:bg-gray-50 lg:hidden"
            >
              ดูบันทึก
            </button>
          </div>
        </div>
      )}

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
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="กรองตามประเภท">
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

          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg bg-white shadow">
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

      {/* Secondary actions */}
      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
        <Link to="/lesson-log/export" className={linkBtn}>ส่งออกเป็น Word</Link>
        <Link to="/lesson-log/summary" className={linkBtn}>สรุปผลรายคน</Link>
        <Link to="/lesson-log/templates" className={linkBtn}>แบบประเมิน</Link>
      </div>

      {/* Primary action on phones: above the bottom bar (56px + safe area) */}
      <div
        className="fixed inset-x-0 z-20 px-3 sm:hidden print:hidden"
        style={{ bottom: 'calc(56px + env(safe-area-inset-bottom) + 8px)' }}
      >
        <Link
          to="/lesson-log/new"
          className="mx-auto flex min-h-[48px] max-w-lg items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 font-semibold text-white shadow-lg hover:bg-brand-700"
        >
          <Icon d={PATH.plus} className="h-5 w-5" /> สร้างบันทึก / แบบประเมิน
        </Link>
      </div>
    </div>
  );
};

export default LessonLogHome;
