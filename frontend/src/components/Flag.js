import React from 'react';

// ธงประจำภาษา (SVG ในตัว — อีโมจิธงบน Windows แสดงเป็นตัวอักษร "TH" ไม่ใช่ธง)
// อังกฤษ = สหราชอาณาจักร · จีน = จีนแผ่นดินใหญ่ (ตรงกับ 简体中文) · เกาหลี = เกาหลีใต้
const star = (cx, cy, r, rot = -90) => Array.from({ length: 10 }, (_, i) => {
  const a = ((rot + i * 36) * Math.PI) / 180;
  const d = i % 2 ? r * 0.382 : r;
  return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`;
}).join(' ');

const KR_DIAG = (Math.atan2(2, 3) * 180) / Math.PI; // ขีดแปดเหลี่ยมอยู่บนเส้นทแยงของธง 3:2

const FLAGS = {
  th: (
    <>
      <rect width="30" height="20" fill="#A51931" />
      <rect y="3.33" width="30" height="13.34" fill="#F4F5F8" />
      <rect y="6.67" width="30" height="6.66" fill="#2D2A4A" />
    </>
  ),
  en: (
    <svg viewBox="0 0 60 30" width="30" height="20" preserveAspectRatio="xMidYMid slice">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  ),
  zh: (
    <>
      <rect width="30" height="20" fill="#EE1C25" />
      <polygon points={star(5, 5, 3)} fill="#FFFF00" />
      {[[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => <polygon key={`${x}${y}`} points={star(x, y, 1)} fill="#FFFF00" />)}
    </>
  ),
  ja: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#BC002D" />
    </>
  ),
  ko: (
    <>
      <rect width="30" height="20" fill="#fff" />
      <g transform={`rotate(${KR_DIAG} 15 10)`}>
        <circle cx="15" cy="10" r="5" fill="#003478" />
        <path d="M10 10a5 5 0 0 1 10 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 0-5 0z" fill="#C60C30" />
      </g>
      {[180 + KR_DIAG, -KR_DIAG, KR_DIAG, 180 - KR_DIAG].map((a) => (
        <g key={a} transform={`translate(15 10) rotate(${a}) translate(8.2 0)`} fill="#000">
          {[-1.1, 0, 1.1].map((x) => <rect key={x} x={x - 0.35} y="-1.8" width="0.7" height="3.6" />)}
        </g>
      ))}
    </>
  ),
  fr: (
    <>
      <rect width="10" height="20" fill="#002654" />
      <rect x="10" width="10" height="20" fill="#fff" />
      <rect x="20" width="10" height="20" fill="#CE1126" />
    </>
  ),
  de: (
    <>
      <rect width="30" height="6.67" fill="#000" />
      <rect y="6.67" width="30" height="6.66" fill="#DD0000" />
      <rect y="13.33" width="30" height="6.67" fill="#FFCE00" />
    </>
  ),
};

export default function Flag({ lang, className = 'h-4 w-6' }) {
  if (!FLAGS[lang]) return null;
  return (
    <svg viewBox="0 0 30 20" className={`shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 ${className}`} aria-hidden="true" focusable="false">
      {FLAGS[lang]}
    </svg>
  );
}
