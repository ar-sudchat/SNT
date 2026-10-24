import React, { useState, useRef, useEffect, useCallback } from 'react';
import { btnPrimary, btnSecondary } from './toolsUtils';

const PRESETS = [1, 3, 5, 10];
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const ClassTimer = () => {
  const [total, setTotal] = useState(5 * 60);
  const [left, setLeft] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const [customMin, setCustomMin] = useState('');
  const endAt = useRef(0);
  const audio = useRef(null);

  const beep = useCallback(() => {
    try {
      const ctx = audio.current;
      if (!ctx) return;
      [0, 0.5, 1].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.4);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.45);
      });
    } catch (e) { /* ไม่มีเสียงก็ไม่เป็นไร */ }
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const remain = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(remain);
      if (remain <= 0) { setRunning(false); beep(); }
    }, 200);
    return () => clearInterval(id);
  }, [running, beep]);

  useEffect(() => () => { try { audio.current && audio.current.close(); } catch (e) { /* noop */ } }, []);

  const unlockAudio = () => {
    try {
      if (!audio.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audio.current = new AC();
      }
      if (audio.current && audio.current.state === 'suspended') audio.current.resume();
    } catch (e) { /* noop */ }
  };

  const setDuration = (sec) => { setRunning(false); setTotal(sec); setLeft(sec); };
  const start = () => {
    unlockAudio();
    if (left <= 0) return;
    endAt.current = Date.now() + left * 1000;
    setRunning(true);
  };
  const pause = () => { setRunning(false); };
  const reset = () => { setRunning(false); setLeft(total); };
  const applyCustom = () => {
    const m = parseFloat(customMin);
    if (m > 0 && m <= 180) setDuration(Math.round(m * 60));
  };

  const finished = left === 0;
  const pct = total ? (left / total) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border px-4 py-10 sm:py-16 text-center ${finished ? 'border-accent-400 bg-accent-50' : 'border-ink-200 bg-white'}`} role="timer" aria-live="off">
        <p className="font-bold text-ink-900 tabular-nums leading-none text-7xl sm:text-9xl lg:text-[11rem]">{fmt(left)}</p>
        {finished && <p className="mt-4 text-2xl font-semibold text-accent-700" role="status">หมดเวลา</p>}
        <div className="mt-8 mx-auto max-w-xl h-2 rounded-full bg-ink-100 overflow-hidden" aria-hidden="true">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {running ? (
          <button type="button" onClick={pause} className={`${btnPrimary} text-lg px-8 flex-1 sm:flex-none`}>หยุดชั่วคราว</button>
        ) : (
          <button type="button" onClick={start} disabled={left <= 0} className={`${btnPrimary} text-lg px-8 flex-1 sm:flex-none`}>
            {left < total && left > 0 ? 'เล่นต่อ' : 'เริ่ม'}
          </button>
        )}
        <button type="button" onClick={reset} className={btnSecondary}>เริ่มใหม่</button>
      </div>

      <div className="rounded-xl border border-ink-200 bg-white p-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="ตั้งเวลาด่วน">
          {PRESETS.map((m) => (
            <button key={m} type="button" aria-pressed={total === m * 60} onClick={() => setDuration(m * 60)}
              className={`min-h-[44px] min-w-[64px] px-4 rounded-lg border font-medium ${total === m * 60 ? 'border-brand bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-700 hover:bg-ink-50'}`}>
              {m} นาที
            </button>
          ))}
        </div>
        <label className="flex flex-col text-sm text-ink-600">
          กำหนดเอง (นาที)
          <div className="mt-1 flex gap-2">
            <input type="number" min="0.5" max="180" step="0.5" inputMode="decimal" value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); }}
              className="min-h-[44px] w-28 rounded-lg border border-ink-200 px-3 text-lg text-ink-900" />
            <button type="button" onClick={applyCustom} className={btnSecondary}>ตั้งเวลา</button>
          </div>
        </label>
      </div>
    </div>
  );
};

export default ClassTimer;
