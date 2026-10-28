import React, { useEffect, useRef } from 'react';

// แถบตัวกรองด่วน (ชิป) เลื่อนแนวนอนได้ · แสดงอยู่นอกปุ่ม "ตัวกรอง" เพื่อให้แตะกรองด้วยนิ้วเดียว
// options: [{ value, label, count? }] · value = null/undefined = ทั้งหมด
// ชิปที่นับได้ 0 จะจางลงแต่ยังแตะได้ (ผลลัพธ์ว่างมีข้อความอธิบายอยู่แล้ว) · ชิปที่เลือกเลื่อนเข้ามากลางแถบเอง
const QuickFilterBar = ({ label, allLabel, options, value, onChange, allCount, hideAll = false }) => {
  const scroller = useRef(null);

  useEffect(() => {
    const el = scroller.current?.querySelector('[aria-pressed="true"]');
    if (!el || !scroller.current) return;
    const box = scroller.current;
    const target = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [value]);

  const chip = (on, empty) =>
    `inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3.5 text-sm font-medium transition ${
      on ? 'border-brand-600 bg-brand-600 text-white'
        : empty ? 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
          : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'
    }`;
  const count = (n, on) => (n === undefined ? null : <span className={`text-xs tabular-nums ${on ? 'text-white/85' : 'text-gray-500'}`}>{n}</span>);
  return (
    <div role="group" aria-label={label} className="flex items-start gap-2 sm:gap-3">
      <span className="flex min-h-[40px] w-14 shrink-0 items-center whitespace-nowrap text-xs font-medium text-gray-600 sm:w-20 sm:text-sm">{label}</span>
      <div ref={scroller} className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {!hideAll && (
          <button type="button" aria-pressed={value == null} onClick={() => onChange(null)} className={`${chip(value == null, false)} min-w-[5.5rem] justify-center`}>
            {allLabel}{count(allCount, value == null)}
          </button>
        )}
        {options.map(o => {
          const on = value === o.value;
          return (
            <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on && !hideAll ? null : o.value)} className={chip(on, o.count === 0)}>
              {o.label}{count(o.count, on)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickFilterBar;
