import { t, dateLocale } from '../../i18n';
import React, { useCallback, useEffect, useState } from 'react';
import { qrcodeAPI } from '../../services/api';
import { WindowModal } from '../../components/ui';

// ประวัติการสร้าง QR เก็บในเครื่องนี้ แยกตามบัญชีและกลุ่ม (เก็บแค่รายชื่อ ไม่เก็บรูป QR — รูปโหลดใหม่จากเซิร์ฟเวอร์)
const MAX_RUNS = 30;
const historyKey = () => {
  try {
    const payload = JSON.parse(atob(localStorage.getItem('token').split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return `kruscan.qr.history.${payload.userId}.${payload.tid}`;
  } catch (e) {
    return 'kruscan.qr.history';
  }
};
export const readHistory = () => {
  try { return JSON.parse(localStorage.getItem(historyKey())) || []; } catch (e) { return []; }
};
export const saveRun = (run) => {
  const strip = ({ qrcodeImage, ...rest }) => rest;
  const clean = { ...run, success: run.success.map(strip), failed: run.failed.map(strip) };
  const next = [clean, ...readHistory().filter((r) => r.id !== run.id)].slice(0, MAX_RUNS);
  try { localStorage.setItem(historyKey(), JSON.stringify(next)); } catch (e) { /* storage ปิดอยู่ */ }
  return next;
};
export const clearHistory = () => {
  try { localStorage.removeItem(historyKey()); } catch (e) { /* storage ปิดอยู่ */ }
};

const EXISTS = 'QR code already exists';
export const reasonText = (reason) => (reason === EXISTS ? t('มี QR Code อยู่แล้ว') : reason || t('สร้างไม่สำเร็จ'));
export const formatWhen = (at) => new Date(at).toLocaleString(dateLocale(), { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const Thumb = ({ item, subjectName }) => (
  <div className="border rounded-lg p-3 text-center min-w-0">
    {item.qrcodeImage ? (
      <img src={item.qrcodeImage} alt={`QR Code ${item.name}`} className="mx-auto mb-2" style={{ width: 120, height: 120 }} />
    ) : (
      <div className="mx-auto mb-2 flex items-center justify-center rounded bg-gray-100 text-xs text-gray-400" style={{ width: 120, height: 120 }}>{t("ยังไม่โหลดรูป")}</div>
    )}
    <p className="text-sm font-medium truncate">{item.studentNumber ? `${item.studentNumber}. ` : ''}{item.name}</p>
    <p className="text-xs text-gray-500 truncate">{item.studentCode}</p>
    {subjectName && <p className="text-xs text-brand-600 truncate">{subjectName}</p>}
  </div>
);

// run: { id, at, classId, className, subjectId, subjectName, success: [...], failed: [...] }
// แต่ละคน: { studentId, studentCode, studentNumber, name, reason?, qrcodeImage? }
export default function QRResultModal({ run, onClose, onPrint, onChange }) {
  const [tab, setTab] = useState('success');
  const [reloading, setReloading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (run) setTab(run.success.length > 0 || run.failed.length === 0 ? 'success' : 'failed');
    setMessage('');
  }, [run && run.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // โหลดรูป QR ล่าสุดจากเซิร์ฟเวอร์ ให้ทั้งคนที่สำเร็จ และคนที่ "มี QR อยู่แล้ว"
  const reload = useCallback(async (target = run) => {
    if (!target) return;
    setReloading(true); setMessage('');
    try {
      const { data } = await qrcodeAPI.printForClass(target.classId, target.subjectId);
      const byCode = new Map(data.map((q) => [q.studentCode, q]));
      const withImage = (p) => ({ ...p, qrcodeImage: byCode.get(p.studentCode)?.qrcodeImage || null });
      const next = { ...target, success: target.success.map(withImage), failed: target.failed.map(withImage) };
      const missing = next.success.filter((p) => !p.qrcodeImage).length;
      if (missing) setMessage(t("ไม่พบ QR ในระบบ {missing} คน (อาจถูกลบหรือย้ายห้องแล้ว)", { missing: missing }));
      onChange(next, { save: false });
    } catch (err) {
      setMessage(err.response?.data?.error || t('โหลด QR ไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setReloading(false);
    }
  }, [run, onChange]);

  // เปิดจากประวัติ หรือมีคนที่ "มี QR อยู่แล้ว": ยังไม่มีรูป → โหลดให้อัตโนมัติ
  useEffect(() => {
    if (!run) return;
    const needs = [...run.success, ...run.failed.filter((p) => p.reason === EXISTS)];
    if (needs.length > 0 && needs.every((p) => !p.qrcodeImage)) reload(run);
  }, [run && run.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!run) return null;
  const retryable = run.failed.filter((p) => p.reason !== EXISTS);
  const existing = run.failed.filter((p) => p.reason === EXISTS);

  const retry = async () => {
    setRetrying(true); setMessage('');
    try {
      const { data } = await qrcodeAPI.generateBulk({ studentIds: retryable.map((p) => p.studentId), subjectId: run.subjectId });
      const { success, failed } = data.results;
      const ok = new Map(success.map((q) => [q.studentId, q]));
      const stillFailed = new Map(failed.map((f) => [f.studentId, f.reason]));
      const next = {
        ...run,
        success: [...run.success, ...retryable.filter((p) => ok.has(p.studentId)).map((p) => ({ ...p, reason: undefined, qrcodeImage: ok.get(p.studentId).qrcodeImage }))],
        failed: run.failed.filter((p) => !ok.has(p.studentId)).map((p) => (stillFailed.has(p.studentId) ? { ...p, reason: stillFailed.get(p.studentId) } : p)),
      };
      setMessage(failed.length ? t("สร้างเพิ่มสำเร็จ {success} คน · ยังไม่สำเร็จ {failed} คน", { success: success.length, failed: failed.length }) : t("สร้างเพิ่มสำเร็จ {success} คน", { success: success.length }));
      onChange(next, { save: true });
    } catch (err) {
      setMessage(err.response?.data?.error || t('ลองสร้างใหม่ไม่สำเร็จ'));
    } finally {
      setRetrying(false);
    }
  };

  const printable = (list) => list.filter((p) => p.qrcodeImage);
  const list = tab === 'success' ? run.success : run.failed;
  const tabs = [
    { key: 'success', label: t('สำเร็จ'), count: run.success.length, active: 'bg-white text-green-700 shadow' },
    { key: 'failed', label: t('ไม่สำเร็จ'), count: run.failed.length, active: 'bg-white text-amber-700 shadow' },
  ];
  const busy = reloading || retrying;

  return (
    <WindowModal
      open
      id="qr-result"
      title={t("ผลการสร้าง QR · {value1} · {value2}", { value1: run.className, value2: run.subjectName })}
      onClose={onClose}
      initialWidth="max-w-3xl"
      footer={
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => reload()}
            disabled={busy}
            className="min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-2"
          >{reloading && <span className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-transparent" />}{t("โหลดใหม่")}</button>
          {tab === 'failed' && retryable.length > 0 && (
            <button type="button" onClick={retry} disabled={busy} className="min-h-[44px] px-4 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
              {retrying ? t('กำลังลองใหม่...') : t("ลองสร้างใหม่ {value1} คน", { value1: retryable.length })}
            </button>
          )}
          <button
            type="button"
            onClick={() => onPrint(printable(tab === 'success' ? run.success : existing), run.subjectName)}
            disabled={busy || printable(tab === 'success' ? run.success : existing).length === 0}
            className="sm:ml-auto min-h-[44px] px-4 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            {tab === 'success'
              ? t("พิมพ์ QR ที่สำเร็จ ({value1})", { value1: printable(run.success).length })
              : t("พิมพ์ QR เดิมที่มีอยู่ ({value1})", { value1: printable(existing).length })}
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-500">{t("สร้างเมื่อ {value1}", { value1: formatWhen(run.at) })}</p>
        <div role="tablist" aria-label={t("ผลการสร้าง")} className="grid grid-cols-2 gap-1 bg-gray-200 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`qr-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls="qr-tab-panel"
              onClick={() => setTab(t.key)}
              className={`min-h-[44px] rounded-md text-sm font-medium ${tab === t.key ? t.active : 'text-gray-600'}`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        {message && <p role="status" className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">{message}</p>}
        <div id="qr-tab-panel" role="tabpanel" aria-labelledby={`qr-tab-${tab}`}>
          {list.length === 0 ? (
            <p className="py-8 text-center text-gray-500">{tab === 'success' ? t('ยังไม่มีคนที่สร้างสำเร็จ') : t('ไม่มีรายการที่ไม่สำเร็จ')}</p>
          ) : tab === 'success' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {list.map((p) => <Thumb key={p.studentId} item={p} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {existing.length > 0 && (
                <p className="text-sm text-gray-600">{t("คนที่มี QR อยู่แล้วไม่ต้องสร้างใหม่ ใช้ QR เดิมพิมพ์ได้เลย")}</p>
              )}
              <ul className="divide-y rounded-lg border">
                {list.map((p) => (
                  <li key={p.studentId} className="flex items-center gap-3 p-2 min-h-[56px]">
                    {p.qrcodeImage ? (
                      <img src={p.qrcodeImage} alt="" className="shrink-0" style={{ width: 48, height: 48 }} />
                    ) : (
                      <span className="shrink-0 rounded bg-gray-100" style={{ width: 48, height: 48 }} aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-800">{p.studentNumber ? `${p.studentNumber}. ` : ''}{p.name}</span>
                      <span className="block truncate text-xs text-gray-500">{p.studentCode}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${p.reason === EXISTS ? 'bg-gray-100 text-gray-600' : 'bg-red-50 text-red-700'}`}>
                      {reasonText(p.reason)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </WindowModal>
  );
}

export function QRHistoryModal({ open, runs, onClose, onOpenRun, onClear }) {
  if (!open) return null;
  return (
    <WindowModal
      open
      id="qr-history"
      title={t("ประวัติการสร้าง QR Code")}
      onClose={onClose}
      initialWidth="max-w-lg"
      footer={runs.length > 0 && (
        <button type="button" onClick={onClear} className="min-h-[44px] px-4 rounded-lg text-red-600 hover:bg-red-50">{t("ล้างประวัติในเครื่องนี้")}</button>
      )}
    >
      <div className="p-4">
        {runs.length === 0 ? (
          <p className="py-8 text-center text-gray-500">{t("ยังไม่มีประวัติการสร้างในเครื่องนี้")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {runs.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpenRun(r)} className="w-full text-left p-3 min-h-[56px] hover:bg-gray-50 flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-gray-800">{r.className} · {r.subjectName}</span>
                    <span className="block text-xs text-gray-500">{formatWhen(r.at)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-xs text-green-700">{t("สำเร็จ {value1}", { value1: r.success.length })}</span>
                  {r.failed.length > 0 && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-700">{t("ไม่สำเร็จ {value1}", { value1: r.failed.length })}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-500">{t("เก็บ {MAX_RUNS} ครั้งล่าสุดไว้ในเครื่องนี้ เปิดแล้วระบบโหลดรูป QR ใหม่จากเซิร์ฟเวอร์", { MAX_RUNS: MAX_RUNS })}</p>
      </div>
    </WindowModal>
  );
}
