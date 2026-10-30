import { t, dateLocale } from '../../i18n';
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportAPI, monitorAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TeacherWave } from '../../components/illustrations';

// หน้าแรกของครู: ทักทาย + เช็คชื่อ/สแกน → การ์ดต่อวิชา (ค้างกี่คน กี่งาน) แตะเข้าไปดูรายวิชา

const stripTitle = (name = '') =>
  name.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ครู|ดร\.)\s*/, '').trim();

const thaiDate = () =>
  new Date().toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

const monitorUrl = (subject, taskId) => {
  if (!subject) return '/monitor';
  const p = new URLSearchParams({ subject: subject.id });
  if (subject.gradeId) p.set('grade', subject.gradeId);
  if (subject.academicYearId) p.set('ay', subject.academicYearId);
  if (taskId) p.set('task', taskId);
  return `/monitor?${p.toString()}`;
};

const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : 0);

const ScanIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const Bar = ({ value, color = 'bg-brand-600' }) => (
  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

const Skeleton = () => (
  <div className="space-y-4 animate-pulse" aria-label={t("กำลังโหลด")}>
    <div className="h-14 w-2/3 rounded bg-gray-200" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-32 rounded-xl bg-gray-200" />)}</div>
  </div>
);

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjectSums, setSubjectSums] = useState({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const subjectsRes = await reportAPI.teacherSubjects();
      const subs = subjectsRes.data || [];
      // ใช้ข้อมูลชุดเดียวกับหน้า /monitor/subject เพื่อให้ตัวเลขตรงกัน:
      // ส่งแล้ว = สถานะใดๆ ที่ไม่ใช่ NOT_SUBMITTED, ทั้งหมด = งาน × นักเรียนในรายวิชา
      const monitors = await Promise.all(subs.map(s =>
        monitorAPI.getSubjectMonitor(s.id).then(r => r.data).catch(() => null)
      ));
      const rows = [];
      const sums = {};
      monitors.forEach((m, i) => {
        if (!m) return;
        const missingStudents = new Set();
        (m.tasks || []).forEach(task => {
          let notSubmitted = 0;
          let pending = 0;
          (m.students || []).forEach(st => {
            const status = st.submissions.find(x => x.taskId === task.id)?.status || 'NOT_SUBMITTED';
            if (status === 'NOT_SUBMITTED') { notSubmitted += 1; missingStudents.add(st.studentId ?? st.id); }
            else if (status === 'PENDING') pending += 1;
          });
          rows.push({
            taskId: task.id,
            taskName: task.taskName,
            subjectId: subs[i].id,
            subjectName: subs[i].subjectName,
            notSubmitted,
            pending,
            total: (m.students || []).length
          });
        });
        const byClass = {};
        (m.students || []).forEach(st => {
          const c = byClass[st.classId] || (byClass[st.classId] = { id: st.classId, name: st.className, missing: 0, total: 0 });
          c.total += 1;
          if (st.submissions.some(x => x.status === 'NOT_SUBMITTED')) c.missing += 1;
        });
        sums[subs[i].id] = {
          students: missingStudents.size,
          rooms: Object.values(byClass).sort((a, b) => String(a.name).localeCompare(String(b.name), 'th', { numeric: true }))
        };
      });
      setStatistics(rows);
      setSubjectSums(sums);
      setSubjects(subs);
    } catch (err) {
      // ไม่มี response = ต่อเซิร์ฟเวอร์ไม่ได้ (เน็ต) · มี response = เซิร์ฟเวอร์ตอบข้อผิดพลาดกลับมา
      setError(err?.response
        ? t('โหลดข้อมูลไม่สำเร็จ{value1} ลองใหม่อีกครั้ง', { value1: err.response.data?.error ? ` (${err.response.data.error})` : '' })
        : t('โหลดข้อมูลไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const name = stripTitle(user?.teacher?.name || '');

  // สรุปรายวิชาจาก statistics
  const subjectStats = (id) => {
    const rows = statistics.filter(t => t.subjectId === id);
    const total = rows.reduce((s, t) => s + (t.total || 0), 0);
    const missing = rows.reduce((s, t) => s + (t.notSubmitted || 0), 0);
    const pending = rows.reduce((s, t) => s + (t.pending || 0), 0);
    return {
      total, missing, pending, done: pct(total - missing, total),
      students: subjectSums[id]?.students || 0,
      rooms: (subjectSums[id]?.rooms || []).filter(r => r.total > 0),
      tasks: rows.filter(t => (t.notSubmitted || 0) > 0).length,
      taskCount: rows.length
    };
  };

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex items-center gap-3">
        <TeacherWave className="hidden min-[400px]:block h-16 sm:h-20 w-auto shrink-0 text-brand-600" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{t('สวัสดี ครู{value1}', { value1: name })}</h1>
          <p className="text-sm text-gray-500">{thaiDate()}</p>
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:w-auto lg:hidden">
        <Link
          to="/attendance"
          className="flex items-center justify-center gap-2 min-h-[56px] sm:min-h-[48px] rounded-xl border border-brand-300 bg-white px-5 text-brand-700 font-semibold text-lg sm:text-base hover:bg-brand-50 active:scale-[0.99] transition"
        >{t('เช็คชื่อ')}</Link>
        <Link
          to="/teacher/scan"
          className="flex items-center justify-center gap-2 min-h-[56px] sm:min-h-[48px] rounded-xl bg-cta px-5 text-cta-fg font-semibold text-lg sm:text-base shadow-sm hover:brightness-95 active:scale-[0.99] transition"
        >
          <ScanIcon className="w-6 h-6 sm:w-5 sm:h-5" />{t('สแกนงาน')}</Link>
      </div>
    </div>
  );

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 min-h-[44px] rounded-lg border border-red-300 bg-white px-5 text-red-700 hover:bg-red-50"
          >{t('ลองอีกครั้ง')}</button>
        </div>
      </div>
    );
  }

  // กลุ่มใหม่ / ครูที่ยังไม่มีวิชา: บอกขั้นต่อไปแทนตัวเลขศูนย์
  if (subjects.length === 0) {
    const canManage = !!user?.canManage;
    const steps = [
      { n: 1, title: t('สร้างวิชาที่สอน'), desc: t('ตั้งชื่อวิชาและรหัสวิชา ครูผู้สอนคือคุณ'), to: '/admin/subjects?new=1' },
      { n: 2, title: t('เพิ่มห้องและนักเรียน'), desc: t('พิมพ์เองหรือนำเข้ารายชื่อจาก Excel'), to: '/admin/import' },
      { n: 3, title: t('สร้างงานแล้วสแกนสมุด'), desc: t('รู้ทันทีว่าใครส่งแล้ว ใครยังค้าง'), to: '/admin/tasks' },
    ];
    return (
      <div className="space-y-4">
        {header}
        <section className="rounded-xl bg-white p-5 sm:p-8 shadow-sm ring-1 ring-gray-100" aria-labelledby="td-empty">
          <div className="max-w-xl">
            <h2 id="td-empty" className="text-xl font-bold text-gray-900">{t('ยังไม่มีวิชา — เริ่มต้นสร้างวิชาแรก')}</h2>
            {canManage ? (
              <>
                <p className="mt-1 text-gray-600">{t('ตั้งค่าครั้งเดียว 3 ขั้น แล้วเริ่มสแกนส่งงานได้เลย')}</p>
                <ol className="mt-5 space-y-2">
                  {steps.map(s => (
                    <li key={s.n}>
                      <Link to={s.to} className="flex min-h-[56px] items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-gray-100 hover:bg-gray-50 hover:ring-brand-200 transition">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{s.n}</span>
                        <span className="min-w-0">
                          <span className="block font-medium text-gray-800">{s.title}</span>
                          <span className="block text-sm text-gray-500">{s.desc}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Link to="/admin/subjects?new=1" className="flex min-h-[48px] items-center justify-center rounded-xl bg-cta px-6 font-semibold text-cta-fg shadow-sm hover:brightness-95">{t('สร้างวิชาแรก')}</Link>
                </div>
              </>
            ) : (
              <>
                <p className="mt-1 text-gray-600">{t('เจ้าของหรือผู้ดูแลกลุ่มเป็นคนเพิ่มวิชา แล้วเลือกให้คุณเป็นครูผู้สอน เมื่อเพิ่มแล้ววิชาจะขึ้นที่หน้านี้')}</p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Link to="/group" className="flex min-h-[48px] items-center justify-center rounded-xl bg-cta px-6 font-semibold text-cta-fg shadow-sm hover:brightness-95">{t('ดูสมาชิกกลุ่ม')}</Link>
                  <button onClick={fetchData} className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-6 text-gray-700 hover:bg-gray-50">{t('โหลดใหม่')}</button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      {/* การ์ดต่อวิชา: ค้างกี่คน กี่งาน · แตะเข้าไปดูรายวิชา */}
      <section aria-label={t('วิชาของฉัน')}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-800">{t('วิชาของฉัน')}</h2>
          <Link to="/monitor" className="min-h-[44px] flex items-center text-sm text-brand-600 hover:text-brand-800 shrink-0">{t('ตรวจงานทั้งหมด →')}</Link>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map(s => {
            const st = subjectStats(s.id);
            const allDone = st.taskCount > 0 && st.missing === 0;
            return (
              <div key={s.id} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-100 hover:ring-brand-200 transition">
              <Link to={monitorUrl(s)} className="block min-h-[44px] p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 leading-snug line-clamp-2 break-words">{s.subjectName}</div>
                    <div className="text-xs text-gray-500">{s.subjectCode}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    {st.taskCount === 0 ? (
                      <div className="text-sm text-gray-500">{t('ยังไม่มีงาน')}</div>
                    ) : allDone ? (
                      <div className="text-lg font-bold text-green-600">{t('ครบ')}</div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold leading-none text-red-600">{st.students}</div>
                        <div className="text-xs text-gray-500">{t('คนค้างส่ง')}</div>
                      </>
                    )}
                  </div>
                </div>
                {st.taskCount > 0 && (
                  <>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1"><Bar value={st.done} color={st.done === 100 ? 'bg-green-500' : 'bg-brand-600'} /></div>
                      <span className="shrink-0 text-xs text-gray-600">{st.done}%</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      {st.tasks > 0 && <span>{t('{value1} งานที่ยังค้าง', { value1: st.tasks })}</span>}
                      {st.pending > 0 && <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-700">{t('รอตรวจ {value1} ชิ้น', { value1: st.pending })}</span>}
                    </div>
                  </>
                )}
              </Link>
              {st.rooms.length > 1 && st.taskCount > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pb-4" role="group" aria-label={t('แยกตามห้อง')}>
                  {st.rooms.map(r => (
                    <Link
                      key={r.id}
                      to={`${monitorUrl(s)}&class=${r.id}`}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ${r.missing > 0 ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-green-50 text-green-700 ring-green-100'}`}
                    >
                      <span>{r.name}</span>
                      <span className="font-bold">{r.missing > 0 ? t('ค้าง {value1}', { value1: r.missing }) : '✓'}</span>
                    </Link>
                  ))}
                </div>
              )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default TeacherDashboard;
