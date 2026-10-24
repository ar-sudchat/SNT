// เสียงเกมสร้างด้วย WebAudio ล้วน (ไม่มีไฟล์) — สร้าง AudioContext หลังผู้ใช้กดเท่านั้น
const KEY = 'kruscan.picker.muted';
let ctx = null;
let lastTick = 0;

const readMuted = () => {
  try { return window.localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
};
let muted = typeof window !== 'undefined' ? readMuted() : false;

const ensure = () => {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch (e) { return null; }
};

const tone = (freq, dur, type = 'square', vol = 0.06, when = 0) => {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
};

let noiseBuf = null;
const noise = (c) => {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.08, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  }
  return noiseBuf;
};

export const sfx = {
  isMuted: () => muted,
  setMuted(m) {
    muted = m;
    try { window.localStorage.setItem(KEY, m ? '1' : '0'); } catch (e) { /* storage ปิดอยู่ */ }
  },
  unlock() { ensure(); },
  tick(pitch = 1) {
    const now = performance.now();
    if (now - lastTick < 28) return;
    lastTick = now;
    tone(1400 * pitch, 0.035, 'square', 0.035);
  },
  // กลองรัว ms มิลลิวินาที — คืนฟังก์ชันหยุด
  drumroll(ms) {
    const c = ensure();
    if (!c) return () => {};
    const master = c.createGain();
    master.gain.value = 1;
    master.connect(c.destination);
    const buf = noise(c);
    const t0 = c.currentTime;
    for (let t = 0; t < ms / 1000; t += 0.055) {
      const s = c.createBufferSource();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      s.buffer = buf; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
      g.gain.value = 0.05 + 0.25 * (t / (ms / 1000));
      s.connect(f).connect(g).connect(master);
      s.start(t0 + t);
    }
    return () => {
      try {
        master.gain.setTargetAtTime(0, c.currentTime, 0.02);
        setTimeout(() => master.disconnect(), 200);
      } catch (e) { /* ปิดไปแล้ว */ }
    };
  },
  fanfare() {
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38]].forEach(([f, w]) => tone(f, w === 0.38 ? 0.6 : 0.16, 'triangle', 0.12, w));
    tone(1568, 0.5, 'sine', 0.04, 0.38);
  },
  pop() { tone(320, 0.12, 'sine', 0.12); tone(880, 0.1, 'triangle', 0.06, 0.05); },
  star() { tone(1319, 0.1, 'triangle', 0.08); tone(1760, 0.2, 'triangle', 0.08, 0.08); },
};
