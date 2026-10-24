import React from 'react';

// กรอบมือถือสมจริง (สัดส่วน 9:19.5) — ขนาดทุกอย่างอิงความกว้างกรอบด้วยหน่วย cqw
// ใช้แบบรูปภาพ: <Phone src alt /> หรือใส่เนื้อหาเอง: <Phone>{...}</Phone>
// screenshot ในเครื่อง (780×1688) เป็นสัดส่วนเดียวกับจอ จึงเห็นครบตั้งแต่หัวแอปถึงแถบล่าง
const StatusBar = ({ tone }) => (
  <div className={`relative flex h-[11cqw] shrink-0 items-center justify-between px-[7cqw] pt-[1cqw] ${tone}`}>
    <span className="text-[length:4.4cqw] font-semibold leading-none tracking-tight">9:41</span>
    <span className="flex items-center gap-[1.4cqw]" aria-hidden="true">
      <svg viewBox="0 0 18 12" className="h-[3.4cqw] w-auto" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
      <svg viewBox="0 0 16 12" className="h-[3.4cqw] w-auto" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1.5 4.2a9.5 9.5 0 0 1 13 0M4 7a6 6 0 0 1 8 0" /><circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" /></svg>
      <svg viewBox="0 0 26 12" className="h-[3.4cqw] w-auto" fill="none"><rect x="0.75" y="0.75" width="21.5" height="10.5" rx="3" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" /><rect x="2.5" y="2.5" width="16" height="7" rx="1.6" fill="currentColor" /><path d="M24 4v4" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.6" strokeLinecap="round" /></svg>
    </span>
  </div>
);

export default function Phone({ src, alt = '', children, className = '', style, eager = false, screenClass = 'bg-white', barClass = 'text-[#0b1020]' }) {
  return (
    <figure className={`${/(^|\s)(absolute|fixed)(\s|$)/.test(className) ? '' : 'relative '}[container-type:inline-size] ${className}`} style={style}>
      {/* ปุ่มข้างเครื่อง */}
      <span className="absolute -left-[1.1cqw] top-[17%] h-[5%] w-[1.4cqw] rounded-l-sm bg-[#2b303b]" aria-hidden="true" />
      <span className="absolute -left-[1.1cqw] top-[25%] h-[9%] w-[1.4cqw] rounded-l-sm bg-[#2b303b]" aria-hidden="true" />
      <span className="absolute -left-[1.1cqw] top-[36%] h-[9%] w-[1.4cqw] rounded-l-sm bg-[#2b303b]" aria-hidden="true" />
      <span className="absolute -right-[1.1cqw] top-[27%] h-[13%] w-[1.4cqw] rounded-r-sm bg-[#2b303b]" aria-hidden="true" />
      <div
        className="relative aspect-[9/19.5] rounded-[15.5cqw] bg-[#0d0f14] p-[3.4cqw]"
        style={{ boxShadow: 'inset 0 0 0 1.5px #565c69, inset 0 0 0 3px #15181f, 0 40px 70px -30px rgb(8 14 30 / 0.6), 0 12px 24px -12px rgb(8 14 30 / 0.35)' }}
      >
        <div className={`relative flex h-full flex-col overflow-hidden rounded-[12.2cqw] ${screenClass}`}>
          <span className="absolute left-1/2 top-[2.6cqw] z-10 h-[8.6cqw] w-[30cqw] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
          <StatusBar tone={barClass} />
          {src ? (
            <img src={src} alt={alt} width="780" height="1688" loading={eager ? 'eager' : 'lazy'} decoding="async"
              className="block min-h-0 w-full flex-1 object-cover object-top" />
          ) : children}
          <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgb(255_255_255/0.16),transparent_32%,transparent_70%,rgb(255_255_255/0.05))]" aria-hidden="true" />
        </div>
      </div>
    </figure>
  );
}
