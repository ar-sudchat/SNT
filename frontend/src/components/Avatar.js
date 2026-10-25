import { t } from '../i18n';
import React from 'react';

// รูปการ์ตูนทำมือ (inline SVG, viewBox 64) — key ต้องตรงกับ PRESETS ใน backend/services/profile.js
const eyes = (y = 30, gap = 10, r = 3) => (
  <>
    <circle cx={32 - gap} cy={y} r={r} fill="#1f2433" />
    <circle cx={32 + gap} cy={y} r={r} fill="#1f2433" />
    <circle cx={32 - gap + 1} cy={y - 1} r={r / 3} fill="#fff" />
    <circle cx={32 + gap + 1} cy={y - 1} r={r / 3} fill="#fff" />
  </>
);
const smile = (y = 40, w = 7) => <path d={`M${32 - w} ${y}q${w} ${w * 0.8} ${w * 2} 0`} stroke="#1f2433" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
const cheeks = (y = 38) => (<><circle cx="17" cy={y} r="3.5" fill="#ff8fa3" opacity=".55" /><circle cx="47" cy={y} r="3.5" fill="#ff8fa3" opacity=".55" /></>);

export const PRESETS = [
  { key: 'teacher', label: 'คุณครูแว่นหนา', bg: '#dbe7ff', draw: (
    <>
      <path d="M12 30c0-14 9-22 20-22s20 8 20 22c0 3-1 5-1 5H13s-1-2-1-5z" fill="#3b2a20" />
      <circle cx="32" cy="34" r="17" fill="#f6c9a0" />
      <path d="M15 28c4-9 30-9 34 0-6-4-28-4-34 0z" fill="#3b2a20" />
      <circle cx="24" cy="33" r="6" fill="#fff" fillOpacity=".5" stroke="#1f2433" strokeWidth="2.2" />
      <circle cx="40" cy="33" r="6" fill="#fff" fillOpacity=".5" stroke="#1f2433" strokeWidth="2.2" />
      <path d="M30 33h4" stroke="#1f2433" strokeWidth="2.2" />
      <circle cx="24" cy="33" r="2" fill="#1f2433" /><circle cx="40" cy="33" r="2" fill="#1f2433" />
      {smile(42, 5)}
      <path d="M18 56c3-5 8-7 14-7s11 2 14 7" fill="#2f56b0" />
    </>) },
  { key: 'owl', label: 'นกฮูกนักอ่าน', bg: '#fdecc8', draw: (
    <>
      <path d="M14 20l6 6M50 20l-6 6" stroke="#7a4e2a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="32" cy="38" rx="19" ry="20" fill="#9a6a3f" />
      <ellipse cx="32" cy="44" rx="11" ry="12" fill="#e9c99a" />
      <circle cx="24" cy="31" r="7.5" fill="#fff" /><circle cx="40" cy="31" r="7.5" fill="#fff" />
      <circle cx="24" cy="31" r="3.5" fill="#1f2433" /><circle cx="40" cy="31" r="3.5" fill="#1f2433" />
      <path d="M29 38l3 4 3-4z" fill="#f2a516" />
    </>) },
  { key: 'cat', label: 'แมวส้มขี้เล่น', bg: '#ffe1cf', draw: (
    <>
      <path d="M13 26l3-16 12 10M51 26l-3-16-12 10" fill="#f08a3c" />
      <circle cx="32" cy="36" r="19" fill="#f08a3c" />
      <path d="M26 20q6 4 12 0" stroke="#c9601c" strokeWidth="2.5" fill="none" />
      {eyes(33, 8, 3)}
      <path d="M30 39h4l-2 2.5z" fill="#d94f6b" />
      <path d="M32 41.5q-3 3-6 1M32 41.5q3 3 6 1" stroke="#1f2433" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M12 38h8M12 42l8-1M52 38h-8M52 42l-8-1" stroke="#1f2433" strokeWidth="1.2" />
    </>) },
  { key: 'robot', label: 'หุ่นยนต์ช่วยสอน', bg: '#d9f3ee', draw: (
    <>
      <path d="M32 9v7" stroke="#5f6b84" strokeWidth="3" /><circle cx="32" cy="8" r="3.5" fill="#e8901a" />
      <rect x="13" y="16" width="38" height="32" rx="9" fill="#9fb0c8" />
      <rect x="18" y="22" width="28" height="16" rx="6" fill="#1f2433" />
      <circle cx="26" cy="30" r="3.5" fill="#5ef0c7" /><circle cx="38" cy="30" r="3.5" fill="#5ef0c7" />
      <rect x="25" y="41" width="14" height="3" rx="1.5" fill="#5f6b84" />
      <rect x="9" y="26" width="4" height="12" rx="2" fill="#5f6b84" /><rect x="51" y="26" width="4" height="12" rx="2" fill="#5f6b84" />
      <rect x="20" y="50" width="24" height="8" rx="3" fill="#9fb0c8" />
    </>) },
  { key: 'rocket', label: 'จรวดพุ่งทะยาน', bg: '#e6defc', draw: (
    <>
      <path d="M32 6c9 7 12 18 10 32H22C20 24 23 13 32 6z" fill="#f4f6fb" stroke="#c7cde0" strokeWidth="1.5" />
      <circle cx="32" cy="24" r="5" fill="#5b8def" stroke="#2f56b0" strokeWidth="2" />
      <path d="M22 30l-7 10 8-1M42 30l7 10-8-1" fill="#e2524a" />
      <path d="M26 40h12l-2 5h-8z" fill="#5f6b84" />
      <path d="M28 46q4 12 4 12t4-12z" fill="#f6a92e" /><path d="M30 46q2 7 2 7t2-7z" fill="#fde68a" />
      <circle cx="12" cy="14" r="1.5" fill="#fff" /><circle cx="52" cy="20" r="1.2" fill="#fff" /><circle cx="50" cy="52" r="1.5" fill="#fff" />
    </>) },
  { key: 'book', label: 'หนังสือยิ้มแป้น', bg: '#ffe0e6', draw: (
    <>
      <path d="M10 18q11-4 22 2v34q-11-6-22-2z" fill="#e2524a" />
      <path d="M54 18q-11-4-22 2v34q11-6 22-2z" fill="#f06b62" />
      <path d="M13 20q9-2 19 3v28q-10-4-19-2z" fill="#fff" /><path d="M51 20q-9-2-19 3v28q10-4 19-2z" fill="#fff8eb" />
      <circle cx="23" cy="32" r="2.5" fill="#1f2433" /><circle cx="41" cy="32" r="2.5" fill="#1f2433" />
      <path d="M26 39q6 5 12 0" stroke="#1f2433" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>) },
  { key: 'fox', label: 'จิ้งจอกเจ้าปัญญา', bg: '#ffe9d6', draw: (
    <>
      <path d="M12 12l10 16H10zM52 12L42 28h12z" fill="#e8742a" />
      <path d="M10 26q22-8 44 0l-6 18q-16 14-32 0z" fill="#e8742a" />
      <path d="M18 38q14 18 28 0q-14 6-28 0z" fill="#fff" />
      {eyes(33, 9, 2.8)}
      <ellipse cx="32" cy="42" rx="3" ry="2.2" fill="#1f2433" />
    </>) },
  { key: 'panda', label: 'แพนด้าใจดี', bg: '#e3f4dc', draw: (
    <>
      <circle cx="15" cy="17" r="7" fill="#1f2433" /><circle cx="49" cy="17" r="7" fill="#1f2433" />
      <circle cx="32" cy="35" r="20" fill="#fff" stroke="#d8dde8" />
      <ellipse cx="23" cy="33" rx="5.5" ry="7" transform="rotate(-20 23 33)" fill="#1f2433" />
      <ellipse cx="41" cy="33" rx="5.5" ry="7" transform="rotate(20 41 33)" fill="#1f2433" />
      <circle cx="24" cy="32" r="2" fill="#fff" /><circle cx="40" cy="32" r="2" fill="#fff" />
      <ellipse cx="32" cy="41" rx="3" ry="2" fill="#1f2433" />{smile(44, 3)}
      {cheeks(42)}
    </>) },
  { key: 'bear', label: 'หมีน้ำผึ้ง', bg: '#f6e3c8', draw: (
    <>
      <circle cx="15" cy="18" r="7" fill="#a0683b" /><circle cx="15" cy="18" r="3.5" fill="#e9b98a" />
      <circle cx="49" cy="18" r="7" fill="#a0683b" /><circle cx="49" cy="18" r="3.5" fill="#e9b98a" />
      <circle cx="32" cy="35" r="20" fill="#a0683b" />
      <ellipse cx="32" cy="42" rx="9" ry="7" fill="#e9b98a" />
      {eyes(31, 8, 2.8)}
      <ellipse cx="32" cy="39" rx="3.2" ry="2.3" fill="#1f2433" />{smile(43, 3)}
    </>) },
  { key: 'alien', label: 'มนุษย์ต่างดาวขี้สงสัย', bg: '#dcf7e6', draw: (
    <>
      <path d="M22 14l-4-7M42 14l4-7" stroke="#3aa76d" strokeWidth="2.5" /><circle cx="18" cy="7" r="3" fill="#f6a92e" /><circle cx="46" cy="7" r="3" fill="#f6a92e" />
      <path d="M32 12c13 0 20 9 20 20 0 13-10 24-20 24S12 45 12 32c0-11 7-20 20-20z" fill="#5cd394" />
      <ellipse cx="24" cy="32" rx="5" ry="7" fill="#1f2433" /><ellipse cx="40" cy="32" rx="5" ry="7" fill="#1f2433" />
      <circle cx="25.5" cy="29" r="1.8" fill="#fff" /><circle cx="41.5" cy="29" r="1.8" fill="#fff" />
      <ellipse cx="32" cy="46" rx="3" ry="2" fill="#1f2433" />
    </>) },
  { key: 'star', label: 'ดาวเด็กดี', bg: '#fff3c4', draw: (
    <>
      <path d="M32 6l7.6 15.6 17.2 2.5-12.4 12.1 2.9 17.1L32 45.2l-15.3 8.1 2.9-17.1L7.2 24.1l17.2-2.5z" fill="#f6b81c" stroke="#e8901a" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="26" cy="30" r="2.5" fill="#1f2433" /><circle cx="38" cy="30" r="2.5" fill="#1f2433" />
      {smile(36, 4)}{cheeks(36)}
    </>) },
  { key: 'plant', label: 'ต้นกล้าโตไว', bg: '#e1f5e0', draw: (
    <>
      <path d="M32 30V16" stroke="#3a8a3f" strokeWidth="3" />
      <path d="M32 20c-2-8-12-10-16-6 4 6 12 8 16 6zM32 18c2-8 12-10 16-6-4 6-12 8-16 6z" fill="#5cbf5f" />
      <path d="M16 32h32l-4 24H20z" fill="#d9774a" /><rect x="14" y="29" width="36" height="6" rx="2" fill="#c0603a" />
      <circle cx="26" cy="43" r="2.3" fill="#1f2433" /><circle cx="38" cy="43" r="2.3" fill="#1f2433" />
      {smile(48, 3.5)}
    </>) },
  { key: 'frog', label: 'กบกระโดดไกล', bg: '#d8f1f7', draw: (
    <>
      <circle cx="20" cy="20" r="9" fill="#58b85c" /><circle cx="44" cy="20" r="9" fill="#58b85c" />
      <ellipse cx="32" cy="38" rx="22" ry="17" fill="#58b85c" />
      <circle cx="20" cy="20" r="5.5" fill="#fff" /><circle cx="44" cy="20" r="5.5" fill="#fff" />
      <circle cx="21" cy="21" r="2.8" fill="#1f2433" /><circle cx="45" cy="21" r="2.8" fill="#1f2433" />
      <path d="M18 40q14 10 28 0" stroke="#1f2433" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {cheeks(37)}
    </>) },
  { key: 'penguin', label: 'เพนกวินเรียบร้อย', bg: '#dceaf6', draw: (
    <>
      <ellipse cx="32" cy="36" rx="19" ry="22" fill="#2a3243" />
      <path d="M32 18c-9 0-13 8-13 16 0 10 6 18 13 18s13-8 13-18c0-8-4-16-13-16z" fill="#fff" />
      {eyes(30, 6, 2.5)}
      <path d="M28 36h8l-4 4z" fill="#f6a92e" />
      <path d="M22 58h8M34 58h8" stroke="#f6a92e" strokeWidth="3.5" strokeLinecap="round" />
    </>) }
];

