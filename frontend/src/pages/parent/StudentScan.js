import { t } from '../../i18n';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import Logo from '../../components/brand/Logo';
import LanguagePicker from '../../components/LanguagePicker';
import { cameraErrorText } from '../attendance/shared';

const KS1 = /(KS1\.[a-z0-9-]{3,40}\.[A-Za-z0-9_-]{16,128})/;

// หน้าสาธารณะ: นักเรียนสแกน QR ที่ครูแจก (ทั้งแบบข้อความเดิมและแบบลิงก์) แล้วไปหน้างานของตัวเอง
export default function StudentScan() {
  const navigate = useNavigate();
  const readerRef = useRef(null);
  const [error, setError] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    document.title = t('สแกน QR ดูงานของฉัน');
    let done = false;
    const reader = new Html5Qrcode('student-scan-reader');
    readerRef.current = reader;
    reader.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => {
      const m = KS1.exec(String(text || ''));
      if (!m) { setWrong(true); return; }
      if (done) return;
      done = true;
      reader.stop().catch(() => {}).finally(() => navigate(`/q/${m[1]}`));
    }, () => {}).catch(err => setError(cameraErrorText(err)));
    return () => { done = true; if (reader.isScanning) reader.stop().catch(() => {}); };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-xl px-4 py-3 flex items-center justify-between gap-3">
          <Logo size={32} tone="color" tagline={false} />
          <LanguagePicker />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-5 space-y-4">
        <h1 className="text-2xl font-bold">{t('สแกน QR ดูงานของฉัน')}</h1>
        <p className="text-sm text-gray-600">{t('ส่อง QR Code ที่ครูแจกให้ เพื่อดูงานที่ค้างและงานทุกวิชา')}</p>
        <div id="student-scan-reader" className="w-full overflow-hidden rounded-lg bg-black" />
        {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800">{error}</p>}
        {wrong && !error && <p role="status" className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-yellow-800">{t('QR นี้ไม่ใช่ QR ของ KruScan ลองส่องใบที่ครูแจกให้')}</p>}
      </main>
    </div>
  );
}
