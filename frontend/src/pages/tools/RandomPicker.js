import { t, tx } from '../../i18n';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { prefersReducedMotion, btnPrimary, btnSecondary } from './toolsUtils';
import { sfx } from './game/sfx';
import { seatNo, SPIN_MS } from './game/common';
import Confetti from './game/Confetti';
import Slot from './game/Slot';

// เจ้าของสั่งให้เหลือแค่สล็อต (วงล้อ/ไข่สุ่มยังอยู่ใน game/ ถ้าจะเปิดกลับ)
const MODES = [
  { key: 'slot', icon: '🎰', label: 'สล็อต' },
];
const btnAccent = 'min-h-[44px] px-5 rounded-lg bg-accent-400 text-ink-900 font-bold hover:bg-accent-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2';
const MODE_KEY = 'kruscan.picker.mode';
const readMode = () => {
  try { const m = window.localStorage.getItem(MODE_KEY); return MODES.some((x) => x.key === m) ? m : 'slot'; } catch (e) { return 'slot'; }
};

const RandomPicker = ({ students }) => {
  const [noRepeat, setNoRepeat] = useState(true);
  const [pickedIds, setPickedIds] = useState([]);
  const [mode, setMode] = useState(readMode);
  const [muted, setMuted] = useState(sfx.isMuted());
  const [spin, setSpin] = useState(null); // { key, index, entries }
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [fire, setFire] = useState(0);
  const [stars, setStars] = useState({});
  const [starred, setStarred] = useState(false);
  const [announce, setAnnounce] = useState('');
  const rootRef = useRef(null);
  const stopDrum = useRef(() => {});
  const spinRef = useRef(null);
  spinRef.current = spin;
  const reduced = prefersReducedMotion();

  const all = useMemo(() => students.map((s, i) => ({ id: s.id, no: seatNo(s, i), name: s.name || '-' })), [students]);
  const pool = noRepeat ? all.filter((e) => !pickedIds.includes(e.id)) : all;
  const exhausted = noRepeat && pool.length === 0;
  // ระหว่างหมุนใช้รายชื่อชุดที่ล็อกไว้
  const entries = spin ? spin.entries : (pool.length ? pool : all);

  const resetRound = useCallback(() => {
    stopDrum.current();
    setPickedIds([]); setSpin(null); setSpinning(false); setWinner(null); setShowCard(false); setStars({}); setAnnounce('');
  }, []);
  useEffect(() => { resetRound(); }, [students, resetRound]);
  useEffect(() => () => stopDrum.current(), []);

  const pick = useCallback(() => {
    if (spinning || pool.length === 0) return;
    sfx.unlock();
    const index = Math.floor(Math.random() * pool.length);
    setShowCard(false); setWinner(null); setStarred(false); setAnnounce('');
    setSpinning(true);
    if (!reduced) stopDrum.current = sfx.drumroll(SPIN_MS - 150);
    setSpin({ key: Date.now(), index, entries: pool });
  }, [spinning, pool, reduced]);

  const onDone = useCallback(() => {
    stopDrum.current();
    const sp = spinRef.current;
    if (!sp) return;
    const w = sp.entries[sp.index];
    setWinner(w);
    setPickedIds((p) => (p.includes(w.id) ? p : [...p, w.id]));
    setAnnounce(t('ผู้โชคดีคือ เลขที่ {value1} {value2}', { value1: w.no, value2: w.name }));
    setSpinning(false);
    sfx.fanfare();
    setTimeout(() => { setShowCard(true); setFire((f) => f + 1); }, reduced ? 0 : 450);
  }, [reduced]);

  const again = useCallback(() => { setShowCard(false); setSpin(null); setTimeout(() => pick(), 0); }, [pick]);
  const close = useCallback(() => setShowCard(false), []);
  const addStar = () => {
    if (!winner || starred) return;
    sfx.star();
    setStarred(true);
    setStars((s) => ({ ...s, [winner.id]: (s[winner.id] || 0) + 1 }));
  };

  const changeMode = (m) => {
    if (spinning) return;
    setMode(m); setSpin(null); setShowCard(false);
    try { window.localStorage.setItem(MODE_KEY, m); } catch (e) { /* storage ปิดอยู่ */ }
  };
  const toggleMute = () => { const m = !muted; sfx.setMuted(m); setMuted(m); if (m) stopDrum.current(); };
  const toggleFs = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (rootRef.current && rootRef.current.requestFullscreen) rootRef.current.requestFullscreen();
    } catch (e) { /* ไม่รองรับ */ }
  };

  // คีย์ลัด: Space = สุ่ม · Enter = สุ่มอีกครั้ง · Esc = ปิดการ์ด
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const tag = t && t.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
      if ((tag === 'BUTTON' || tag === 'A') && (e.key === ' ' || e.key === 'Enter')) return;
      if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); if (showCard) again(); else pick(); }
      else if (e.key === 'Enter' && showCard) { e.preventDefault(); again(); }
      else if (e.key === 'Escape' && showCard) { close(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick, again, close, showCard]);

  const pickedList = pickedIds.map((id) => all.find((e) => e.id === id)).filter(Boolean);
  const top = Object.entries(stars).map(([id, n]) => ({ e: all.find((x) => String(x.id) === id), n }))
    .filter((x) => x.e).sort((a, b) => b.n - a.n).slice(0, 5);
  const canFs = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;
  const Stage = Slot;

  return (
    <div ref={rootRef} className="relative space-y-4 bg-ink-50 rounded-2xl p-3 sm:p-5 [&:fullscreen]:overflow-auto [&:fullscreen]:rounded-none [&:fullscreen]:p-8">
      <div className="sr-only" role="status" aria-live="assertive">{announce}</div>

      {/* แถบโหมด */}
      <div className="flex flex-wrap items-center gap-2">
        {MODES.length > 1 && <div role="radiogroup" aria-label={t("รูปแบบการสุ่ม")} className="inline-flex p-1 rounded-xl bg-white border border-ink-200 flex-1 sm:flex-none">
          {MODES.map((m) => (
            <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} disabled={spinning}
              onClick={() => changeMode(m.key)}
              className={`min-h-[44px] flex-1 sm:flex-none px-3 sm:px-5 rounded-lg font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${mode === m.key ? 'bg-brand text-white shadow' : 'text-ink-700 hover:bg-ink-50'}`}>
              <span aria-hidden="true" className="mr-1">{m.icon}</span>{t(m.label)}
            </button>
          ))}
        </div>}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={toggleMute} className={`${btnSecondary} min-w-[44px]`} aria-pressed={muted} aria-label={muted ? t('เปิดเสียง') : t('ปิดเสียง')} title={muted ? t('เปิดเสียง') : t('ปิดเสียง')}>
            {muted ? '🔇' : '🔊'}
          </button>
          {canFs && <button type="button" onClick={toggleFs} className={`${btnSecondary} min-w-[44px]`} aria-label={t("เต็มจอ")} title={t("เต็มจอ")}>⛶</button>}
        </div>
      </div>

      {/* เวที */}
      <div className="relative rounded-2xl border border-ink-200 bg-white px-3 py-6 sm:py-8 min-h-[320px] flex flex-col items-center justify-center overflow-hidden">
        <Stage entries={entries} spin={spin} onDone={onDone} reduced={reduced} />
        {winner && !showCard && !spinning && (
          <p className="mt-4 text-xl sm:text-2xl font-bold text-ink-900">{t('🎉 เลขที่ {value1} {value2}', { value1: winner.no, value2: winner.name })}</p>
        )}
      </div>

      {/* ปุ่มหลัก */}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={pick} disabled={spinning || exhausted || students.length === 0}
          className={`${btnAccent} text-xl px-10 min-h-[56px] whitespace-nowrap flex-1 sm:flex-none shadow-lg active:translate-y-0.5`}>
          {spinning ? t('กำลังลุ้น…') : exhausted ? t('ครบทุกคนแล้ว') : mode === 'slot' ? t('🎰 ดึงคันโยก!') : mode === 'gacha' ? t('🥚 หมุนตู้!') : t('🎡 หมุนวงล้อ!')}
        </button>
        <label className="flex items-center gap-2 min-h-[44px] text-ink-700 cursor-pointer">
          <input type="checkbox" className="w-5 h-5" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} />{t('ไม่ซ้ำคนเดิม')}</label>
        <button type="button" onClick={() => { setPickedIds([]); setSpin(null); setWinner(null); setShowCard(false); }} disabled={spinning} className={btnSecondary}>{t('เริ่มใหม่')}</button>
        <span className="text-sm text-ink-600 ml-auto">{tx('เหลือ {left} / {all} คน · {key} สุ่ม', { left: pool.length, all: students.length, key: <kbd className="px-1 rounded border border-ink-200">Space</kbd> })}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {pickedList.length > 0 && (
          <div className="rounded-xl border border-ink-200 bg-white p-4">
            <p className="text-sm font-medium text-ink-600 mb-2">{t('สุ่มไปแล้ว ({value1})', { value1: pickedList.length })}</p>
            <ol className="flex flex-wrap gap-2">
              {pickedList.map((e, i) => (
                <li key={e.id} className="px-3 py-1 rounded-full bg-ink-100 text-ink-700 text-sm">{i + 1}. {e.name}</li>
              ))}
            </ol>
          </div>
        )}
        {top.length > 0 && (
          <div className="rounded-xl border border-accent-300 bg-accent-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink-900">{t('⭐ คะแนนรอบนี้ (5 อันดับ)')}</p>
              <button type="button" onClick={() => setStars({})} className="min-h-[44px] px-3 text-sm text-ink-600 hover:text-ink-900 underline">{t('ล้างคะแนน')}</button>
            </div>
            <ol className="space-y-1">
              {top.map(({ e, n }, i) => (
                <li key={e.id} className="flex justify-between text-ink-900"><span>{i + 1}. {e.no}. {e.name}</span><span className="font-bold">{'⭐'.repeat(Math.min(n, 5))}{n > 5 ? ` ×${n}` : ''}</span></li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <Confetti fireKey={fire} disabled={reduced} />

      {/* การ์ดผู้โชคดี */}
      {showCard && winner && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-ink-900/60 rounded-2xl p-4" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label={t("ผู้โชคดี")} onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl bg-white border-4 border-accent-400 shadow-2xl p-6 sm:p-10 text-center motion-safe:animate-[kgCard_.45s_ease-out]">
            <style>{'@keyframes kgCard{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.05);opacity:1}100%{transform:scale(1)}}'}</style>
            <p className="text-accent-700 font-bold text-lg sm:text-xl">{t('🎉 ผู้โชคดีคือ')}</p>
            <p className="mt-2 text-ink-500 font-semibold text-xl sm:text-2xl">{t('เลขที่ {value1}', { value1: winner.no })}</p>
            <p className="mt-1 font-extrabold text-ink-900 break-words leading-tight text-4xl sm:text-6xl">{winner.name}</p>
            {stars[winner.id] > 0 && <p className="mt-3 text-2xl" aria-label={t('{value1} ดาว', { value1: stars[winner.id] })}>{'⭐'.repeat(Math.min(stars[winner.id], 10))}</p>}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <button type="button" autoFocus onClick={addStar} disabled={starred}
                className={`${btnAccent} text-lg`}>{starred ? t('ได้ดาวแล้ว ⭐') : t('ตอบถูก +1 ⭐')}</button>
              <button type="button" onClick={again} disabled={exhausted} className={`${btnPrimary} text-lg`}>{exhausted ? t('ครบทุกคนแล้ว') : t('สุ่มอีกครั้ง')}</button>
              <button type="button" onClick={close} className={btnSecondary}>{t('ปิด (Esc)')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RandomPicker;
