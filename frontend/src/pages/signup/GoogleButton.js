import { t } from '../../i18n';
import React, { useId } from 'react';

// ปุ่ม Google ตามแนวทางแบรนด์ของ Google: พื้นขาว ขอบ #dadce0 โลโก้ "G" สี่สีของจริง
// แสดงเสมอ — ถ้าเซิร์ฟเวอร์ยังไม่เปิด Google (config.google = false) จะเป็นปุ่มกดไม่ได้ + ข้อความ "เปิดใช้เร็วๆ นี้"
// สีปุ่มกำหนดแบบ inline เพื่อไม่ให้ธีมกลางคืนเปลี่ยนพื้นปุ่ม (แบรนด์ Google ต้องคงที่)

export const GoogleG = ({ className = 'size-[18px]' }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const base = 'relative flex h-12 w-full items-center justify-center gap-3 rounded-lg border px-4 text-[15px] font-medium transition-[background-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';
const look = { backgroundColor: '#ffffff', borderColor: '#dadce0', color: '#3c4043' };

const GoogleButton = ({ href, label = t('ดำเนินการต่อด้วย Google'), enabled = true }) => {
  const tipId = useId();
  if (enabled) {
    return (
      <a href={href} className={`${base} hover:shadow-[0_1px_3px_rgb(60_64_67/0.25)] hover:![background-color:#f8f9fa] active:![background-color:#f1f3f4]`} style={look}>
        <GoogleG />
        <span>{label}</span>
      </a>
    );
  }
  return (
    <div className="group relative">
      <span role="link" aria-disabled="true" tabIndex={0} aria-describedby={tipId}
        className={`${base} cursor-not-allowed`} style={look}>
        <GoogleG className="size-[18px] opacity-50" />
        <span className="opacity-60">{label}</span>
      </span>
      <p id={tipId} className="mt-1.5 text-center text-xs text-gray-500">{t('เปิดใช้เร็วๆ นี้ · ตอนนี้ใช้อีเมลไปก่อนได้')}</p>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max max-w-[260px] -translate-x-1/2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{t('ระบบยังไม่เปิดให้เข้าด้วยบัญชี Google')}</span>
    </div>
  );
};

export default GoogleButton;
