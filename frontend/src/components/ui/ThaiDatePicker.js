import { t, getLang } from '../../i18n';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ช่องวันที่แบบไทย: เลือกจากปฏิทินเท่านั้น "หลายวัน" / "ช่วงวันที่"
// onChange(ข้อความ, วันจริง) เช่น ("3, 9, 10 มิ.ย. 69", ['2026-06-03', ...]) · วันจริงใช้คิวรี ข้อความใช้แสดง/พิมพ์
const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MONTH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
// ภาษาต่างประเทศแสดงปี ค.ศ. บนปฏิทิน (ข้อความวันที่ที่บันทึกยังเป็น พ.ศ.)
const yearOffset = () => (getLang() === 'th' || getLang() === 'qa' ? 543 : 0);
// หัวสัปดาห์ตามภาษาที่เลือก (ตัวย่อไทยตัวเดียวชนกับคำอื่น จึงไม่ผ่านพจนานุกรม)
const weekdays = () => {
  const lang = getLang();
  if (lang === 'th' || lang === 'qa') return WEEKDAYS;
  const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + i)));
};

const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const sameDay = (a, b) => a && b && key(a) === key(b);
const yy = (d) => String(d.getFullYear() + 543).slice(-2);
const sortDates = (list) => [...list].sort((a, b) => a - b);
const pad = (n) => String(n).padStart(2, '0');
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (v) => { const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };
const MAX_DAYS = 62;
const daysOf = (from, to) => {
  if (!from) return [];
  const [a, b] = !to ? [from, from] : from < to ? [from, to] : [to, from];
  const out = [];
  for (let d = new Date(a); d <= b && out.length < MAX_DAYS; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) out.push(toIso(d));
  return out;
};
// วันต่อเนื่องกันตั้งแต่ 3 วัน = เปิดเป็นโหมดช่วงวันที่
const asRange = (list) => list.length > 2 && list.every((v, i) => i === 0 || fromIso(v) - fromIso(list[i - 1]) <= 90000000);

// หลายวัน: จัดกลุ่มตามเดือน "3, 9, 10 มิ.ย. 69" · ข้ามเดือน "28, 30 พ.ค. และ 3 มิ.ย. 69"
export function formatThaiDates(dates) {
  const list = sortDates(dates);
  if (!list.length) return '';
  const groups = [];
  list.forEach(d => {
    const g = groups[groups.length - 1];
    if (g && g.m === d.getMonth() && g.y === d.getFullYear()) g.days.push(d.getDate());
    else groups.push({ m: d.getMonth(), y: d.getFullYear(), days: [d.getDate()] });
  });
  const oneYear = groups.every(g => g.y === groups[0].y);
  return groups.map((g, i) => {
    const showYear = !oneYear || i === groups.length - 1;
    return `${g.days.join(', ')} ${MONTH_SHORT[g.m]}${showYear ? ` ${String(g.y + 543).slice(-2)}` : ''}`;
  }).join(' และ ');
}

