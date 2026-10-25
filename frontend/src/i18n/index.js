import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// หลายภาษา: ข้อความต้นฉบับภาษาไทยเป็น key เอง — t('บันทึกแล้ว') · มีตัวแปร t('สร้างแล้ว {n} ห้อง', { n })
// ภาษาที่ยังไม่มีคำแปล = แสดงภาษาไทยเดิม · พจนานุกรมโหลดเมื่อเลือกภาษานั้น (ไม่ถ่วงหน้าแรก)
export const LANGS = [
  { id: 'th', name: 'ไทย' },
  { id: 'en', name: 'English' },
  { id: 'zh', name: '中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'fr', name: 'Français' },
  { id: 'de', name: 'Deutsch' },
];
const KEY = 'kruscan.lang';
// โหมดตรวจ (ไม่อยู่ในรายการ): ข้อความที่ผ่าน t() จะมี ⟦ ⟧ ครอบ — ข้อความไทยที่ไม่มีวงเล็บคือจุดที่ยังไม่ครอบ
// เปิดด้วย localStorage.setItem('kruscan.lang', 'qa') แล้วรีเฟรช
const QA = 'qa';
const LOADERS = {
  en: () => import('./locales/en.json'),
  zh: () => import('./locales/zh.json'),
  ja: () => import('./locales/ja.json'),
  ko: () => import('./locales/ko.json'),
  fr: () => import('./locales/fr.json'),
  de: () => import('./locales/de.json'),
};

const LOCALES = { th: 'th-TH', en: 'en-GB', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', de: 'de-DE' };

let current = 'th';
let dict = {};

export function getLang() { return current; }

function initialLang() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (LANGS.some(l => l.id === saved) || saved === QA)) return saved;
  } catch (e) { /* ไม่มีที่เก็บ */ }
  return 'th';
}

// พหูพจน์ในคำแปล: {n|student|students} = เลือกรูปตามจำนวน n ด้วยกฎของภาษานั้น (ฝรั่งเศส 0 กับ 1 เป็นเอกพจน์)
const plural = (s, vars) => (vars && s.includes('|') ? s.replace(/\{(\w+)\|([^{}|]*)\|([^{}]*)\}/g, (m, k, one, other) => {
  const n = Number(vars[k]);
  if (vars[k] === undefined || vars[k] === null || Number.isNaN(n)) return other;
  return new Intl.PluralRules(LOCALES[current] || 'en').select(n) === 'one' ? one : other;
}) : s);
const fill = (s, vars) => (vars ? plural(s, vars).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m)) : s);

// ใช้ได้ทั้งในคอมโพเนนต์และนอกคอมโพเนนต์ (ตอน render) · ห้ามเรียกตอน import ไฟล์ (ค่าคงที่ระดับโมดูล) เพราะจะไม่เปลี่ยนตามภาษา
export function t(text, vars) {
  if (typeof text !== 'string' || !text) return text;
  if (current === QA) return `⟦${fill(text, vars)}⟧`;
  if (current === 'th') return fill(text, vars);
  // key ในพจนานุกรมตัดช่องว่างหัวท้ายและยุบช่องว่างซ้อน (ตาม scripts/i18n-keys.js) · คืนช่องว่างหัวท้ายเดิมให้
  const hit = dict[text] || dict[text.replace(/\s+/g, ' ').trim()];
  if (!hit) return fill(text, vars);
  // คำแปลที่ใส่ช่องว่างหัวท้ายมาเอง (ท่อนประโยคที่ต้นฉบับไทยติดกัน) ใช้ตามคำแปล
  // จีน/ญี่ปุ่นไม่เว้นวรรคระหว่างคำ จึงไม่เติมช่องว่างให้ท่อนประโยค
  const cjk = current === 'zh' || current === 'ja';
  const lead = !cjk && /^\s/.test(text) && !/^\s/.test(hit) ? ' ' : '';
  const trail = !cjk && /\s$/.test(text) && !/\s$/.test(hit) ? ' ' : '';
  return fill(lead + hit + trail, vars);
}

// คำเดียวกันแต่คนละความหมาย (เช่น "คะแนน" หัวคอลัมน์ กับ "คะแนน" หน่วยนับ): key ในพจนานุกรม = "บริบท::ข้อความ"
export function tc(context, text, vars) {
  if (current !== 'th' && current !== QA && dict[`${context}::${text}`]) return fill(dict[`${context}::${text}`], vars);
  return t(text, vars);
}

