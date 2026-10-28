import { t } from '../i18n';
import React from 'react';
import { Link } from 'react-router-dom';

// สลับประเภทการสแกนที่หัวหน้า: ตรวจงาน (ส่ง/ผ่าน/คะแนน) | เช็คชื่อ (มาเรียน) · ใช้ร่วมกันทั้งสองหน้า
const MODES = [
  { id: 'work', label: 'ตรวจงาน', to: '/teacher/scan' },
  { id: 'attendance', label: 'เช็คชื่อ', to: '/attendance' }
];

const ScanModeTabs = ({ active }) => (
  <nav aria-label={t('ประเภทการสแกน')} className="grid grid-cols-2 gap-1 rounded-xl bg-gray-200/70 p-1">
    {MODES.map(m => (
      <Link
        key={m.id}
        to={m.to}
        replace
        aria-current={active === m.id ? 'page' : undefined}
        className={`flex min-h-[48px] items-center justify-center rounded-lg px-3 text-base font-semibold transition ${active === m.id ? 'bg-white text-brand-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
      >{t(m.label)}</Link>
    ))}
  </nav>
);

export default ScanModeTabs;
