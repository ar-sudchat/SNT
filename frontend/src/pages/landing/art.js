import { t } from '../../i18n';
import React from 'react';

// ภาพประกอบที่วาดเอง (SVG/HTML) สำหรับหน้าแรก — สมุด, QR, ภาพขั้นตอน, ไอคอนเส้น

// ---------- QR (ภาพประกอบ ไม่ใช่รหัสจริง) ----------
const qrCache = {};
function qrCells(seed) {
  if (qrCache[seed]) return qrCache[seed];
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
  let d = '';
  for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      if (!inFinder(x, y) && rnd() > 0.52) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  qrCache[seed] = d;
  return d;
}

export function QrGlyph({ seed = 7, className = '', ink = '#0c1833' }) {
  const finder = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill={ink} />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill={ink} />
    </g>
  );
  return (
    <svg viewBox="-1 -1 23 23" className={className} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <rect x="-1" y="-1" width="23" height="23" fill="#fff" />
      {finder(0, 0)}{finder(14, 0)}{finder(0, 14)}
      <path d={qrCells(seed)} fill={ink} />
    </svg>
  );
}

// ---------- ปกสมุดนักเรียน (มีป้ายชื่อแบบสมุดไทย + สติกเกอร์ QR) ----------
const COVERS = {
  blue: { cover: '#dfe8f8', spine: '#2b4f99' },
  gold: { cover: '#fdecc8', spine: '#e8901a' },
  green: { cover: '#d9f0e4', spine: '#16a36a' },
  rose: { cover: '#f8dfe3', spine: '#c2415d' },
};

