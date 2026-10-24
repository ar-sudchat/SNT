import React, { useEffect, useRef, useState } from 'react';
import THEMES, { DEFAULT_THEME } from '../theme/themes';

const KEY = 'snt-color-theme';

export function getTheme() {
  try { return localStorage.getItem(KEY) || DEFAULT_THEME; } catch (e) { return DEFAULT_THEME; }
}

export function applyTheme(id) {
  document.documentElement.setAttribute('data-color-theme', id);
  const meta = document.querySelector('meta[name="theme-color"]');
  const t = THEMES.find((x) => x.id === id);
  if (meta && t) meta.setAttribute('content', t.swatches[0]);
  try { localStorage.setItem(KEY, id); } catch (e) { /* ไม่มีที่เก็บ — ใช้ได้เฉพาะรอบนี้ */ }
}

// ปุ่มจานสี + รายการธีม (มือถือ = แผ่นเลื่อนจากล่าง, จอใหญ่ = popover)
export default function ThemePicker({ onChoose }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(getTheme);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const choose = (id) => { applyTheme(id); setCurrent(id); setOpen(false); if (onChoose) onChoose(); };

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        type="button"
        aria-label="ธีมสี"
        aria-expanded={open}
        title="ธีมสี"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3a9 9 0 100 18c1.1 0 1.7-.9 1.4-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 004-4c0-5.5-4-10-9-10z" />
          <circle cx="7.5" cy="11" r="1.2" fill="currentColor" /><circle cx="10" cy="7" r="1.2" fill="currentColor" /><circle cx="15" cy="7.5" r="1.2" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" aria-hidden="true" />
          <div
            role="dialog"
            aria-label="เลือกธีมสี"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 sm:rounded-xl sm:border sm:border-gray-200"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">ธีมสี</h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] px-3 text-sm text-gray-600 hover:text-gray-900">ปิด</button>
            </div>
            <ul className="grid gap-1">
              {THEMES.map((t) => {
                const on = t.id === current;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => choose(t.id)}
                      className={`flex w-full min-h-[48px] items-center gap-3 rounded-lg px-2 text-left text-sm ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'hover:bg-gray-50'}`}
                    >
                      <span className="flex shrink-0 overflow-hidden rounded-md ring-1 ring-black/10">
                        {t.swatches.map((c, i) => <span key={i} className="h-7 w-4" style={{ background: c }} />)}
                      </span>
                      <span className="flex-1 text-gray-800">{t.name}</span>
                      {on && <span className="text-brand-600" aria-hidden="true">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {current !== DEFAULT_THEME && (
              <button type="button" onClick={() => choose(DEFAULT_THEME)} className="mt-2 min-h-[44px] w-full rounded-lg text-sm text-gray-600 hover:bg-gray-50">กลับค่าเริ่มต้น</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