export const presetByKey = (k) => PRESETS.find(p => p.key === k);

export function PresetArt({ preset, className = '' }) {
  const p = typeof preset === 'string' ? presetByKey(preset) : preset;
  if (!p) return null;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <rect width="64" height="64" fill={p.bg} />
      {p.draw}
    </svg>
  );
}

export const displayNameOf = (u) => (u && (u.displayName || u.name || u.teacher?.name || u.student?.name || (u.role === 'ADMIN' ? t('ผู้ดูแลระบบ') : u.email))) || '';

const initialsOf = (name) => {
  const s = String(name || '?').replace(/^(ครู|นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.)\s*/, '').trim();
  return (s.match(/[A-Za-z0-9]|[ก-ฮ]/) || ['?'])[0];
};

// วงกลมรูปโปรไฟล์: รูปจริง > การ์ตูน > อักษรแรก
export default function Avatar({ user, size = 40, className = '', ring = '' }) {
  const name = displayNameOf(user);
  const preset = user?.avatarPreset && presetByKey(user.avatarPreset);
  const style = { width: size, height: size };
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full ${ring} ${className}`;
  if (user?.avatar) return <img src={user.avatar} alt="" style={style} className={`${base} object-cover`} />;
  if (preset) return <span style={style} className={base}><PresetArt preset={preset} className="h-full w-full" /></span>;
  return (
    <span style={{ ...style, fontSize: Math.round(size * 0.42) }} className={`${base} bg-brand-100 font-bold text-brand-800`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