export function NotebookCover({ name, room = 'ม.2/1', no, subject = 'คณิตศาสตร์', color = 'blue', seed = 3, size = 10, className = '', style }) {
  const c = COVERS[color] || COVERS.blue;
  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-[0.6em] ${className}`}
      style={{ fontSize: size, backgroundColor: c.cover, boxShadow: '0 0.6em 1.4em -0.4em rgb(8 14 30 / 0.45)', ...style }}
      aria-hidden="true"
    >
      <span className="absolute inset-y-0 left-0 w-[13%]" style={{ backgroundColor: c.spine }} />
      <span className="absolute inset-y-0 left-[13%] w-[2%] bg-black/10" />
      <div className="absolute left-[24%] right-[9%] top-[11%] rounded-[0.4em] bg-white px-[0.8em] py-[0.6em] leading-[1.45] text-[#26324d] shadow-[0_1px_0_rgb(0_0_0/0.08)]">
        <div className="text-[1.05em] font-bold" style={{ color: c.spine }}>{subject}</div>
        <div className="mt-[0.2em] truncate border-b border-dashed border-[#b9c3d6] text-[0.95em]"><span className="text-[#7a859c]">{t('ชื่อ ')}</span>{name}</div>
        <div className="mt-[0.2em] flex gap-[0.8em] border-b border-dashed border-[#b9c3d6] text-[0.95em]">
          <span><span className="text-[#7a859c]">{t('ชั้น ')}</span>{room}</span>
          <span><span className="text-[#7a859c]">{t('เลขที่ ')}</span>{no}</span>
        </div>
      </div>
      <div className="absolute bottom-[9%] right-[9%] w-[40%] rounded-[0.35em] bg-white p-[0.35em] shadow-[0_1px_2px_rgb(0_0_0/0.15)]">
        <QrGlyph seed={seed} className="block h-auto w-full" />
      </div>
    </div>
  );
}

// ---------- ภาพประกอบขั้นตอน (เส้น 2px ใช้สีจากธีม) ----------
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const A = 'rgb(var(--accent))';

export function StepArt({ step, className = '' }) {
  const common = { viewBox: '0 0 120 96', className, 'aria-hidden': true, focusable: 'false' };
  if (step === 1) {
    return (
      <svg {...common}>
        <rect x="14" y="10" width="40" height="74" rx="8" {...S} />
        <circle cx="34" cy="36" r="8" {...S} />
        <path d="M22 58c3-7 8-10 12-10s9 3 12 10" {...S} />
        <path d="M27 72h14" {...S} />
        <path d="M60 47h12" {...S} strokeDasharray="3 4" />
        <rect x="76" y="26" width="34" height="42" rx="7" {...S} />
        <circle cx="93" cy="41" r="5.5" fill={A} />
        <path d="M84 59c2-5 5-7 9-7s7 2 9 7" {...S} />
        <path d="M104 18v10M99 23h10" {...S} stroke={A} />
      </svg>
    );
  }
  if (step === 2) {
    return (
      <svg {...common}>
        <rect x="10" y="14" width="44" height="64" rx="4" {...S} />
        {[0, 1, 2].map(r => [0, 1].map(c => (
          <rect key={`${r}${c}`} x={16 + c * 19} y={20 + r * 19} width="13" height="13" rx="1.5" {...S} strokeWidth="1.6" />
        )))}
        <path d="M58 46h10" {...S} strokeDasharray="3 4" />
        <rect x="72" y="12" width="40" height="70" rx="5" {...S} />
        <path d="M80 12v70" {...S} />
        <rect x="88" y="52" width="17" height="17" rx="2" fill={A} />
        <path d="M91 55h4v4h-4zM98 62h4v4h-4z" fill="#fff" />
        <path d="M88 24h18M88 31h12" {...S} strokeWidth="1.8" />
      </svg>
    );
  }
  if (step === 3) {
    return (
      <svg {...common}>
        <rect x="10" y="30" width="46" height="58" rx="5" {...S} />
        <path d="M18 30v58" {...S} />
        <rect x="30" y="62" width="16" height="16" rx="2" {...S} strokeWidth="1.8" />
        <g transform="rotate(14 86 44)">
          <rect x="68" y="8" width="36" height="70" rx="8" {...S} />
          <path d="M76 26h6M76 26v6M96 26h-6M96 26v6M76 56h6M76 56v-6M96 56h-6M96 56v-6" stroke={A} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M74 41h24" stroke={A} strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <path d="M54 58l10-6M54 70l12-2" {...S} stroke={A} strokeDasharray="2 4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="8" y="12" width="64" height="72" rx="8" {...S} />
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          <path d={`M17 ${28 + i * 14}h26`} {...S} strokeWidth="1.8" />
          <rect x="50" y={23 + i * 14} width="14" height="9" rx="4.5" fill={i === 3 ? 'none' : '#d4443b'} stroke={i === 3 ? 'currentColor' : 'none'} strokeWidth="1.6" />
        </g>
      ))}
      <path d="M80 30h30a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H96l-9 8v-8h-7a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z" fill={A} />
      <path d="M84 41h22M84 50h14" stroke="#0c1833" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// ---------- ไอคอนเส้น 24px ----------
const I = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };
export const Icon = {
  Check: (p) => <svg {...I} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  Cross: (p) => <svg {...I} {...p}><path d="M7 7l10 10M17 7L7 17" /></svg>,
  Offline: (p) => <svg {...I} {...p}><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.3 4.4 4.4 0 0 0 7 18z" /><path d="M12 10.5v5M9.8 13.4L12 15.6l2.2-2.2" /></svg>,
  Ai: (p) => <svg {...I} {...p}><path d="M5 5h14v10H10l-4 4v-4H5z" /><path d="M12 7.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" /></svg>,
  Shuffle: (p) => <svg {...I} {...p}><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="M9 5v14M15 5v14" /><path d="M6.3 12h.01M12 10h.01M17.7 13.5h.01" strokeWidth="2.6" /></svg>,
  Table: (p) => <svg {...I} {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M9.5 9.5v10" /></svg>,
  Link: (p) => <svg {...I} {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>,
  Chart: (p) => <svg {...I} {...p}><path d="M4 20h16" /><rect x="6" y="11" width="3" height="6" rx="1" /><rect x="11" y="7" width="3" height="10" rx="1" /><rect x="16" y="13" width="3" height="4" rx="1" /></svg>,
  Megaphone: (p) => <svg {...I} {...p}><path d="M4 10v4a1 1 0 0 0 1 1h2l6 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M17 9a4 4 0 0 1 0 6" /></svg>,
  Plus: (p) => <svg {...I} {...p}><path d="M12 5v14M5 12h14" /></svg>,
  Arrow: (p) => <svg {...I} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
};

// ---------- ลายเส้นมือ: ขีดเส้นใต้ / ลูกศรโค้ง (ใช้สี accent จากธีม) ----------
export const Scribble = ({ className = '' }) => (
  <svg viewBox="0 0 300 24" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
    <path className="ks-draw" pathLength="1" d="M4 15c40-7 92-11 150-9 52 2 98 6 142 3M24 21c58-5 130-7 214-3" fill="none" stroke="rgb(var(--accent))" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
);

export const CurlyArrow = ({ className = '' }) => (
  <svg viewBox="0 0 90 70" className={className} fill="none" aria-hidden="true" focusable="false">
    <path className="ks-draw" pathLength="1" d="M6 10c22-4 44 4 46 20 2 14-14 18-18 8s12-20 30-6c8 6 12 16 14 28" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinecap="round" />
    <path d="M70 52l8 10 6-12" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ---------- กลุ่มครู (สมาชิกเข้ากลุ่มด้วยรหัส) ----------
export const TeacherGroup = ({ className = 'h-28 w-auto text-brand-600' }) => (
  <svg viewBox="0 0 200 120" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M28 104c0-18 10-30 24-30s24 12 24 30" fill="rgb(var(--brand-100))" />
    <circle cx="52" cy="54" r="13" fill="rgb(var(--card))" />
    <path d="M124 104c0-18 10-30 24-30s24 12 24 30" fill="rgb(var(--brand-100))" />
    <circle cx="148" cy="54" r="13" fill="rgb(var(--card))" />
    <path d="M70 108c0-22 13-38 30-38s30 16 30 38" fill="rgb(var(--accent) / 0.35)" />
    <circle cx="100" cy="44" r="16" fill="rgb(var(--card))" />
    <path d="M94 44h.01M106 44h.01" strokeWidth="3" />
    <path d="M95 50c3 2.5 7 2.5 10 0" strokeWidth="1.6" />
    <path d="M14 108h172" />
    <path d="M100 14v8M86 18l4 6M114 18l-4 6" stroke="rgb(var(--accent))" />
  </svg>
);

// ---------- ฟองแชทห้องเรียน (คล้ายแอปแชท ไม่ใช่โลโก้ใคร) ----------
export const ChatLine = ({ className = 'h-24 w-auto text-brand-600' }) => (
  <svg viewBox="0 0 140 100" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M14 14h70a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H42l-14 12V58H14a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8z" fill="rgb(var(--brand-100))" />
    <path d="M18 30h56M18 42h36" />
    <path d="M60 52h62a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-8v10l-12-10H60a8 8 0 0 1-8-8V60a8 8 0 0 1 8-8z" fill="rgb(var(--accent) / 0.35)" />
    <path d="M64 68l6 6 12-12" stroke="#16a36a" strokeWidth="2.6" />
    <path d="M90 70h28" />
  </svg>
);

// ---------- ลายพื้นหลัง: จุดตาราง / สี่เหลี่ยมแบบ QR (จางๆ วางใน container relative) ----------
export const QrPattern = ({ className = 'text-brand-600/[0.07]', id = 'ks-qr' }) => (
  <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true" focusable="false">
    <defs>
      <pattern id={id} width="96" height="96" patternUnits="userSpaceOnUse">
        <path d="M8 8h18v18H8zM12 12v10h10V12z M70 8h18v18H70zM74 12v10h10V12z M8 70h18v18H8zM12 74v10h10V74z" fill="currentColor" fillRule="evenodd" />
        <path d="M40 10h6v6h-6zM52 16h6v6h-6zM40 34h6v6h-6zM58 40h6v6h-6zM34 52h6v6h-6zM70 52h6v6h-6zM46 64h6v6h-6zM76 76h6v6h-6zM58 82h6v6h-6z" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);