// ช่วงวันที่: "19-20 พ.ค. 69" · ข้ามเดือน "30 พ.ค. - 2 มิ.ย. 69"
export function formatThaiRange(from, to) {
  if (!from) return '';
  if (!to || sameDay(from, to)) return formatThaiDates([from]);
  const [a, b] = from < to ? [from, to] : [to, from];
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${a.getDate()}-${b.getDate()} ${MONTH_SHORT[b.getMonth()]} ${yy(b)}`;
  const aYear = a.getFullYear() !== b.getFullYear() ? ` ${yy(a)}` : '';
  return `${a.getDate()} ${MONTH_SHORT[a.getMonth()]}${aYear} - ${b.getDate()} ${MONTH_SHORT[b.getMonth()]} ${yy(b)}`;
}

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export default function ThaiDatePicker({ value, dates = [], onChange, placeholder = t('แตะเพื่อเลือกวันที่'), id, inputClassName = '' }) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('multi'); // multi | range
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [picked, setPicked] = useState([]);
  const [range, setRange] = useState({ from: null, to: null });
  const days = useMemo(() => monthGrid(view.y, view.m), [view]);
  const anchorRef = useRef(null);
  const [pos, setPos] = useState(null);

  // ปฏิทินลอยเหนือทุกอย่าง (portal) วางใต้ช่อง ถ้าที่ข้างล่างไม่พอให้เด้งขึ้นบน
  const PANEL_H = 470;
  const place = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 300), 380, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < PANEL_H && above > below;
    setPos(up
      ? { left, width, bottom: window.innerHeight - r.top + 6, maxHeight: above - 8 }
      : { left, width, top: r.bottom + 6, maxHeight: below - 8 });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // เปิดปฏิทิน: ตั้งค่าที่เลือกไว้จากวันจริงที่มีอยู่
  const openPicker = () => {
    const list = [...dates].sort();
    const ds = list.map(fromIso);
    if (asRange(list)) { setMode('range'); setRange({ from: ds[0], to: ds[ds.length - 1] }); setPicked([]); }
    else { setMode('multi'); setPicked(ds); setRange({ from: null, to: null }); }
    if (ds.length) setView({ y: ds[0].getFullYear(), m: ds[0].getMonth() });
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (nextPicked, nextRange, nextMode = mode) => {
    if (nextMode === 'multi') onChange(formatThaiDates(nextPicked), sortDates(nextPicked).slice(0, MAX_DAYS).map(toIso));
    else onChange(formatThaiRange(nextRange.from, nextRange.to), daysOf(nextRange.from, nextRange.to));
  };
  const clickDay = (d) => {
    if (mode === 'multi') {
      const next = picked.some(x => sameDay(x, d)) ? picked.filter(x => !sameDay(x, d)) : [...picked, d];
      setPicked(next); emit(next, range);
    } else {
      // คลิกแรก = วันเริ่ม · คลิกสอง = วันสิ้นสุด · คลิกสาม = เริ่มใหม่
      const next = !range.from || range.to ? { from: d, to: null } : { from: range.from, to: d };
      setRange(next); emit(picked, next);
    }
  };
  const switchMode = (m) => { setMode(m); emit(picked, range, m); };
  const clear = () => { setPicked([]); setRange({ from: null, to: null }); onChange('', []); };
  const shift = (n) => setView(v => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const inRange = (d) => {
    const { from, to } = range;
    if (!from || !to) return false;
    const [a, b] = from < to ? [from, to] : [to, from];
    return d >= a && d <= b;
  };
  const isOn = (d) => (mode === 'multi' ? picked.some(x => sameDay(x, d)) : sameDay(d, range.from) || sameDay(d, range.to) || inRange(d));

  return (
    <div>
      <div ref={anchorRef} className="mt-1 flex gap-2">
        <input
          id={id}
          type="text"
          readOnly
          value={value}
          onClick={() => (open ? setOpen(false) : openPicker())}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); openPicker(); } }}
          placeholder={placeholder}
          aria-haspopup="dialog"
          className={`block min-h-[44px] w-full min-w-0 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 ${inputClassName}`}
        />
        <button
          type="button"
          onClick={() => (open ? setOpen(false) : openPicker())}
          aria-expanded={open}
          aria-label={open ? t('ปิดปฏิทิน') : t('เลือกจากปฏิทิน')}
          className={`flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border ${open ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
      </div>

      {open && pos && createPortal(
        <>
        <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} aria-hidden="true" />
        <div
          role="dialog"
          aria-label={t("เลือกวันที่")}
          className="fixed z-[9999] overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
          style={pos}
        >
          <div role="group" aria-label={t("แบบการเลือก")} className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
            {[['multi', t('หลายวัน')], ['range', t('ช่วงวันที่')]].map(([m, label]) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => switchMode(m)}
                className={`min-h-[40px] rounded-md text-sm font-medium ${mode === m ? 'bg-white text-brand-700 shadow' : 'text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label={t("เดือนก่อน")} className="min-h-[40px] min-w-[40px] rounded-lg text-gray-600 hover:bg-gray-100">‹</button>
            <span className="font-medium text-gray-800">{t(MONTH_FULL[view.m])} {view.y + yearOffset()}</span>
            <button type="button" onClick={() => shift(1)} aria-label={t("เดือนถัดไป")} className="min-h-[40px] min-w-[40px] rounded-lg text-gray-600 hover:bg-gray-100">›</button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
            {weekdays().map(w => <span key={w} className="py-1">{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(d => {
              const other = d.getMonth() !== view.m;
              const on = isOn(d);
              const edge = mode === 'range' && (sameDay(d, range.from) || sameDay(d, range.to));
              return (
                <button
                  key={key(d)}
                  type="button"
                  onClick={() => clickDay(d)}
                  aria-pressed={on}
                  aria-label={`${d.getDate()} ${t(MONTH_FULL[d.getMonth()])} ${d.getFullYear() + yearOffset()}`}
                  className={`min-h-[40px] rounded-lg text-sm tabular-nums ${
                    on ? (mode === 'range' && !edge ? 'bg-brand-100 text-brand-800' : 'bg-brand-600 font-semibold text-white')
                      : other ? 'text-gray-300 hover:bg-gray-50' : 'text-gray-800 hover:bg-gray-100'
                  } ${sameDay(d, today) && !on ? 'ring-1 ring-brand-300' : ''}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            {mode === 'multi' ? t('แตะวันที่สอนได้หลายวัน แตะซ้ำเพื่อเอาออก') : t('แตะวันเริ่ม แล้วแตะวันสุดท้าย')}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={clear} className="min-h-[44px] flex-1 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">{t("ล้าง")}</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] flex-1 rounded-lg bg-brand-600 text-sm font-medium text-white hover:bg-brand-700">{t("เสร็จ")}</button>
          </div>
        </div>
        </>,
        document.body
      )}
    </div>
  );
}
