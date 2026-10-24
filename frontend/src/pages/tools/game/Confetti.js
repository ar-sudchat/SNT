import React, { useEffect, useRef } from 'react';

const COLORS = ['#f6a92e', '#fbc155', '#e8901a', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

// ยิงพลุกระดาษเมื่อ fireKey เปลี่ยน (ไม่ทำงานถ้า disabled)
const Confetti = ({ fireKey, disabled }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!fireKey || disabled) return undefined;
    const cv = ref.current;
    if (!cv) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth; const h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = w < 600 ? 110 : 180;
    const ps = Array.from({ length: n }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * (0.2 + Math.random() * 0.7);
      const v = 9 + Math.random() * 11;
      return {
        x: w / 2 + side * w * 0.15, y: h * 0.7,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
        s: 6 + Math.random() * 8, c: COLORS[i % COLORS.length], life: 0,
      };
    });
    let raf; let last = performance.now();
    const step = (now) => {
      const dt = Math.min((now - last) / 16.7, 3); last = now;
      g.clearRect(0, 0, w, h);
      let alive = 0;
      ps.forEach((p) => {
        p.vy += 0.32 * dt; p.vx *= 0.99; p.vy *= 0.99;
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.life += dt;
        if (p.y > h + 20) return;
        alive++;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.globalAlpha = Math.max(0, 1 - p.life / 220);
        g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (0.4 + Math.abs(Math.sin(p.r * 2))));
        g.restore();
      });
      if (alive) raf = requestAnimationFrame(step); else g.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); g.clearRect(0, 0, w, h); };
  }, [fireKey, disabled]);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 w-full h-full z-30" />;
};

export default Confetti;
