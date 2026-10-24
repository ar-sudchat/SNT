import React from 'react';

// ภาพลายเส้นวาดเอง: สีหลัก = currentColor (ใส่ text-brand-600 ที่ className) · สีรอง = accent
// ทุกภาพเป็น decoration ล้วน (aria-hidden) ปรับขนาดด้วย className เช่น h-28 w-auto

const base = (className) => ({
  className,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
});

const AMBER = '#f6a92e';
const SKY = '#b7cbec';

// สมุดนักเรียน + QR บนปก + กรอบสแกน
export const NotebookQR = ({ className = 'h-32 w-auto text-brand-600', accent = AMBER }) => (
  <svg viewBox="0 0 160 140" {...base(className)}>
    <rect x="34" y="22" width="80" height="104" rx="6" fill={SKY} fillOpacity=".35" />
    <path d="M44 22v104" />
    <path d="M30 40h8M30 60h8M30 80h8M30 100h8" />
    <rect x="62" y="44" width="36" height="36" rx="3" fill="#fff" />
    <path d="M68 50h8v8h-8zM84 50h8v8h-8zM68 66h8v8h-8z" strokeWidth="1.75" />
    <path d="M86 68h2M90 72h2M86 74h2M90 66h2" strokeWidth="2.5" />
    <path d="M62 96h36M62 106h22" strokeWidth="1.5" />
    {/* กรอบสแกน */}
    <g stroke={accent} strokeWidth="3">
      <path d="M52 40v-8h8M108 40v-8h-8M52 84v8h8M108 84v8h-8" />
    </g>
    <path d="M128 30l4-4M134 44h6M128 58l4 4" stroke={accent} />
  </svg>
);

// กองสมุดส่งครบ + เครื่องหมายถูก + ดาว (ดาวกระพริบเบาๆ ถ้าผู้ใช้ไม่ปิด motion)
export const StackDone = ({ className = 'h-28 w-auto text-brand-600', accent = AMBER }) => (
  <svg viewBox="0 0 160 120" {...base(className)}>
    <rect x="38" y="84" width="76" height="14" rx="3" fill={SKY} fillOpacity=".5" />
    <rect x="44" y="70" width="70" height="14" rx="3" />
    <rect x="34" y="56" width="74" height="14" rx="3" fill={SKY} fillOpacity=".5" />
    <path d="M50 77h40M44 91h50M42 63h44" strokeWidth="1.5" />
    <circle cx="110" cy="36" r="18" fill="#fff" />
    <path d="M101 36l6 6 12-12" strokeWidth="2.5" />
    <g stroke={accent} className="motion-safe:animate-pulse">
      <path d="M58 26l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill={accent} fillOpacity=".3" />
      <path d="M140 66v8M136 70h8M30 38v6M27 41h6" />
    </g>
  </svg>
);

// กล่องเปล่า (ไม่มีข้อมูล)
export const EmptyBox = ({ className = 'h-20 w-auto text-brand-600', accent = SKY }) => (
  <svg viewBox="0 0 120 90" {...base(className)} strokeWidth="1.75">
    <path d="M24 40l36-14 36 14v30l-36 14-36-14z" fill={accent} fillOpacity=".35" />
    <path d="M24 40l36 14 36-14M60 54v30" />
    <path d="M24 40l-10 12 36 14 10-12M96 40l10 12-36 14-10-12" fill="#fff" />
    <path d="M50 14l4 6M60 10v8M70 14l-4 6" />
  </svg>
);

