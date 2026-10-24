import React, { useEffect, useRef, useCallback } from 'react';
import { sfx } from './sfx';
import { easeOutQuart, SPIN_MS } from './common';

const FILLS = ['#fde68a', '#bfdbfe', '#fbcfe8', '#bbf7d0', '#ddd6fe', '#fed7aa', '#a5f3fc', '#fecaca'];
const TAU = Math.PI * 2;

const fit = (g, text, max) => {
  if (g.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && g.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
};

// entries: [{ id, no, name }] · spin: { key, index } · เรียก onDone เมื่อหยุด
const Wheel = ({ entries, spin, onDone, reduced }) => {
  const cvRef = useRef(null);
  const wrapRef = useRef(null);
  const rot = useRef(0);
  const glow = useRef(-1);
  const raf = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const draw = useCallback(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const size = cv.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(size * dpr)) { cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr); }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);
    const c = size / 2; const R = c - 8;
    const n = Math.max(entries.length, 1);
    const seg = TAU / n;
    const numbersOnly = n > 24;
    const font = getComputedStyle(cv).fontFamily || 'sans-serif';
    // ขอบไฟ
    g.beginPath(); g.arc(c, c, R + 6, 0, TAU); g.fillStyle = '#353e53'; g.fill();
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + rot.current + i * seg;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, R, a0, a0 + seg); g.closePath();
      g.fillStyle = entries.length ? FILLS[i % FILLS.length] : '#eceff5';
      if (n % FILLS.length === 1 && i === n - 1 && n > 1) g.fillStyle = FILLS[3];
      g.fill();
      if (i === glow.current) {
        g.save(); g.fillStyle = 'rgba(246,169,46,0.55)'; g.shadowColor = '#f6a92e'; g.shadowBlur = 30; g.fill(); g.restore();
        g.lineWidth = 4; g.strokeStyle = '#e8901a'; g.stroke();
      } else if (n > 1) { g.lineWidth = 1; g.strokeStyle = 'rgba(53,62,83,0.25)'; g.stroke(); }
      const e = entries[i];
      if (!e) continue;
      g.save(); g.translate(c, c); g.rotate(a0 + seg / 2);
      g.fillStyle = '#1f2533'; g.textBaseline = 'middle'; g.textAlign = 'right';
      const fs = Math.max(11, Math.min(R * 0.09, (seg * R * 0.75) * 0.8, 26));
      g.font = `700 ${fs}px ${font}`;
      const label = numbersOnly ? String(e.no) : `${e.no}. ${e.name}`;
      g.fillText(fit(g, label, R * (numbersOnly ? 0.3 : 0.72)), R - 14, 0);
      g.restore();
    }
    // ดุมกลาง
    g.beginPath(); g.arc(c, c, R * 0.12, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
    g.lineWidth = 5; g.strokeStyle = '#f6a92e'; g.stroke();
  }, [entries]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => {
    if (!spin) return undefined;
    const n = entries.length;
    const seg = TAU / n;
    glow.current = -1;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const base = -(spin.index + 0.5) * seg + jitter;
    const from = rot.current;
    const k = Math.ceil((from + 6 * TAU - base) / TAU);
    const to = base + k * TAU;
    const finish = () => { rot.current = to; glow.current = spin.index; draw(); doneRef.current(); };
    if (reduced || n === 1) { finish(); return undefined; }
    const t0 = performance.now();
    let lastIdx = -1;
    const step = (now) => {
      const t = Math.min((now - t0) / SPIN_MS, 1);
      rot.current = from + (to - from) * easeOutQuart(t);
      const idx = Math.floor((((-rot.current) % TAU) + TAU) % TAU / seg);
      if (idx !== lastIdx) { if (lastIdx !== -1) sfx.tick(); lastIdx = idx; }
      draw();
      if (t < 1) raf.current = requestAnimationFrame(step); else finish();
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);

  return (
    <div ref={wrapRef} className="relative mx-auto w-full max-w-[min(92vw,62vh)] lg:max-w-[min(560px,64vh)] aspect-square">
      <div aria-hidden="true" className="absolute left-1/2 -top-1 -translate-x-1/2 z-10 w-0 h-0 border-l-[18px] border-r-[18px] border-t-[34px] border-l-transparent border-r-transparent border-t-accent-600 drop-shadow" />
      <canvas ref={cvRef} className="w-full h-full font-sans" aria-label={`วงล้อรายชื่อ ${entries.length} คน`} role="img" />
    </div>
  );
};

export default Wheel;
