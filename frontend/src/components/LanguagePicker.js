import React, { useEffect, useRef, useState } from 'react';
import { LANGS, t, useLang } from '../i18n';
import Flag from './Flag';

// ปุ่มลูกโลก + รายการภาษา (มือถือ = แผ่นเลื่อนจากล่าง, จอใหญ่ = popover) · แบบเดียวกับ ThemePicker
export default function LanguagePicker({ onChoose, compact = false, dark = false }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const choose = (id) => { setOpen(false); if (onChoose) onChoose(); if (id !== lang) setLang(id); };
  const currentName = (LANGS.find(l => l.id === lang) || LANGS[0]).name;

  return (
    <div className="relative shrink-0" ref={boxRef}>
      <button
        type="button"
        aria-label={`${t('ภาษา')}: ${currentName}`}
        aria-expanded={open}
        title={t('ภาษา')}
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-11 items-center justify-center gap-1.5 rounded-lg border focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${dark ? 'border-white/30 text-title-fg hover:bg-white/10' : 'border-ink-200 text-ink-600 hover:bg-gray-50'} ${compact ? 'w-11' : 'px-3'}`}
      >
        <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
        </svg>
        {compact
          ? <Flag lang={lang} className="absolute -bottom-1 -right-1 h-3 w-[18px] ring-2 ring-white" />
          : <><Flag lang={lang} className="h-3.5 w-5" /><span className="text-sm">{currentName}</span></>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" aria-hidden="true" />
          <div
            role="dialog"
            aria-label={t('เลือกภาษา')}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-64 sm:rounded-xl sm:border sm:border-gray-200"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{t('ภาษา')}</h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] px-3 text-sm text-gray-600 hover:text-gray-900">{t('ปิด')}</button>
            </div>
            <ul className="grid gap-1">
              {LANGS.map((l) => {
                const on = l.id === lang;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      lang={l.id}
                      aria-pressed={on}
                      onClick={() => choose(l.id)}
                      className={`flex w-full min-h-[48px] items-center gap-3 rounded-lg px-3 text-left text-sm ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'hover:bg-gray-50'}`}
                    >
                      <Flag lang={l.id} />
                      <span className="flex-1 text-gray-800">{l.name}</span>
                      {on && <span className="text-brand-600" aria-hidden="true">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
