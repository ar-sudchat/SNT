import { t, tMsg, tx, dateLocale } from '../../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import Logo from '../../components/brand/Logo';
import LanguagePicker from '../../components/LanguagePicker';
import { parentAPI } from '../../services/parentApi';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: '2-digit' }) : null;
const fmtDateTime = (d) => new Date(d).toLocaleString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const TONE = {
  APPROVED: 'text-green-800 bg-green-50',
  PENDING: 'text-yellow-800 bg-yellow-50',
  REJECTED: 'text-red-700 bg-red-50',
  NOT_SUBMITTED: 'text-gray-700 bg-gray-100',
};
const ICON = { APPROVED: '✓', PENDING: '…', REJECTED: '!', NOT_SUBMITTED: '○' };
const isMissing = (task) => task.status === 'NOT_SUBMITTED' || task.status === 'REJECTED';

function TaskRow({ task, showSubject }) {
  const overdue = task.overdue;
  return (
    <li className={`flex items-start justify-between gap-3 py-3 ${overdue ? 'border-l-4 border-red-500 pl-3 -ml-1' : ''}`}>
      <div className="min-w-0">
        {showSubject && <p className="text-xs text-gray-500">{task.subjectName}</p>}
        <p className="text-base text-gray-900 break-words">{task.taskName}</p>
        {task.deadline && (
          <p className={`text-sm ${overdue ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>
            {overdue ? t('เลยกำหนดส่ง {date}', { date: fmtDate(task.deadline) }) : t('กำหนดส่ง {date}', { date: fmtDate(task.deadline) })}
          </p>
        )}
      </div>
      <span className={`shrink-0 inline-flex items-center gap-1 rounded px-2 py-1 text-sm font-medium ${overdue ? 'text-red-700 bg-red-50' : TONE[task.status]}`}>
        <span aria-hidden="true">{ICON[task.status]}</span>{tMsg(task.statusText)}
      </span>
    </li>
  );
}

export default function ParentView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    parentAPI.getPublic(token)
      .then(r => { if (alive) setData(r.data); })
      .catch(e => { if (alive) setError(e.response?.data?.error || t('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')); });
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    document.title = data ? t('งานของ {firstName}', { firstName: data.student.firstName }) : t('ติดตามงานนักเรียน');
  }, [data]);

  const missing = useMemo(() => {
    if (!data) return [];
    return data.subjects
      .flatMap(s => s.tasks.map(task => ({ ...task, subjectName: s.subjectName })))
      .filter(isMissing)
      .sort((a, b) => (b.overdue - a.overdue) || ((a.deadline ? new Date(a.deadline) : Infinity) - (b.deadline ? new Date(b.deadline) : Infinity)));
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-xl px-4 py-3 flex items-center justify-between gap-3">
          <Logo size={32} tone="color" tagline={false} />
          <LanguagePicker />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5 space-y-5">
        {!data && !error && <p role="status" className="text-center text-gray-500 py-16">{t('กำลังโหลด…')}</p>}

        {error && (
          <div role="alert" className="rounded-lg bg-white border border-gray-200 p-6 text-center">
            <p className="text-lg font-semibold text-gray-900">{error}</p>
            <p className="mt-2 text-sm text-gray-600">{t('กรุณาติดต่อครูประจำชั้นเพื่อขอลิงก์ใหม่')}</p>
          </div>
        )}

        {data && (
          <>
            <section>
              <h1 className="text-2xl font-bold">{t('งานของ {firstName}', { firstName: data.student.firstName })}</h1>
              <p className="text-sm text-gray-600">{t('ห้อง {className}', { className: data.student.className })}{data.academicYear ? ` · ${data.academicYear}` : ''}</p>
            </section>

            <section className="rounded-lg bg-white border border-gray-200 p-4" aria-label={t("สรุป")}>
              <p className="text-lg font-semibold">{t('ส่งแล้ว {value1}/{total}', { value1: data.summary.submitted - data.summary.rejected, total: data.summary.total })}<span className="text-gray-400"> · </span>
                <span className={data.summary.missing ? 'text-red-700' : 'text-green-700'}>{t('ค้าง {missing}', { missing: data.summary.missing })}</span>
              </p>
              {data.summary.total > 0 && (
                <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-brand-600" style={{ width: `${Math.round(100 * (data.summary.total - data.summary.missing) / data.summary.total)}%` }} />
                </div>
              )}
              {data.summary.overdue > 0 && <p className="mt-2 text-sm text-red-700">{t('เลยกำหนดส่งแล้ว {overdue} งาน', { overdue: data.summary.overdue })}</p>}
              {data.summary.pending > 0 && <p className="mt-1 text-sm text-gray-600">{t('รอครูตรวจ {pending} งาน', { pending: data.summary.pending })}</p>}
            </section>

            {missing.length > 0 ? (
              <section className="rounded-lg bg-white border border-red-200 px-4">
                <h2 className="pt-4 text-base font-semibold text-red-800">{t('งานที่ยังค้าง ({length})', { length: missing.length })}</h2>
                <ul className="divide-y divide-gray-100">
                  {missing.map((task, i) => <TaskRow key={`${task.subjectName}-${task.taskNumber}-${i}`} task={task} showSubject />)}
                </ul>
              </section>
            ) : data.summary.total > 0 && (
              <p className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 font-medium">{t('ส่งงานครบทุกชิ้นแล้ว เยี่ยมมาก')}</p>
            )}

            <section className="space-y-3">
              <h2 className="text-base font-semibold">{t('แยกตามวิชา')}</h2>
              {data.subjects.length === 0 && <p className="text-sm text-gray-600">{t('ยังไม่มีงานในปีการศึกษานี้')}</p>}
              {data.subjects.map((s, i) => {
                const left = s.tasks.filter(isMissing).length;
                return (
                  <details key={i} className="rounded-lg bg-white border border-gray-200 px-4 group" open={left > 0}>
                    <summary className="flex items-center justify-between gap-3 py-3 min-h-[44px] cursor-pointer list-none">
                      <span className="font-medium break-words">{s.subjectName}</span>
                      <span className={`shrink-0 text-sm ${left ? 'text-red-700' : 'text-green-700'}`}>
                        {left ? t('ค้าง {left}', { left: left }) : t('ครบ')}{t(' · {length} งาน', { length: s.tasks.length })}</span>
                    </summary>
                    <ul className="divide-y divide-gray-100 border-t border-gray-100">
                      {s.tasks.map(task => <TaskRow key={task.taskNumber} task={task} />)}
                    </ul>
                  </details>
                );
              })}
            </section>

            <footer className="pt-2 pb-8 text-center text-xs text-gray-500 space-y-1">
              <p>{t('ข้อมูลอัปเดตเมื่อ {value1}', { value1: fmtDateTime(data.generatedAt) })}</p>
              <p>{tx('หน้านี้สำหรับดูอย่างเดียว · ลิงก์ใช้ได้ถึง {date} · <a>ความเป็นส่วนตัว</a>', { date: fmtDate(data.expiresAt), a: (c) => <a href="/privacy" className="underline">{c}</a> })}</p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
