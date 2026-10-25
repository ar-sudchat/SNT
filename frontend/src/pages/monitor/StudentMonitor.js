import { t, t as translate, dateLocale } from '../../i18n';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { monitorAPI, submissionAPI } from '../../services/api';
import Logo from '../../components/brand/Logo';
import ParentLinkPanel from './ParentLinkPanel';
import { SmartComboBox } from '../../components/ui';
import {
  STATUS_META, STATUS_ORDER, statusOf, isMissing, fmtDate, fmtDateTh, isOverdue, buildParentMessage, copyText
} from './studentMonitorHelpers';

const BADGE = {
  APPROVED: 'text-green-800 bg-green-50 print:bg-transparent',
  PENDING: 'text-yellow-800 bg-yellow-50 print:bg-transparent',
  REJECTED: 'text-red-700 bg-red-50 print:bg-transparent',
  NOT_SUBMITTED: 'text-gray-600 bg-gray-100 print:bg-transparent'
};

const StatusText = ({ status }) => (
  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium whitespace-nowrap print:px-0 ${BADGE[status]}`}>
    <span aria-hidden="true">{STATUS_META[status].icon}</span>{t(STATUS_META[status].label)}
  </span>
);

// รายงานนักเรียนรายคน (read-only, print-friendly)
const StudentMonitor = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fromAy = searchParams.get('fromAy');
  const fromClass = searchParams.get('fromClass');
  const fromSubject = searchParams.get('fromSubject');

  const handleBack = () => {
    if (fromClass || fromAy) {
      const params = new URLSearchParams();
      params.set('mode', 'class');
      if (fromAy) params.set('ay', fromAy);
      if (fromClass) params.set('class', fromClass);
      if (fromSubject) params.set('subject', fromSubject);
      navigate(`/monitor?${params.toString()}`);
    } else {
      navigate(-1);
    }
  };

  const [data, setData] = useState(null);
  const [scores, setScores] = useState({}); // taskId -> { score, scoringType, maxScore }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subjectFilter, setSubjectFilter] = useState(() => searchParams.get('subjectId') || '');
  const [toast, setToast] = useState('');
  const [manualCopy, setManualCopy] = useState('');
  const toastTimer = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await monitorAPI.getStudentMonitor(id);
      setData(response.data);
      try {
        const subs = await submissionAPI.getAll({ studentId: id });
        const map = {};
        (subs.data || []).forEach(s => {
          map[s.taskId] = { score: s.score, scoringType: s.task?.scoringType, maxScore: s.task?.maxScore };
        });
        setScores(map);
      } catch (e) {
        // scores are optional in the report
      }
    } catch (err) {
      setError(err.response?.data?.error || t('ไม่สามารถโหลดข้อมูลได้'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (t) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  };

  const subjects = useMemo(() => {
    const list = data?.subjects || [];
    const f = subjectFilter ? list.filter(s => String(s.id) === subjectFilter) : list;
    return f.map(s => ({ ...s, tasks: [...(s.tasks || [])].sort((a, b) => a.taskNumber - b.taskNumber) }));
  }, [data, subjectFilter]);

  const totalMissingAll = useMemo(
    () => (data?.subjects || []).flatMap(s => s.tasks || []).filter(isMissing).length,
    [data]
  );

  const stats = useMemo(() => {
    const all = subjects.flatMap(s => s.tasks);
    const submitted = all.filter(t => !isMissing(t)).length;
    const byStatus = Object.fromEntries(STATUS_ORDER.map(k => [k, all.filter(t => statusOf(t) === k).length]));
    return { total: all.length, submitted, missing: all.length - submitted, pct: all.length ? Math.round((submitted / all.length) * 100) : 0, byStatus };
  }, [subjects]);

  const missingList = useMemo(
    () => subjects.flatMap(s => s.tasks.filter(isMissing).map(t => ({ subject: s, task: t })))
      .sort((a, b) => (a.task.deadline ? new Date(a.task.deadline) : Infinity) - (b.task.deadline ? new Date(b.task.deadline) : Infinity)),
    [subjects]
  );

  const scoreText = (task) => {
    const s = scores[task.id];
    if (!s || s.scoringType !== 'SCORED' || s.score === null || s.score === undefined) return '';
    return `${s.score}/${s.maxScore || 100}`;
  };

  const handleCopyParent = async () => {
    const msg = buildParentMessage(data.student, missingList);
    if (await copyText(msg)) { setManualCopy(''); showToast(t('คัดลอกข้อความแล้ว วางในแชทผู้ปกครองได้เลย')); }
    else setManualCopy(msg);
  };

  const handleExcel = async () => {
    const XLSX = await import('xlsx');
    const st = data.student;
    const rows = [
      ['รายงานนักเรียนรายคน'],
      ['ชื่อ', st.name], ['เลขที่', st.studentNumber ?? ''], ['รหัส', st.studentCode],
      ['ห้อง', st.class?.className || ''], ['ปีการศึกษา', st.class?.academicYear?.year || ''],
      ['ส่งแล้ว', `${stats.submitted}/${stats.total}`], ['ค้าง', stats.missing],
      [],
      ['วิชา', 'รหัสวิชา', 'งานที่', 'ชื่องาน', 'กำหนดส่ง', 'สถานะ', 'คะแนน']
    ];
    subjects.forEach(s => s.tasks.forEach(t => rows.push([
      s.subjectName, s.subjectCode, t.taskNumber, t.taskName, fmtDateTh(t.deadline), STATUS_META[statusOf(t)].label, scoreText(t)
    ])));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 7 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'รายงาน');
    XLSX.writeFile(wb, `รายงาน_${st.studentCode || st.id}_${st.name}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-gray-500">{t('กำลังโหลดข้อมูล...')}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || t('ไม่พบข้อมูล')}</p>
          <button onClick={handleBack} className="px-4 py-2 min-h-[44px] bg-gray-600 text-white rounded-lg hover:bg-gray-700">{t('ย้อนกลับ')}</button>
        </div>
      </div>
    );
  }

  const { student } = data;
  const allSubjects = data.subjects || [];
  const today = new Date().toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  const btn = 'inline-flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-lg text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

  return (
    <div className="student-report">
      <style>{`@media print { @page { size: A4; margin: 12mm; } .student-report .avoid-break { break-inside: avoid; } }`}</style>

      {/* Toolbar (screen only) */}
      <div className="print:hidden mb-4 flex flex-wrap items-center gap-2">
        <button onClick={handleBack} className={`${btn} text-gray-700 hover:bg-gray-100`} aria-label={t("ย้อนกลับ")}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>{t('ย้อนกลับ')}</button>
        {allSubjects.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="sr-only sm:not-sr-only">{t('วิชา')}</span>
            <SmartComboBox
              options={[{ value: '', label: t('ทุกวิชา (รวมวิชาครูท่านอื่น)') }, ...allSubjects.map(s => ({ value: String(s.id), label: s.subjectName }))]}
              value={subjectFilter}
              onChange={v => setSubjectFilter(v ?? '')}
              clearable={false}
              searchable={allSubjects.length > 5}
              ariaLabel={t("วิชา")}
              className="w-[14rem] max-w-full"
            />
          </div>
        )}
        <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
          <button onClick={() => window.print()} className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}>{t('พิมพ์ / บันทึก PDF')}</button>
          <button onClick={handleExcel} className={`${btn} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}>{t('ส่งออก Excel')}</button>
          <button onClick={handleCopyParent} className={`${btn} border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100`}>{t('คัดลอกข้อความถึงผู้ปกครอง')}</button>
          <ParentLinkPanel studentId={id} btnClass={btn} onToast={showToast} filtered={!!subjectFilter} totalMissing={totalMissingAll} />
        </div>
        {manualCopy && (
          <div className="w-full">
            <p className="text-sm text-gray-600 mb-1">{t('คัดลอกอัตโนมัติไม่ได้ กดค้างที่ข้อความแล้วเลือกคัดลอก')}</p>
            <textarea readOnly value={manualCopy} rows={6} onFocus={e => e.target.select()} className="w-full text-sm border rounded-lg p-2" />
          </div>
        )}
      </div>

      {/* Report sheet */}
      <article className="mx-auto max-w-[210mm] bg-white rounded-lg shadow p-4 sm:p-8 print:max-w-none print:shadow-none print:rounded-none print:p-0 text-gray-900">
        <header className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-3">
          <Logo size={36} tone="report" tagline={false} />
          <div className="text-right">
            <h1 className="text-lg sm:text-xl font-bold">{t('รายงานนักเรียนรายคน')}</h1>
            <p className="text-xs text-gray-600">{t('ออกรายงาน {value1}', { value1: today })}</p>
          </div>
        </header>

        <section className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm">
          <div className="col-span-2"><span className="text-gray-500">{t('ชื่อ')}</span><p className="text-base font-semibold">{student.name}</p></div>
          <div><span className="text-gray-500">{t('เลขที่')}</span><p className="font-medium">{student.studentNumber ?? '-'}</p></div>
          <div><span className="text-gray-500">{t('รหัสนักเรียน')}</span><p className="font-medium">{student.studentCode}</p></div>
          <div><span className="text-gray-500">{t('ห้อง')}</span><p className="font-medium">{student.class?.className || '-'}</p></div>
          <div><span className="text-gray-500">{t('ปีการศึกษา')}</span><p className="font-medium">{student.class?.academicYear?.year || '-'}</p></div>
          {subjectFilter && <div className="col-span-2"><span className="text-gray-500">{t('ขอบเขต')}</span><p className="font-medium">{t('เฉพาะวิชา {value1}', { value1: subjects[0]?.subjectName })}</p></div>}
        </section>

        <section className="mt-4 rounded-lg border border-gray-300 p-3 avoid-break">
          <p className="text-base font-semibold">{t('ส่งแล้ว {value1}/{value2} งาน ({value3}%) · ', { value1: stats.submitted, value2: stats.total, value3: stats.pct })}<span className={stats.missing ? 'text-red-700' : 'text-green-700'}>{t('ค้าง {value1}', { value1: stats.missing })}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {STATUS_ORDER.map(k => `${t(STATUS_META[k].label)} ${stats.byStatus[k]}`).join(' · ')}
          </p>
        </section>

        <section className="mt-5 avoid-break">
          <h2 className="text-base font-semibold border-b border-gray-300 pb-1">{t('งานที่ยังไม่ส่ง ({value1})', { value1: missingList.length })}</h2>
          {missingList.length === 0 ? (
            <p className="mt-2 text-sm text-green-700">{t('ไม่มีงานค้าง')}</p>
          ) : (
            <ol className="mt-2 space-y-1 text-sm list-decimal pl-5">
              {missingList.map(({ subject, task }) => {
                const late = isOverdue(task);
                return (
                  <li key={task.id}>
                    {subject.subjectName} · {task.taskName}
                    <span className={late ? 'text-red-700 font-medium' : 'text-gray-500'}>
                      {task.deadline ? t(' — กำหนดส่ง {value1}{value2}', { value1: fmtDate(task.deadline), value2: late ? t(' (เลยกำหนด)') : '' }) : t(' — ไม่มีกำหนดส่ง')}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="mt-5 space-y-5">
          <h2 className="text-base font-semibold border-b border-gray-300 pb-1">{t('ผลการส่งงานรายวิชา')}</h2>
          {subjects.length === 0 && <p className="text-sm text-gray-500">{t('ไม่พบวิชาสำหรับชั้นนี้')}</p>}
          {subjects.map(subject => {
            const done = subject.tasks.filter(t => !isMissing(t)).length;
            return (
              <div key={subject.id} className="avoid-break">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <h3 className="font-semibold">{subject.subjectName} <span className="text-xs font-normal text-gray-500">{subject.subjectCode}</span></h3>
                  <span className="text-sm text-gray-700">{t('ส่งแล้ว {value1}/{value2}', { value1: done, value2: subject.tasks.length })}</span>
                </div>
                {subject.tasks.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('ยังไม่มีงาน')}</p>
                ) : (
                  <>
                    {/* phone: stacked rows */}
                    <ul className="sm:hidden print:hidden divide-y divide-gray-100 rounded border border-gray-200">
                      {subject.tasks.map(t => (
                        <li key={t.id} className="flex items-center justify-between gap-2 px-2 py-2 text-sm">
                          <span className="min-w-0">
                            <span className="block">{t.taskNumber}. {t.taskName}</span>
                            <span className={`block text-xs ${isMissing(t) && isOverdue(t) ? 'text-red-700' : 'text-gray-500'}`}>
                              {t.deadline ? translate('กำหนด {value1}', { value1: fmtDate(t.deadline) }) : translate('ไม่มีกำหนดส่ง')}{scoreText(t) && translate(' · คะแนน {value1}', { value1: scoreText(t) })}
                            </span>
                          </span>
                          <StatusText status={statusOf(t)} />
                        </li>
                      ))}
                    </ul>
                    {/* tablet+ and print: table */}
                    <table className="hidden sm:table print:table w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50 print:bg-transparent text-left text-gray-700">
                          <th className="border border-gray-300 px-2 py-1.5 w-14 whitespace-nowrap text-center font-semibold">{t('งานที่')}</th>
                          <th className="border border-gray-300 px-2 py-1.5 font-semibold">{t('ชื่องาน')}</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-28 font-semibold">{t('กำหนดส่ง')}</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-28 font-semibold">{t('สถานะ')}</th>
                          <th className="border border-gray-300 px-2 py-1.5 w-20 text-center font-semibold">{t('คะแนน')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subject.tasks.map(t => (
                          <tr key={t.id}>
                            <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{t.taskNumber}</td>
                            <td className="border border-gray-300 px-2 py-1.5">{t.taskName}</td>
                            <td className={`border border-gray-300 px-2 py-1.5 ${isMissing(t) && isOverdue(t) ? 'text-red-700' : ''}`}>{fmtDate(t.deadline) || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1.5"><StatusText status={statusOf(t)} /></td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center tabular-nums">{scoreText(t) || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            );
          })}
        </section>

        <p className="mt-4 text-xs text-gray-500">{t('สถานะ: {value1} · ร้อยละคิดจากงานที่แสดงในรายงานนี้', { value1: STATUS_ORDER.map(k => `${STATUS_META[k].icon} ${t(STATUS_META[k].label)}`).join(' · ') })}</p>

        <section className="mt-10 grid grid-cols-2 gap-8 text-sm avoid-break">
          {['ครูประจำชั้น / ครูผู้สอน', 'ผู้ปกครอง'].map(role => (
            <div key={role} className="text-center">
              <div className="border-b border-dotted border-gray-500 h-10" />
              <p className="mt-1">( ........................................ )</p>
              <p className="text-gray-600">{t(role)}</p>
              <p className="text-gray-500 text-xs mt-1">{t('วันที่ ....../....../......')}</p>
            </div>
          ))}
        </section>
      </article>

      {toast && (
        <div role="status" aria-live="polite" className="print:hidden fixed left-1/2 -translate-x-1/2 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] lg:bottom-6 z-[60] max-w-[calc(100%-2rem)] rounded-lg bg-gray-900 text-white text-sm px-4 py-2.5 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default StudentMonitor;
