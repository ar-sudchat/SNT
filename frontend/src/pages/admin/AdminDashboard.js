import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportAPI, academicYearAPI, subjectAPI, teacherAPI, classAPI } from '../../services/api';

// หน้าแรกแอดมิน: ภาพรวมกลุ่ม · ตัวเลขหลัก · วิชาที่ต้องติดตาม · ความพร้อมของระบบ
const fmt = (n) => (Number(n) || 0).toLocaleString('th-TH');
const pct = (a, b) => {
  if (!b) return 0;
  const p = (a / b) * 100;
  return p > 0 && p < 1 ? Math.round(p * 10) / 10 : Math.round(p);
};

const Chevron = () => (
  <svg className="w-5 h-5 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path fillRule="evenodd" d="M7.2 14.8a1 1 0 010-1.4L10.6 10 7.2 6.6a1 1 0 011.4-1.4l4.1 4.1a1 1 0 010 1.4l-4.1 4.1a1 1 0 01-1.4 0z" clipRule="evenodd" />
  </svg>
);

const settled = (p) => p.then((r) => r.data).catch(() => null);

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [overview, statistics, year, subjects, teachers, classes] = await Promise.all([
      settled(reportAPI.adminOverview()),
      settled(reportAPI.adminStatistics()),
      settled(academicYearAPI.getCurrent()),
      settled(subjectAPI.getAll()),
      settled(teacherAPI.getAll()),
      settled(classAPI.getAll())
    ]);
    if (!overview && !statistics) setError('โหลดข้อมูลไม่สำเร็จ ลองใหม่อีกครั้ง');
    setData({ overview, statistics: statistics || [], year, subjects, teachers, classes });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="กำลังโหลด">
        <div className="h-8 w-56 bg-gray-200 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-200 rounded-xl" />)}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const { overview, statistics, year, subjects, teachers, classes } = data;
  const counts = overview?.counts || {};
  const sub = overview?.submissions || {};
  const submitted = (sub.approved || 0) + (sub.pending || 0) + (sub.rejected || 0);
  const expected = overview?.expectedSubmissions || 0;

  // วิชาในปีปัจจุบัน (ถ้ารู้ปี)
  const yearSubjects = Array.isArray(subjects)
    ? subjects.filter((s) => !year?.id || s.academicYearId === year.id)
    : [];
  const subjectByName = new Map(yearSubjects.map((s) => [s.subjectName, s]));
  const subjectById = new Map(yearSubjects.map((s) => [s.id, s]));

  // รวมสถิติรายงาน → รายวิชา
  const bySubject = new Map();
  statistics.forEach((t) => {
    const key = t.subjectId != null ? `id:${t.subjectId}` : `name:${t.subjectName}`;
    const row = bySubject.get(key) || { name: t.subjectName, subjectId: t.subjectId, tasks: 0, done: 0, total: 0, pending: 0 };
    row.tasks += 1;
    row.total += t.total || 0;
    row.done += (t.total || 0) - (t.notSubmitted || 0);
    row.pending += t.pending || 0;
    bySubject.set(key, row);
  });
  const subjectRows = [...bySubject.values()]
    .map((r) => ({ ...r, subject: r.subjectId != null ? subjectById.get(r.subjectId) : subjectByName.get(r.name), rate: r.total ? r.done / r.total : 1 }))
    .filter((r) => !year?.id || r.subject)
    .sort((a, b) => a.rate - b.rate || (b.total - b.done) - (a.total - a.done));

  const yearClasses = Array.isArray(classes) ? classes.filter((c) => !year?.id || c.academicYearId === year.id) : null;
  const classCount = yearClasses ? yearClasses.length : null;
  const teachersNoSubject = Array.isArray(teachers)
    ? teachers.filter((t) => t.status !== 'INACTIVE' && !(t.subjects || []).some((s) => !year?.id || s.academicYearId === year.id)).length
    : null;
  const subjectsNoTask = yearSubjects.filter((s) => (s._count?.tasks || 0) === 0).length;
  const subjectsNoQR = yearSubjects.filter((s) => (s._count?.tasks || 0) > 0 && (s._count?.qrcodes || 0) === 0).length;

  const health = [
    {
      ok: !!year, path: '/admin/academic-years', label: 'ปีการศึกษาปัจจุบัน',
      detail: year ? year.name : 'ยังไม่ได้ตั้งปีปัจจุบัน'
    },
    {
      ok: classCount > 0, path: '/admin/classes', label: 'ห้องเรียน',
      detail: classCount === null ? 'ตรวจไม่ได้' : classCount > 0 ? `${fmt(classCount)} ห้อง` : 'ยังไม่มีห้องเรียน'
    },
    {
      ok: (counts.students || 0) > 0, path: '/admin/import', label: 'รายชื่อนักเรียน',
      detail: counts.students ? `${fmt(counts.students)} คน` : 'ยังไม่ได้นำเข้า'
    },
    {
      ok: teachersNoSubject === 0, path: '/admin/subjects', label: 'ครูมีวิชาสอน',
      detail: teachersNoSubject === null ? 'ตรวจไม่ได้' : teachersNoSubject === 0 ? `ครบทั้ง ${fmt(counts.teachers)} คน` : `${fmt(teachersNoSubject)} คนยังไม่มีวิชา`
    },
    {
      ok: yearSubjects.length > 0 && subjectsNoTask === 0, path: '/admin/tasks', label: 'วิชามีงาน',
      detail: yearSubjects.length === 0 ? 'ยังไม่มีวิชา' : subjectsNoTask === 0 ? `ครบทั้ง ${fmt(yearSubjects.length)} วิชา` : `${fmt(subjectsNoTask)} วิชายังไม่มีงาน`
    },
    {
      ok: yearSubjects.length > 0 && subjectsNoQR === 0, path: '/admin/qrcode', label: 'QR Code',
      detail: yearSubjects.length === 0 ? 'ยังไม่มีวิชา' : subjectsNoQR === 0 ? 'สร้างครบทุกวิชาที่มีงาน' : `${fmt(subjectsNoQR)} วิชายังไม่ได้สร้าง`
    }
  ];
  const healthIssues = health.filter((h) => !h.ok).length;

  const numbers = [
    { to: '/monitor', label: 'ส่งงานแล้ว', value: `${pct(submitted, expected)}%`, sub: `${fmt(submitted)}/${fmt(expected)} ชิ้น` },
    { to: '/monitor', label: 'รอครูตรวจ', value: fmt(sub.pending), sub: `ผ่านแล้ว ${fmt(sub.approved)} · ให้แก้ ${fmt(sub.rejected)}` },
    { to: '/admin/students', label: 'นักเรียน', value: fmt(counts.students), sub: classCount !== null ? `ใน ${fmt(classCount)} ห้อง` : 'คน' },
    { to: '/admin/subjects', label: 'วิชา', value: fmt(yearSubjects.length || counts.subjects), sub: `ครู ${fmt(counts.teachers)} คน · งาน ${fmt(counts.tasks)} ชิ้น` }
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-800">ภาพรวมกลุ่ม</h1>
        <p className="text-sm text-gray-500">{year ? year.name : 'ยังไม่ได้ตั้งปีการศึกษาปัจจุบัน'}</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={load} className="min-h-[44px] px-4 rounded-lg border border-red-300 text-sm font-medium hover:bg-red-100">ลองใหม่</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {numbers.map((n) => (
          <Link key={n.label} to={n.to} className="bg-white rounded-xl shadow p-4 hover:ring-2 hover:ring-brand-300 focus-visible:ring-2 focus-visible:ring-brand-500 outline-none">
            <div className="text-sm text-gray-600">{n.label}</div>
            <div className="text-2xl sm:text-3xl font-bold text-gray-800 tabular-nums">{n.value}</div>
            <div className="text-xs text-gray-500 mt-1">{n.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <section className="bg-white rounded-xl shadow overflow-hidden lg:col-span-2">
          <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">วิชาที่ต้องติดตาม</h2>
              <p className="text-xs text-gray-500">เรียงจากวิชาที่ส่งน้อยที่สุด</p>
            </div>
            <Link to="/monitor" className="min-h-[44px] inline-flex items-center text-sm text-brand-600 hover:text-brand-800 shrink-0">ดูทั้งหมด &rarr;</Link>
          </div>
          {subjectRows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-gray-500">ยังไม่มีวิชาที่มีงาน</p>
              <Link to="/admin/tasks" className="mt-2 inline-flex items-center min-h-[44px] text-sm text-brand-600 hover:text-brand-800">เพิ่มงานให้วิชา &rarr;</Link>
            </div>
          ) : (
            <ul className="divide-y">
              {subjectRows.slice(0, 6).map((r) => {
                const p = pct(r.done, r.total);
                const missing = r.total - r.done;
                const to = r.subject
                  ? `/monitor?mode=subject${r.subject.academicYearId ? `&ay=${r.subject.academicYearId}` : ''}&subject=${r.subject.id}`
                  : '/monitor';
                return (
                  <li key={r.subjectId ?? r.name}>
                    <Link to={to} className="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] hover:bg-gray-50">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-gray-800 truncate">{r.name}</span>
                          <span className="text-sm text-gray-600 shrink-0 tabular-nums">ส่ง {fmt(r.done)}/{fmt(r.total)}</span>
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {r.subject?.teacher?.name || 'ยังไม่มีครูผู้สอน'} · {fmt(r.tasks)} งาน
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, p)}%` }} />
                          </div>
                          <span className={`text-xs shrink-0 tabular-nums ${missing > 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {missing > 0 ? `ขาด ${fmt(missing)}` : 'ครบ'}
                          </span>
                        </div>
                      </div>
                      <Chevron />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">ความพร้อมของระบบ</h2>
              <p className="text-xs text-gray-500">{healthIssues === 0 ? 'พร้อมใช้งานครบทุกข้อ' : `ต้องแก้ ${healthIssues} ข้อ`}</p>
            </div>
            <Link to="/admin/settings" className="min-h-[44px] inline-flex items-center text-sm text-brand-600 hover:text-brand-800 shrink-0">ตั้งค่า &rarr;</Link>
          </div>
          <ul className="divide-y">
            {health.map((h) => (
              <li key={h.label}>
                <Link to={h.path} className="flex items-center gap-3 px-4 sm:px-6 py-3 min-h-[44px] hover:bg-gray-50">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${h.ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                    aria-label={h.ok ? 'พร้อม' : 'ต้องแก้'}
                  >
                    {h.ok ? '✓' : '!'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-800">{h.label}</div>
                    <div className={`text-xs truncate ${h.ok ? 'text-gray-500' : 'text-amber-700'}`}>{h.detail}</div>
                  </div>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