// ครูโบกมือทักทาย ข้างโต๊ะ
export const TeacherWave = ({ className = 'h-24 w-auto text-brand-600', accent = AMBER }) => (
  <svg viewBox="0 0 140 110" {...base(className)}>
    <circle cx="58" cy="30" r="13" fill="#fff" />
    <path d="M53 31h.01M63 31h.01" strokeWidth="3" />
    <path d="M54 36c2.5 2 5.5 2 8 0" strokeWidth="1.5" />
    <path d="M38 76c0-14 9-26 20-26s20 12 20 26" fill={SKY} fillOpacity=".5" />
    <path d="M74 58l14-16" />
    <path d="M86 36l4 2M92 30l2 4M84 30l1 3" stroke={accent} />
    <path d="M18 76h104M28 76v26M112 76v26" />
    <rect x="88" y="62" width="22" height="14" rx="2" fill={accent} fillOpacity=".35" stroke={accent} />
    <path d="M30 70l18-6" stroke={accent} strokeWidth="3" />
  </svg>
);

// ไฟล์นำเข้า + ลูกศรลง
export const ImportFile = ({ className = 'h-16 w-auto text-brand-600', accent = AMBER }) => (
  <svg viewBox="0 0 120 90" {...base(className)} strokeWidth="1.75">
    <path d="M30 10h34l16 16v54H30z" fill={SKY} fillOpacity=".35" />
    <path d="M64 10v16h16" />
    <path d="M40 40h30M40 50h30M40 60h18M54 34v32M40 34h30v32H40z" strokeWidth="1.25" />
    <path d="M96 30v30M88 52l8 8 8-8" stroke={accent} strokeWidth="2.5" />
  </svg>
);

// ภาพหน้าเข้าสู่ระบบ: โต๊ะครู สมุด ดินสอ QR (ลายเส้นสีขาวบนพื้นน้ำเงิน)
export const SchoolLogin = ({ className = 'h-40 w-auto text-white', accent = AMBER }) => (
  <svg viewBox="0 0 220 160" {...base(className)}>
    <path d="M14 128h192M30 128v26M190 128v26" />
    <path d="M44 128l6-28h56l6 28" fill="currentColor" fillOpacity=".12" />
    <path d="M78 100V60" />
    <rect x="62" y="40" width="32" height="20" rx="3" />
    <path d="M70 47h16M70 53h10" strokeWidth="1.5" />
    {/* กองสมุด */}
    <rect x="122" y="112" width="58" height="16" rx="3" fill="currentColor" fillOpacity=".12" />
    <rect x="128" y="96" width="52" height="16" rx="3" />
    <rect x="120" y="80" width="54" height="16" rx="3" fill="currentColor" fillOpacity=".12" />
    <rect x="152" y="54" width="22" height="22" rx="2" />
    <path d="M156 58h5v5h-5zM165 58h5v5h-5zM156 67h5v5h-5z" strokeWidth="1.5" />
    <path d="M158 54v-6h-6M168 54v-6h6" stroke={accent} strokeWidth="2.5" />
    {/* ดินสอ */}
    <path d="M24 118l40-40 8 8-40 40-10 2z" />
    <path d="M58 84l8 8" stroke={accent} strokeWidth="3" />
    <path d="M28 20l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" stroke={accent} fill={accent} fillOpacity=".3" />
    <path d="M196 30v8M192 34h8M120 20v6M117 23h6" stroke={accent} />
  </svg>
);

// ลายจุดพื้นหลังจางๆ (วางใน container ที่ relative)
export const DotPattern = ({ className = 'text-white/20' }) => (
  <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <pattern id="snt-dots" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="1.4" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#snt-dots)" />
  </svg>
);

// ฟองแชทผู้ช่วย AI
export const ChatSpark = ({ className = 'h-20 w-auto text-brand-600', accent = AMBER }) => (
  <svg viewBox="0 0 120 90" {...base(className)} strokeWidth="1.75">
    <path d="M18 18h60a8 8 0 018 8v26a8 8 0 01-8 8H44l-14 12V60H18a8 8 0 01-8-8V26a8 8 0 018-8z" fill={SKY} fillOpacity=".35" />
    <path d="M26 34h44M26 44h28" />
    <path d="M98 20l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" stroke={accent} fill={accent} fillOpacity=".3" />
    <path d="M100 56v6M97 59h6" stroke={accent} />
  </svg>
);
