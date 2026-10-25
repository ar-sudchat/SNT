import { t, dateLocale, tx } from '../../i18n';
import React, { useState, useEffect, useCallback } from 'react';
import { tenantDataAPI } from '../../services/api';
import { ConfirmDialog } from '../../components/ui';
import PageHeader from '../../components/ui/PageHeader';

const ACTION_LABEL = {
  'tenant.export': 'ส่งออกข้อมูลกลุ่ม',
  'tenant.delete_request': 'ขอลบกลุ่ม',
  'tenant.delete_cancel': 'ยกเลิกคำขอลบ'
};
const fmt = (d) => (d ? new Date(d).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const DataPrivacy = () => {
  const [st, setSt] = useState(null);
  const [audit, setAudit] = useState({ items: [], total: 0, page: 1, limit: 20 });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async (page = 1) => {
    try {
      const [s, a] = await Promise.all([tenantDataAPI.status(), tenantDataAPI.audit(page)]);
      setSt(s.data); setAudit(a.data); setError('');
    } catch (e) {
      setError(e.response?.status === 403 ? t('หน้านี้สำหรับเจ้าของกลุ่มเท่านั้น') : t('โหลดข้อมูลไม่สำเร็จ'));
    }
  }, []);
  useEffect(() => { load(1); }, [load]);

  const doExport = async () => {
    setBusy(true); setMsg('');
    try {
      const r = await tenantDataAPI.exportData();
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'kruscan-export.json'; a.click();
      URL.revokeObjectURL(url);
      setMsg(t('ดาวน์โหลดข้อมูลแล้ว')); load(1);
    } catch (e) { setError(t('ส่งออกข้อมูลไม่สำเร็จ')); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try { await tenantDataAPI.deleteRequest(typed); setTyped(''); setMsg(t('รับคำขอลบแล้ว')); await load(1); }
    catch (e) { setError(e.response?.data?.error || t('ส่งคำขอไม่สำเร็จ')); } finally { setBusy(false); }
  };
  const doCancel = async () => {
    setBusy(true);
    try { await tenantDataAPI.deleteCancel(); setMsg(t('ยกเลิกคำขอลบแล้ว')); await load(1); }
    catch (e) { setError(e.response?.data?.error || t('ยกเลิกไม่สำเร็จ')); } finally { setBusy(false); }
  };

  const pages = Math.max(1, Math.ceil(audit.total / audit.limit));
  const btn = 'min-h-[44px] rounded-xl px-5 py-2.5 font-medium disabled:opacity-50';

  return (
    <div className="space-y-4">
      <PageHeader title={t("ข้อมูลและความเป็นส่วนตัว (PDPA)")} subtitle={t("ส่งออกหรือลบข้อมูลของกลุ่ม และดูประวัติการใช้งานสำคัญ — เจ้าของกลุ่มเท่านั้น")} />
      {error && <div className="rounded-xl bg-fail/10 p-3 text-sm text-fail" role="alert">{error}</div>}
      {msg && <div className="rounded-xl bg-pass/10 p-3 text-sm text-pass" role="status">{msg}</div>}

      {st && (
        <>
          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 space-y-2">
            <h2 className="font-semibold text-gray-800">{t("ส่งออกข้อมูลทั้งหมด")}</h2>
            <p className="text-sm text-gray-500">{t("ไฟล์ JSON ของนักเรียน ครู ห้องเรียน งาน การส่งงาน และบทสนทนา AI ของกลุ่มนี้ (ไม่รวมรหัสผ่าน)")}</p>
            <button onClick={doExport} disabled={busy} className={`${btn} bg-primary !text-primary-fg`}>{t("ดาวน์โหลดข้อมูล")}</button>
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-fail/30 space-y-3">
            <h2 className="font-semibold text-fail">{t("ลบกลุ่ม")}</h2>
            {st.status === 'PENDING_DELETE' ? (
              <>
                <p className="text-sm text-gray-600">{t("รอลบถาวรภายใน {value1} — ยกเลิกได้ก่อนถึงวันนั้น", { value1: fmt(st.pending?.deleteAfter) })}</p>
                <button onClick={doCancel} disabled={busy} className={`${btn} border-2 border-gray-300 text-gray-700`}>{t("ยกเลิกคำขอลบ")}</button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500">{tx('ข้อมูลจะถูกเก็บไว้ {days} วันก่อนลบถาวร ระหว่างนั้นยกเลิกได้ พิมพ์ชื่อกลุ่ม {name} เพื่อยืนยัน', { days: st.graceDays, name: <b>{st.name}</b> })}</p>
                <input
                  value={typed} onChange={e => setTyped(e.target.value)} aria-label={t("พิมพ์ชื่อกลุ่มเพื่อยืนยัน")}
                  className="w-full min-h-[44px] rounded-xl border border-gray-300 px-3 py-2" placeholder={st.name}
                />
                <button onClick={() => setConfirmOpen(true)} disabled={busy || typed !== st.name} className={`${btn} bg-fail text-white`}>{t("ขอลบกลุ่ม")}</button>
              </>
            )}
          </section>

          <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            <h2 className="font-semibold text-gray-800 mb-2">{t("ประวัติการใช้งาน (Audit log)")}</h2>
            {audit.items.length === 0 ? <p className="text-sm text-gray-500">{t("ยังไม่มีรายการ")}</p> : (
              <ul className="divide-y divide-gray-100">
                {audit.items.map(i => (
                  <li key={i.id} className="py-2 text-sm flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="text-gray-800">{ACTION_LABEL[i.action] ? t(ACTION_LABEL[i.action]) : i.action}</span>
                    <span className="text-gray-500">{t("ผู้ใช้ #{value1} · {value2}", { value1: i.userId ?? '-', value2: fmt(i.createdAt) })}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
              <button disabled={audit.page <= 1} onClick={() => load(audit.page - 1)} className="min-h-[44px] px-3 disabled:opacity-40">{t("หน้าก่อน")}</button>
              <span>{audit.page} / {pages}</span>
              <button disabled={audit.page >= pages} onClick={() => load(audit.page + 1)} className="min-h-[44px] px-3 disabled:opacity-40">{t("หน้าถัดไป")}</button>
            </div>
          </section>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={doDelete}
        title={t("ยืนยันขอลบกลุ่ม")} type="danger" confirmText={t("ขอลบ")}
        message={t("ข้อมูลทั้งหมดของ \"{value1}\" จะถูกลบถาวรใน {value2} วัน", { value1: st?.name || '', value2: st?.graceDays || 30 })}
      />
    </div>
  );
};

export default DataPrivacy;
