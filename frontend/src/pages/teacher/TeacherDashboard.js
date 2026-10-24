import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { reportAPI, monitorAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { TeacherWave, StackDone } from '../../components/illustrations';

// หน้าแรกของครู: ทักทาย + สแกน → สรุปวันนี้ → งานที่ต้องติดตาม | วิชาของฉัน

const stripTitle = (name = '') =>
  name.replace(/^(นาย|นางสาว|นาง|น\.ส\.|ครู|ดร\.)\s*/, '').trim();

const thaiDate = () =>
  new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });

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
  <div className="space-y-6 animate-pulse" aria-label="กำลังโหลด">
    <div className="h-14 w-2/3 rounded bg-gray-200" />
    <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <div key={i} className="h-20 rounded-xl bg-gray-200" />)}</div>
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3 h-72 rounded-xl bg-gray-200" />
      <div className="lg:col-span-2 h-72 rounded-xl bg-gray-200" />
    </div>
  </div>
);

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      monitors.forEach((m, i) => {
        if (!m) return;
        (m.tasks || []).forEach(task => {
          let notSubmitted = 0;
          let pending = 0;
          (m.students || []).forEach(st => {
            const status = st.submissions.find(x => x.taskId === task.id)?.status || 'NOT_SUBMITTED';
            if (status === 'NOT_SUBMITTED') notSubmitted += 1;
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
      });
      setStatistics(rows);
      setSubjects(subs);
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const name = stripTitle(user?.teacher?.name || '');
  const subjectById = Object.fromEntries(subjects.map(s => [s.id, s]));

  const totalMissing = statistics.reduce((s, t) => s + (t.notSubmitted || 0), 0);
  const totalPending = statistics.reduce((s, t) => s + (t.pending || 0), 0);
  const totalAll = statistics.reduce((s, t) => s + (t.total || 0), 0);
  const submittedPct = pct(totalAll - totalMissing, totalAll);
  const tasksWithMissing = statistics.filter(t => (t.notSubmitted || 0) > 0);

  // เฉพาะงานที่ยังมีคนไม่ส่ง เรียงค้างมากไปน้อย สูงสุด 5
  const followUp = [...tasksWithMissing]
    .sort((a, b) => b.notSubmitted - a.notSubmitted)
    .slice(0, 5);

  // สรุปรายวิชาจาก statistics
  const subjectStats = (id) => {
    const rows = statistics.filter(t => t.subjectId === id);
    const total = rows.reduce((s, t) => s + (t.total || 0), 0);
    const missing = rows.reduce((s, t) => s + (t.notSubmitted || 0), 0);
    return { total, missing, done: pct(total - missing, total) };
  };

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex items-center gap-3">
        <TeacherWave className="hidden min-[400px]:block h-16 sm:h-20 w-auto shrink-0 text-brand-600" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">สวัสดี ครู{name}</h1>
          <p className="text-sm text-gray-500">{thaiDate()}</p>
        </div>
      </div>
      <Link
        to="/teacher/scan"
        className="flex lg:hidden items-center justify-center gap-2 min-h-[56px] sm:min-h-[48px] w-full sm:w-auto rounded-xl bg-cta px-6 text-cta-fg font-semibold text-lg sm:text-base shadow-sm hover:brightness-95 active:scale-[0.99] transition"
      >
        <ScanIcon className="w-6 h-6 sm:w-5 sm:h-5" />
        สแกนส่งงาน
      </Link>
    </div>
  );

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-700">{error} ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง</p>
          <button
            onClick={fetchData}
            className="mt-3 min-h-[44px] rounded-lg border border-red-300 bg-white px-5 text-red-700 hover:bg-red-50"
          >
            ลองอีกครั้ง
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { label: 'ค้างส่ง', value: `${totalMissing}`, sub: `${tasksWithMissing.length} งาน`, tone: totalMissing > 0 ? 'text-red-600' : 'text-green-600' },
    { label: 'รอตรวจ', value: `${totalPending}`, sub: 'ชิ้น', tone: totalPending > 0 ? 'text-amber-600' : 'text-gray-800' },
    { label: 'ส่งแล้ว', value: `${submittedPct}%`, sub: `${totalAll - totalMissing}/${totalAll}`, tone: 'text-gray-800' },
  ];

  return (
    <div className="space-y-6">
      {header}

      {/* สรุปวันนี้ */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(s => (
          <Link
            key={s.label}
            to="/monitor"
            className="min-h-[44px] rounded-xl bg-white p-3 sm:p-4 shadow-sm ring-1 ring-gray-100 hover:ring-brand-200 transition"
          >
            <div className="text-xs sm:text-sm text-gray-500">{s.label}</div>
            <div className={`text-xl sm:text-2xl font-bold ${s.tone}`}>{s.value}</div>
            <div className="text-xs text-gray-400 truncate">{s.sub}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        {/* งานที่ต้องติดตาม */}
        <section className="lg:col-span-3 bg-white rounded-xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-800">งานที่ต้องติดตาม</h2>
            <Link to="/monitor" className="min-h-[44px] flex items-center text-sm text-brand-600 hover:text-brand-800 shrink-0">ดูทั้งหมด &rarr;</Link>
          </div>
          {followUp.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <StackDone className="mx-auto h-24 w-auto text-brand-600" />
              <p className="mt-2 font-medium text-gray-800">ทุกงานส่งครบแล้ว</p>
              <p className="text-sm text-gray-500">ยังไม่มีนักเรียนค้างส่ง</p>
            </div>
          ) : (
            <ul className="divide-y">
              {followUp.map(t => {
                const sent = (t.total || 0) - t.notSubmitted;
                return (
                  <li key={t.taskId}>
                    <Link
                      to={monitorUrl(subjectById[t.subjectId] || { id: t.subjectId }, t.taskId)}
                      className="flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[56px] hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-800 truncate">{t.taskName}</div>
                        <div className="text-sm text-gray-500 truncate">{t.subjectName}</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 max-w-[12rem]"><Bar value={pct(sent, t.total)} /></div>
                          <span className="text-xs text-gray-500 shrink-0">ส่ง {sent}/{t.total}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xl font-bold text-red-600">{t.notSubmitted}</div>
                        <div className="text-xs text-gray-500">ยังไม่ส่ง</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* วิชาของฉัน */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">วิชาของฉัน</h2>
          {subjects.length === 0 ? (
            <p className="rounded-xl bg-white px-4 py-8 text-center text-gray-500 ring-1 ring-gray-100">ยังไม่มีวิชาที่สอน แจ้งผู้ดูแลระบบให้เพิ่มวิชาให้</p>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {subjects.map(s => {
                const st = subjectStats(s.id);
                const taskCount = s.tasks?.length || 0;
                return (
                  <Link
                    key={s.id}
                    to={monitorUrl(s)}
                    className="block min-h-[44px] rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 hover:ring-brand-200 transition"
                  >
                    <div className="font-medium text-gray-800 leading-snug line-clamp-2 break-words">{s.subjectName}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs text-gray-500">{s.subjectCode} · {taskCount} งาน</span>
                      {st.missing > 0
                        ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">ค้าง {st.missing} ชิ้น</span>
                        : st.total > 0 && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">ครบ</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1"><Bar value={st.done} color={st.done === 100 ? 'bg-green-500' : 'bg-brand-600'} /></div>
                      <span className="text-xs text-gray-600 shrink-0">
                        {st.total > 0 ? `${st.done}% · ${st.total - st.missing}/${st.total}` : taskCount > 0 ? 'ยังไม่มีนักเรียน' : 'ยังไม่มีงาน'}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default TeacherDashboard;
