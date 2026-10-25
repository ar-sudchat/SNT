import { t } from '../../i18n';
import React, { useEffect, useState } from 'react';
import { planAPI } from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';

const Bar = ({ label, used, limit }) => {
  const unlimited = limit == null;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-600';
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="text-gray-500">{used.toLocaleString()} / {unlimited ? t('ไม่จำกัด') : limit.toLocaleString()}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={limit || undefined}>
        <div className={`h-full rounded-full ${color}`} style={{ width: unlimited ? '4%' : `${pct}%` }} />
      </div>
    </div>
  );
};

const PlanPage = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    planAPI.get().then(r => setData(r.data)).catch(e => setError(e.response?.data?.error || t('โหลดข้อมูลแพ็กเกจไม่สำเร็จ')));
  }, []);

  if (error) return <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>;
  if (!data) return <div className="p-4 text-gray-500">{t("กำลังโหลด...")}</div>;

  return (
    <div className="space-y-4">
      <PageHeader title={t("แพ็กเกจและการใช้งาน")} subtitle={t("ดูแพ็กเกจปัจจุบันและการใช้งานในเดือนนี้")} />
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">{t("แพ็กเกจปัจจุบัน")}</div>
            <div className="text-lg font-semibold text-gray-800">{data.plan.name}</div>
          </div>
          {data.limits.aiPerMonth == null && data.limits.students == null && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">{t("ใช้ได้ตลอดไป ไม่มีวันหมดอายุ")}</span>
          )}
        </div>
        <div className="space-y-4">
          <Bar label={t("ผู้ช่วย AI เดือนนี้ (ครั้ง)")} used={data.usage.aiCalls} limit={data.limits.aiPerMonth} />
          <Bar label={t("นักเรียน (คน)")} used={data.usage.students} limit={data.limits.students} />
        </div>
        {!data.aiEnabled && <p className="mt-4 text-sm text-amber-700">{t("ผู้ช่วย AI ถูกปิดสำหรับกลุ่มนี้")}</p>}
      </div>
    </div>
  );
};

export default PlanPage;
