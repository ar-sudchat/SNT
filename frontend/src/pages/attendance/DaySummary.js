import { t } from '../../i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { attendanceAPI, reportAPI, academicYearAPI, classAPI } from '../../services/api';
import { PageHeader, SmartComboBox } from '../../components/ui';
import { todayIso, loadSubjects, errorOf, saveBlob } from './shared';

const TABS = [
  { id: 'submissions', label: 'ส่งงานรายวัน' },
  { id: 'subject', label: 'เข้าเรียนรายวิชา' },
  { id: 'day', label: 'มาเรียนรายวัน' }
];
const field = 'min-h-[44px] w-full rounded-lg border border-gray-300 px-3';
const Label = ({ id, children }) => <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{children}</label>;
const Bar = ({ value }) => (
  <div className="h-2 w-full rounded-full bg-gray-100"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${Math.min(100, value)}%` }} /></div>
);
const pctOf = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// สรุปส่งงานของวันหนึ่ง: วันนี้ส่งกี่คน แยกตามวิชา และตามงาน
const Submissions = ({ subjects }) => {
  const [date, setDate] = useState(todayIso());
  const [subjectId, setSubjectId] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const params = { date, ...(subjectId ? { subjectId } : {}) };

  useEffect(() => {
    let live = true;
    reportAPI.daySubmissions({ date, ...(subjectId ? { subjectId } : {}) })
      .then(r => { if (live) { setData(r.data); setError(''); } })
      .catch(err => { if (live) setError(errorOf(err, t('โหลดข้อมูลไม่สำเร็จ'))); });
    return () => { live = false; };
  }, [date, subjectId]);

  const download = async () => {
    try { saveBlob((await reportAPI.exportDaySubmissions(params)).data, `ส่งงาน-${date}.xlsx`); } catch (err) { setError(t('ไม่มีข้อมูลให้ส่งออก')); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div><Label id="sum-date">{t('วันที่')}</Label><input id="sum-date" type="date" value={date} max={todayIso()} onChange={e => e.target.value && setDate(e.target.value)} className={field} /></div>
        <div><Label>{t('วิชา')}</Label><SmartComboBox options={subjects} value={subjectId} onChange={setSubjectId} labelKey="label" valueKey="id" placeholder={t('ทุกวิชา')} title={t('เลือกวิชา')} allLabel={t('ทุกวิชา')} /></div>
        <div className="col-span-2 flex items-end sm:col-span-1"><button type="button" onClick={download} className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-4 font-medium hover:bg-gray-50">{t('ดาวน์โหลด Excel')}</button></div>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><div className="text-sm text-gray-500">{t('นักเรียนที่ส่ง')}</div><div className="text-3xl font-bold text-gray-800">{data.totals.students}</div><div className="text-xs text-gray-400">{t('คน (นับซ้ำข้ามวิชา)')}</div></div>
            <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100"><div className="text-sm text-gray-500">{t('จำนวนชิ้น')}</div><div className="text-3xl font-bold text-gray-800">{data.totals.pieces}</div><div className="text-xs text-gray-400">{t('ชิ้นงาน')}</div></div>
          </div>
          {data.subjects.length === 0 && <p className="rounded-xl bg-white px-4 py-8 text-center text-gray-500 ring-1 ring-gray-100">{t('ยังไม่มีวิชา')}</p>}
          {data.subjects.map(s => (
            <section key={s.subjectId} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <h2 className="min-w-0 truncate font-semibold text-gray-800">{s.subjectCode} {s.subjectName}</h2>
                <span className="shrink-0 text-sm text-gray-600">{t('ส่ง {students} คน · {pieces} ชิ้น', { students: s.students, pieces: s.pieces })}</span>
              </div>
              <ul className="divide-y">
                {s.tasks.map(k => (
                  <li key={k.taskId} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1"><div className="truncate text-gray-800">{k.taskName}</div><div className="mt-1 max-w-[14rem]"><Bar value={pctOf(k.count, k.total)} /></div></div>
                    <div className="shrink-0 text-right"><div className="text-lg font-bold text-gray-800">{k.count}</div><div className="text-xs text-gray-400">/ {k.total}</div></div>
                  </li>
                ))}
                {s.tasks.length === 0 && <li className="px-4 py-3 text-sm text-gray-400">{t('ยังไม่มีงาน')}</li>}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
};

// สรุปการเข้าเรียน: รายวิชา (scope=subject) หรือมาเรียนรายวัน (scope=day) · รายวัน | รายบุคคล · ทั้งปีการศึกษา
const Attendance = ({ scope, subjects, years, classes }) => {
  const [view, setView] = useState('student');
  const [yearId, setYearId] = useState(null);
  const [subjectId, setSubjectId] = useState(null);
  const [classId, setClassId] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { const cur = years.find(y => y.isCurrent); if (cur) setYearId(cur.id); }, [years]);

  const params = {
    ...(yearId ? { academicYearId: yearId } : {}), ...(classId ? { classId } : {}),
    ...(scope === 'subject' && subjectId ? { subjectId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {})
  };
  const key = JSON.stringify(params) + scope;
  const load = useCallback(async () => {
    try {
      const r = scope === 'day' ? await attendanceAPI.daySummary(params) : await attendanceAPI.summary(params);
      setData(r.data); setError('');
    } catch (err) { setError(errorOf(err, t('โหลดข้อมูลไม่สำเร็จ'))); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { load(); }, [load]);

  const download = async () => {
    try {
      const r = scope === 'day' ? await attendanceAPI.dayExport(params) : await attendanceAPI.exportXlsx(params);
      saveBlob(r.data, scope === 'day' ? 'มาเรียนรายวัน.xlsx' : 'เข้าเรียนรายวิชา.xlsx');
    } catch (err) { setError(t('ไม่มีข้อมูลให้ส่งออก')); }
  };

  const th = 'px-3 py-2 text-left text-xs font-semibold text-gray-600';
  const td = 'px-3 py-2 text-sm';
  const hasRows = data && (view === 'day' ? data.days.length : data.students.length);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div>
          <Label id="at-year">{t('ปีการศึกษา')}</Label>
          <select id="at-year" value={yearId || ''} onChange={e => setYearId(e.target.value ? Number(e.target.value) : null)} className={field}>
            <option value="">{t('ทั้งหมด')}</option>
            {years.map(y => <option key={y.id} value={y.id}>{y.name || y.year}</option>)}
          </select>
        </div>
        {scope === 'subject'
          ? <div><Label>{t('วิชา')}</Label><SmartComboBox options={subjects} value={subjectId} onChange={setSubjectId} labelKey="label" valueKey="id" placeholder={t('ทุกวิชา')} title={t('เลือกวิชา')} allLabel={t('ทุกวิชา')} /></div>
          : <div><Label>{t('ห้อง')}</Label><SmartComboBox options={classes} value={classId} onChange={setClassId} labelKey="label" valueKey="id" placeholder={t('ทุกห้อง')} title={t('เลือกห้อง')} allLabel={t('ทุกห้อง')} /></div>}
        <div><Label id="at-from">{t('ตั้งแต่วันที่')}</Label><input id="at-from" type="date" value={from} onChange={e => setFrom(e.target.value)} className={field} /></div>
        <div><Label id="at-to">{t('ถึงวันที่')}</Label><input id="at-to" type="date" value={to} onChange={e => setTo(e.target.value)} className={field} /></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('มุมมอง')} className="inline-flex rounded-lg bg-gray-100 p-1">
          {[['student', 'รายบุคคล'], ['day', 'รายวัน']].map(([id, lbl]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
              className={`min-h-[44px] min-w-[5.5rem] rounded-md px-4 text-sm font-medium ${view === id ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600'}`}>{t(lbl)}</button>
          ))}
        </div>
        <button type="button" onClick={download} className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 font-medium hover:bg-gray-50">{t('ดาวน์โหลด Excel')}</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {data && !hasRows && <p className="rounded-xl bg-white px-4 py-8 text-center text-gray-500 ring-1 ring-gray-100">{t('ยังไม่มีข้อมูลการเช็คชื่อในช่วงนี้')}</p>}
      {hasRows ? (
        <>
          {view === 'day' ? (
            <>
            <ul className="divide-y overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 sm:hidden">
              {data.days.map(d => (
                <li key={`${d.date}-${d.subjectId || d.classId}`} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><div className="truncate font-medium text-gray-800">{d.subjectName || d.className}</div><div className="text-sm text-gray-500">{d.date}</div></div>
                  <div className="shrink-0 text-right text-sm"><span className="font-semibold text-green-700">{t('มา')} {d.present}</span> <span className="text-red-600">{t('ไม่มา')} {d.absent}</span><div className="text-xs text-gray-400">{t('ทั้งหมด')} {d.total}</div></div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100 sm:block"><table className="min-w-full divide-y">
              <thead className="bg-gray-50"><tr><th className={th}>{t('วันที่')}</th><th className={th}>{scope === 'day' ? t('ห้อง') : t('วิชา')}</th><th className={th}>{t('มา')}</th><th className={th}>{t('ไม่มา')}</th><th className={th}>{t('ทั้งหมด')}</th></tr></thead>
              <tbody className="divide-y">
                {data.days.map(d => (
                  <tr key={`${d.date}-${d.subjectId || d.classId}`}><td className={td}>{d.date}</td><td className={td}>{d.subjectName || d.className}</td><td className={`${td} text-green-700`}>{d.present}</td><td className={`${td} text-red-600`}>{d.absent}</td><td className={td}>{d.total}</td></tr>
                ))}
              </tbody>
            </table></div>
            </>
          ) : (
            <>
            <ul className="divide-y overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-100 sm:hidden">
              {data.students.map(s => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1"><div className="truncate font-medium text-gray-800">{s.studentNumber ? `${s.studentNumber}. ` : ''}{s.name}</div><div className="truncate text-sm text-gray-500">{s.className} · <span className="text-green-700">{t('มา')} {s.present}</span> · <span className="text-red-600">{t('ไม่มา')} {s.absent}</span> / {s.classDays}</div></div>
                  <div className={`shrink-0 text-lg font-bold ${s.percent < 80 ? 'text-red-600' : 'text-gray-800'}`}>{s.percent}%</div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100 sm:block"><table className="min-w-full divide-y">
              <thead className="bg-gray-50"><tr><th className={th}>{t('เลขที่')}</th><th className={th}>{t('ชื่อ')}</th><th className={th}>{t('ห้อง')}</th><th className={th}>{t('มา')}</th><th className={th}>{t('ไม่มา')}</th><th className={th}>{t('จำนวนคาบ/วัน')}</th><th className={th}>{t('% มา')}</th></tr></thead>
              <tbody className="divide-y">
                {data.students.map(s => (
                  <tr key={s.id}><td className={td}>{s.studentNumber || ''}</td><td className={td}>{s.name}</td><td className={td}>{s.className}</td><td className={`${td} text-green-700`}>{s.present}</td><td className={`${td} text-red-600`}>{s.absent}</td><td className={td}>{s.classDays}</td><td className={`${td} font-medium ${s.percent < 80 ? 'text-red-600' : 'text-gray-800'}`}>{s.percent}%</td></tr>
                ))}
              </tbody>
            </table></div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
};

const DaySummary = () => {
  const { user } = useAuth();
  const seesAll = user?.role === 'ADMIN' || !!user?.canManage;
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(x => x.id === params.get('tab')) ? params.get('tab') : params.get('tab') === 'attendance' ? 'subject' : 'submissions';
  const [subjects, setSubjects] = useState([]);
  const [years, setYears] = useState([]);
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    loadSubjects(seesAll).then(setSubjects).catch(() => {});
    academicYearAPI.getAll().then(r => setYears(r.data || [])).catch(() => {});
    classAPI.getAll({ status: 'ACTIVE' }).then(r => setClasses((r.data || []).map(c => ({ id: c.id, label: c.className })))).catch(() => {});
  }, [seesAll]);

  return (
    <div className="space-y-4">
      <PageHeader title={t('สรุปรายวัน')} subtitle={t('ส่งงานกี่คน · เข้าเรียนกี่คน แยกตามวิชาหรืองาน')} />
      <div role="tablist" aria-label={t('หมวดสรุป')} className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 sm:inline-grid">
        {TABS.map(x => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} onClick={() => setParams({ tab: x.id })}
            className={`min-h-[44px] rounded-md px-2 text-center text-sm font-medium leading-tight sm:px-4 ${tab === x.id ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600'}`}>{t(x.label)}</button>
        ))}
      </div>
      {tab === 'submissions' ? <Submissions subjects={subjects} /> : <Attendance key={tab} scope={tab} subjects={subjects} years={years} classes={classes} />}
    </div>
  );
};

export default DaySummary;
