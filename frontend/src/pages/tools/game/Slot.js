import { t } from '../../../i18n';
import React, { useEffect, useMemo, useRef } from 'react';
import { sfx } from './sfx';
import { easeOutCubic, SPIN_MS } from './common';

const SYMBOLS = ['🍀', '🍒', '🔔', '💎', '🍋', '7️⃣'];
const H = 88; // ความสูงช่อง (px)
const LEN = 28;

const buildStrip = (entries, winner, field) => {
  const out = [];
  for (let i = 0; i < LEN - 1; i++) {
    const e = entries[Math.floor(Math.random() * entries.length)];
    out.push(field === 'sym' ? SYMBOLS[i % SYMBOLS.length] : e[field]);
  }
  out.push(field === 'sym' ? '⭐' : winner[field]);
  return out;
};

const Slot = ({ entries, spin, onDone, reduced }) => {
  const reels = useRef([]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const winner = spin ? entries[spin.index] : null;
  const strips = useMemo(() => {
    if (!winner) return [['—'], [t('กดดึงคันโยก!')], ['⭐']];
    return ['no', 'name', 'sym'].map((f) => buildStrip(entries, winner, f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);

  useEffect(() => {
    if (!spin) return undefined;
    const last = (LEN - 1) * H;
    const set = (i, y) => { const el = reels.current[i]; if (el) el.style.transform = `translate3d(0,${-y}px,0)`; };
    if (reduced) { [0, 1, 2].forEach((i) => set(i, last)); doneRef.current(); return undefined; }
    const stops = [0.55, 0.78, 1].map((f) => SPIN_MS * f);
    const lastIdx = [0, 0, 0];
    const t0 = performance.now();
    let raf;
    const step = (now) => {
      const el = now - t0;
      for (let i = 0; i < 3; i++) {
        const t = Math.min(el / stops[i], 1);
        const y = last * easeOutCubic(t);
        set(i, y);
        const idx = Math.floor(y / H);
        if (idx !== lastIdx[i]) { lastIdx[i] = idx; if (i === 1) sfx.tick(1 + i * 0.1); }
        if (t === 1 && lastIdx[i] !== 99) { lastIdx[i] = 99; sfx.pop(); }
      }
      if (el < stops[2]) raf = requestAnimationFrame(step); else doneRef.current();
    };
    [0, 1, 2].forEach((i) => set(i, 0));
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);

  const reelBox = 'relative overflow-hidden rounded-xl bg-white shadow-inner';
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-3xl p-3 sm:p-5 bg-gradient-to-b from-accent-400 to-accent-600 shadow-xl">
        <div className="text-center font-extrabold text-ink-900 tracking-wider text-lg sm:text-2xl mb-2" aria-hidden="true">★ JACKPOT ★</div>
        <div className="flex gap-2 sm:gap-3" style={{ height: H }} aria-hidden="true">
          {strips.map((strip, i) => (
            <div key={i} className={`${reelBox} ${i === 1 ? 'flex-1 min-w-0' : 'w-16 sm:w-24 shrink-0'}`}>
              <div ref={(el) => { reels.current[i] = el; }} style={{ willChange: 'transform' }}>
                {strip.map((v, j) => (
                  <div key={j} style={{ height: H }} className={`flex items-center justify-center px-2 font-bold text-ink-900 truncate ${i === 1 ? 'text-lg sm:text-4xl' : 'text-2xl sm:text-4xl'}`}>
                    <span className="truncate">{v}</span>
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/20" />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs sm:text-sm font-semibold text-ink-900/80 px-1" aria-hidden="true">
          <span>{t('เลขที่')}</span><span>{t('ชื่อ')}</span><span>{t('โชค')}</span>
        </div>
      </div>
    </div>
  );
};

export default Slot;
