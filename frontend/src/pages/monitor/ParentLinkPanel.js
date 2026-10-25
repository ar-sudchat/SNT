import { t, dateLocale } from '../../i18n';
import React, { useState } from 'react';
import QRCode from 'qrcode';
import { parentAPI } from '../../services/parentApi';
import { copyText } from './studentMonitorHelpers';

// ปุ่ม + แผงลิงก์ติดตามงานสำหรับผู้ปกครอง (ซ่อนตอนพิมพ์ ยกเว้นบัตรลิงก์ที่เลือกพิมพ์ได้)
export default function ParentLinkPanel({ studentId, btnClass = '', onToast, filtered = false, totalMissing = 0 }) {
  const [link, setLink] = useState(null);
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await parentAPI.createLink(studentId);
      setLink(data);
      setQr(await QRCode.toDataURL(data.url, { margin: 1, width: 240 }));
    } catch (e) {
      setError(e.response?.data?.error || t('สร้างลิงก์ไม่สำเร็จ'));
    } finally { setLoading(false); }
  };

  const copy = async () => {
    const ok = await copyText(link.url);
    onToast && onToast(ok ? t('คัดลอกลิงก์แล้ว') : t('คัดลอกไม่ได้ กดค้างที่ลิงก์เพื่อคัดลอก'));
  };

  const expires = link && new Date(link.expiresAt).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <button type="button" onClick={create} disabled={loading} className={`${btnClass} print:hidden border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-60`}>
        {loading ? t('กำลังสร้างลิงก์…') : t('ลิงก์สำหรับผู้ปกครอง')}
      </button>
      {error && <p role="alert" className="print:hidden w-full text-sm text-red-700">{error}</p>}
      {link && (
        <div className="print:hidden w-full rounded-lg border border-brand-200 bg-brand-50 p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {qr && <img src={qr} alt={t("QR code ลิงก์สำหรับผู้ปกครอง")} width={160} height={160} className="rounded bg-white p-1 self-center sm:self-start" />}
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-gray-900">{t('ลิงก์ติดตามงานสำหรับผู้ปกครอง')}</p>
              <p className="text-sm text-gray-600">{t('ผู้ปกครองเปิดดูได้โดยไม่ต้องเข้าสู่ระบบ (ดูอย่างเดียว) · ใช้ได้ถึง {value1}', { value1: expires })}</p>
              {filtered && <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">{t('ลิงก์นี้แสดงทุกวิชาของนักเรียน (ค้างรวม {value1} งาน)', { value1: totalMissing })}</p>}
              <input readOnly value={link.url} onFocus={e => e.target.select()} aria-label={t("ลิงก์สำหรับผู้ปกครอง")}
                className="w-full min-h-[44px] rounded-lg border border-gray-300 bg-white px-2 text-sm" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copy} className={`${btnClass} bg-brand-600 text-white hover:bg-brand-700`}>{t('คัดลอกลิงก์')}</button>
                {qr && <a href={qr} download="parent-link-qr.png" className={`${btnClass} border border-gray-300 bg-white text-gray-800 hover:bg-gray-50`}>{t('บันทึก QR')}</a>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
