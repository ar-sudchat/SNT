import { t } from '../../i18n';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { assessmentAPI } from '../../services/api';
import PageHeader, { CRUMB_LINK } from '../../components/ui/PageHeader';
import useLessonContext from './useLessonContext';
import LessonContextBar from './LessonContextBar';
import { isWeakLevel, responseOf } from './lessonLogCore';

// Keep translation callable in scopes with a local variable named t.
const i18n = { t };

const LINK = 'inline-flex items-center min-h-[44px] text-sm text-brand-700 underline';
const WEAK = 'bg-amber-100 text-amber-800';

// Level when the record has levels; otherwise the plain count ("ผ่าน 4/5", "✓ 3/5") or the score total.
const cellText = (rec, r) => {
  if (r.level) return i18n.t(r.level); // ชื่อระดับของแบบสำเร็จรูปแปลได้ · ที่ครูตั้งเองคงเดิม
  const n = rec.maxPoints ?? rec.criteriaCount;
  const t = responseOf(rec);
  if (t === 'PASSFAIL') return i18n.t('ผ่าน {value1}/{n}', { value1: r.total, n: n });
  if (t === 'CHECK') return `✓ ${r.total}/${n}`;
  return `${r.total}`;
};

const Level = ({ rec, r }) => {
  if (!r) return <span className="text-gray-400">–</span>;
  return <span className={`inline-block rounded px-1.5 py-0.5 ${isWeakLevel(r.level) ? WEAK : ''}`}>{cellText(rec, r)}</span>;
};

export default function SummaryPage() {
  const ctx = useLessonContext();
  const { classId, subjectId, cls, subject, loading: ctxLoading, error: ctxError } = ctx;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!classId) return undefined;
    let cancelled = false;
    setLoading(true); setError('');
    assessmentAPI.summary({ classId, subjectId: subjectId || undefined })
      .then(r => { if (!cancelled) setData(r.data); })
      .catch(e => { if (!cancelled) setError(e.response?.data?.error || t('โหลดสรุปผลไม่สำเร็จ')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [classId, subjectId]);

  const records = data?.records || [];
  const students = data?.students || [];
  const contextLabel = cls ? `${cls.className} · ${subject ? subject.subjectName : t('ทุกวิชา')}` : '';

  // Per record: how many students got each level, in the order levels first appear.
  // Only records that have levels (PASSFAIL/CHECK without levels show counts in the table instead).
  const counts = records.map(rec => {
    const map = new Map();
    students.forEach(s => {
      const r = s.results?.[rec.id];
      if (r?.level) map.set(r.level, (map.get(r.level) || 0) + 1);
    });
    return { rec, items: [...map.entries()], hasLevels: map.size > 0 || (rec.levels || []).length > 0 };
  }).filter(c => c.hasLevels);

  const title = (rec) => `${rec.name}${rec.dateText ? ` · ${rec.dateText}` : ''}`;
  const totalTip = (rec, r) => (r ? t('{value1}: รวม {value2} คะแนน', { value1: rec.name, value2: r.total }) : '');

  return (
    <div className="space-y-4">
      <PageHeader title={t("สรุปผลรายคน")} crumb={<Link to="/lesson-log" className={CRUMB_LINK}>{t('‹ บันทึกหลังแผน')}</Link>} />

      {ctxError && <div className="rounded-xl bg-fail/10 p-3 text-sm text-fail" role="alert">{ctxError}</div>}
      {error && <div className="rounded-xl bg-fail/10 p-3 text-sm text-fail" role="alert">{error}</div>}

      {cls && <LessonContextBar ctx={ctx} />}

      {!ctxLoading && !cls && !ctxError && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 space-y-1">
          <p className="font-medium text-gray-800">{t('ยังไม่มีห้องเรียน')}</p>
          <p className="text-sm text-gray-500">{t('เพิ่มห้องเรียนและนักเรียนก่อน แล้วค่อยกลับมาดูสรุป')}</p>
          <Link to="/lesson-log" className={LINK}>{t('กลับไปบันทึกหลังแผน')}</Link>
        </div>
      )}

      {(loading || ctxLoading) && <p className="text-sm text-gray-500" role="status">{t('กำลังโหลด…')}</p>}

      {data && !loading && records.length === 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 space-y-1">
          <p className="font-medium text-gray-800">{t('ยังไม่มีการประเมินรายคนของ {contextLabel}', { contextLabel: contextLabel })}</p>
          <p className="text-sm text-gray-500">{t('สร้างแบบประเมินรายคน (เช่น พฤติกรรมการทำงาน) แล้วบันทึก ผลของแต่ละคนจะมารวมที่นี่')}</p>
          <Link to="/lesson-log/new" className={LINK}>{t('สร้างการประเมินรายคน')}</Link>
        </div>
      )}

      {data && records.length > 0 && (
        <>
          {students.length === 0 ? (
            <p className="text-sm text-gray-500">{t('ห้องนี้ยังไม่มีนักเรียน')}</p>
          ) : (
            <>
              {/* Computer: students x records, scrolls inside its own container. */}
              <div className="hidden md:block overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-gray-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-600">
                      <th scope="col" className="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-medium whitespace-nowrap">{t('นักเรียน')}</th>
                      {records.map(rec => (
                        <th key={rec.id} scope="col" className="px-3 py-2 font-medium min-w-[8rem] align-bottom">
                          <div className="text-gray-800">{rec.name}</div>
                          {rec.dateText && <div className="text-xs font-normal text-gray-500">{rec.dateText}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.map(s => (
                      <tr key={s.id}>
                        <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-normal whitespace-nowrap">
                          <span className="text-gray-400 mr-2">{s.studentNumber}</span>{s.name}
                        </th>
                        {records.map(rec => {
                          const r = s.results?.[rec.id];
                          return (
                            <td key={rec.id} className="px-3 py-2" title={totalTip(rec, r)}>
                              <Level rec={rec} r={r} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone: one card per student. */}
              <ul className="md:hidden space-y-2">
                {students.map(s => (
                  <li key={s.id} className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                    <div className="font-medium text-gray-800 mb-1">
                      <span className="text-gray-400 mr-2">{s.studentNumber}</span>{s.name}
                    </div>
                    <dl className="space-y-1 text-sm">
                      {records.map(rec => (
                        <div key={rec.id} className="flex items-baseline justify-between gap-3">
                          <dt className="min-w-0 text-gray-600 break-words">{rec.name}</dt>
                          <dd className="shrink-0"><Level rec={rec} r={s.results?.[rec.id]} /></dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          )}

          {counts.length > 0 && (
          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 space-y-3">
            <h2 className="font-semibold text-gray-800">{t('จำนวนนักเรียนในแต่ละระดับ')}</h2>
            <ul className="space-y-3">
              {counts.map(({ rec, items }) => (
                <li key={rec.id}>
                  <div className="text-sm font-medium text-gray-700">{title(rec)}</div>
                  {items.length === 0 ? (
                    <div className="text-sm text-gray-500">{t('ยังไม่มีผล')}</div>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {items.map(([label, n]) => (
                        <span key={label} className={`rounded-full px-3 py-1 text-sm ${isWeakLevel(label) ? WEAK : 'bg-gray-100 text-gray-700'}`}>{t('{label} {n} คน', { label: t(label), n: n })}</span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
          )}
        </>
      )}
    </div>
  );
}