// ประโยคที่มีตัวหนา/ลิงก์/ไอคอนอยู่กลางประโยค: แปลทั้งประโยคเป็นข้อความเดียว ผู้แปลย้ายแท็กได้ตามไวยากรณ์
//   tx('ส่งครบ <b>{n}</b> คน', { n, b: (c) => <b>{c}</b> })
//   ค่าในตัวแปร: ข้อความ/ตัวเลข = แทนค่า · ฟังก์ชัน = แท็ก <ชื่อ>…</ชื่อ> · React element = วางแทน {ชื่อ}
export function tx(text, parts = {}) {
  const vals = {};
  for (const [k, v] of Object.entries(parts)) if (typeof v === 'string' || typeof v === 'number') vals[k] = v;
  const s = t(text, vals);
  const out = [];
  let i = 0;
  const re = /<(\w+)>([\s\S]*?)<\/\1>|<(\w+)\s*\/>|\{(\w+)\}/g;
  let m;
  while ((m = re.exec(s))) {
    if (m.index > i) out.push(s.slice(i, m.index));
    const name = m[1] || m[3] || m[4];
    const v = parts[name];
    let node = m[0];
    if (m[1] && typeof v === 'function') node = v(m[2]);
    else if (m[3] && typeof v === 'function') node = v();
    else if (m[4] && v !== undefined && v !== null && typeof v === 'object') node = v;
    out.push(typeof node === 'string' ? node : React.cloneElement(node, { key: `tx${out.length}` }));
    i = re.lastIndex;
  }
  if (i < s.length) out.push(s.slice(i));
  return out;
}

// ข้อความจาก server ที่มีค่าแทรก (เช่น "ไม่พบนักเรียนรหัส 12345"): ไม่ตรง key ตรง ๆ จึงจับกับรูปแบบ "ไม่พบนักเรียนรหัส {studentCode}"
let patterns = null;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function patternList() {
  if (patterns) return patterns;
  patterns = [];
  for (const key of Object.keys(dict)) {
    if (!key.includes('{') || key.includes('::')) continue;
    const names = [];
    const body = key.split(/\{(\w+)\}/).map((part, i) => (i % 2 ? (names.push(part), '([\\s\\S]+?)') : escapeRe(part))).join('');
    // ต้องมีข้อความตายตัวพอสมควร ไม่งั้นจับข้อความอะไรก็ได้
    if (key.replace(/\{\w+\}/g, '').replace(/\s/g, '').length < 3) continue;
    patterns.push({ key, names, re: new RegExp(`^${body}$`) });
  }
  patterns.sort((a, b) => b.key.length - a.key.length);
  return patterns;
}
export function tMsg(text) {
  if (typeof text !== 'string' || !text || current === 'th') return text;
  if (current === QA) return t(text);
  const norm = text.replace(/\s+/g, ' ').trim();
  if (dict[text] || dict[norm]) return t(text);
  for (const p of patternList()) {
    const m = norm.match(p.re);
    if (m) return t(p.key, Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]])));
  }
  return text;
}

const I18nContext = createContext({ lang: 'th', setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('th');
  const [ready, setReady] = useState(false);

  const setLang = useCallback(async (id) => {
    const next = LANGS.some(l => l.id === id) || id === QA ? id : 'th';
    let nextDict = {};
    if (LOADERS[next]) {
      try { nextDict = (await LOADERS[next]()).default || {}; } catch (e) { nextDict = {}; }
    }
    dict = nextDict;
    patterns = null;
    current = next;
    document.documentElement.lang = next === QA ? 'th' : next;
    try { localStorage.setItem(KEY, next); } catch (e) { /* ใช้ได้เฉพาะรอบนี้ */ }
    setLangState(next);
  }, []);

  useEffect(() => { setLang(initialLang()).finally(() => setReady(true)); }, [setLang]);

  if (!ready) return null;
  // key={lang} ให้ทั้งแอป render ใหม่ ข้อความทุกจุดเปลี่ยนตามภาษาทันที
  return (
    <I18nContext.Provider value={{ lang, setLang }}>
      <React.Fragment key={lang}>{children}</React.Fragment>
    </I18nContext.Provider>
  );
}

export const useLang = () => useContext(I18nContext);

// วันที่/ตัวเลขตามภาษาที่เลือก: toLocaleDateString(dateLocale(), …) · ไทยยังเป็น พ.ศ. เหมือนเดิม
export const dateLocale = () => LOCALES[current] || 'th-TH';
