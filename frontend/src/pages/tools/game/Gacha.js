import { t } from '../../../i18n';
import React, { useEffect, useRef, useState } from 'react';
import { sfx } from './sfx';
import { SPIN_MS } from './common';

const CSS = `
@keyframes kgShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-7deg) translateX(-4px)}40%{transform:rotate(6deg) translateX(4px)}60%{transform:rotate(-5deg)}80%{transform:rotate(5deg)}}
@keyframes kgDrop{0%{transform:translateY(-60px) scale(.6);opacity:0}60%{transform:translateY(8px) scale(1.05);opacity:1}100%{transform:translateY(0) scale(1)}}
@keyframes kgWobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}
@keyframes kgPop{0%{transform:scale(.2);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
@keyframes kgFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
`;
const BALLS = ['#f87171', '#60a5fa', '#fbbf24', '#34d399', '#a78bfa', '#f472b6', '#fb923c', '#22d3ee', '#facc15', '#4ade80', '#c084fc', '#f87171'];

// phase: idle → shake → drop → crack → open
const Gacha = ({ entries, spin, onDone, reduced }) => {
  const [phase, setPhase] = useState('idle');
  const [color, setColor] = useState(BALLS[0]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const winner = spin ? entries[spin.index] : null;

  useEffect(() => {
    if (!spin) return undefined;
    setColor(BALLS[Math.floor(Math.random() * BALLS.length)]);
    if (reduced) { setPhase('open'); doneRef.current(); return undefined; }
    const ts = [];
    const at = (ms, fn) => ts.push(setTimeout(fn, ms));
    setPhase('shake');
    for (let t = 0; t < SPIN_MS * 0.5; t += 160) at(t, () => sfx.tick(0.6));
    at(SPIN_MS * 0.5, () => { setPhase('drop'); sfx.pop(); });
    at(SPIN_MS * 0.72, () => setPhase('crack'));
    at(SPIN_MS, () => { setPhase('open'); sfx.pop(); doneRef.current(); });
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);

  const showCapsule = phase === 'drop' || phase === 'crack' || phase === 'open';
  const open = phase === 'open';
  return (
    <div className="mx-auto w-full max-w-md flex flex-col items-center" aria-hidden="true">
      <style>{CSS}</style>
      {/* ตู้กาชาปอง */}
      <div className="relative w-56 sm:w-72" style={{ animation: phase === 'shake' ? 'kgShake .32s linear infinite' : 'none' }}>
        <div className="relative mx-auto w-48 h-48 sm:w-60 sm:h-60 rounded-full border-[6px] border-ink-300 bg-sky-50/80 overflow-hidden shadow-inner">
          {BALLS.map((c, i) => (
            <span key={i} className="absolute rounded-full border-2 border-white/70"
              style={{ background: `linear-gradient(180deg, ${c} 50%, #fff 50%)`, width: 46, height: 46, left: `${8 + (i % 4) * 22}%`, bottom: `${4 + Math.floor(i / 4) * 24}%`, transform: `rotate(${i * 37}deg)` }} />
          ))}
          <span className="absolute top-3 left-6 w-10 h-5 rounded-full bg-white/70 rotate-[-25deg]" />
        </div>
        <div className="mx-auto -mt-2 w-52 sm:w-64 h-24 rounded-b-3xl rounded-t-lg bg-brand flex items-center justify-around px-4 shadow-lg">
          <span className="w-12 h-12 rounded-full bg-white/90 border-4 border-accent-400 flex items-center justify-center text-ink-700 font-black">⟳</span>
          <span className="w-14 h-10 rounded-lg bg-ink-900/70" />
        </div>
      </div>
      {/* แคปซูล */}
      <div className="relative h-36 sm:h-44 w-full flex items-center justify-center -mt-2">
        {showCapsule && (
          <div className="relative w-24 h-24 sm:w-28 sm:h-28" style={{ animation: phase === 'drop' ? 'kgDrop .5s ease-out both' : phase === 'crack' ? 'kgWobble .18s linear infinite' : 'none' }}>
            <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-full transition-transform duration-500 border-2 border-white"
              style={{ background: color, transform: open ? 'translate(-46px,-28px) rotate(-40deg)' : 'none' }} />
            <span className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-full bg-white transition-transform duration-500 border-2 border-ink-200"
              style={{ transform: open ? 'translate(46px,20px) rotate(30deg)' : 'none' }} />
            {phase === 'crack' && <span className="absolute left-0 right-0 top-1/2 h-1 bg-ink-900/60" style={{ clipPath: 'polygon(0 0,15% 100%,30% 0,45% 100%,60% 0,75% 100%,90% 0,100% 100%,100% 0,0 0)' }} />}
          </div>
        )}
        {open && winner && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="px-5 py-3 rounded-2xl bg-accent-100 border-2 border-accent-500 text-ink-900 font-extrabold text-2xl sm:text-4xl shadow-lg max-w-full truncate" style={{ animation: reduced ? 'none' : 'kgPop .45s ease-out both' }}>
              {winner.no}. {winner.name}
            </div>
          </div>
        )}
        {phase === 'idle' && <p className="text-ink-500 font-medium" style={{ animation: reduced ? 'none' : 'kgFloat 2s ease-in-out infinite' }}>{t('หมุนตู้ ลุ้นไข่ใบไหนจะออก 🥚')}</p>}
      </div>
    </div>
  );
};

export default Gacha;
