import { t, tx } from '../../i18n';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { NotebookCover, Icon } from './art';
import { StackDone } from '../../components/illustrations';

// เดโมแบบแตะได้: ห้องมีนักเรียน 8 คน สมุดบนโต๊ะ 6 เล่ม (เลขที่ 4 กับ 7 ยังไม่ส่งสมุด)
// แตะสมุด = สแกน → ตัวนับ x/8 เพิ่ม รายชื่อคนที่ยังไม่ส่งหดลง → สแกนครบแล้วคัดลอกข้อความทวงงาน
// ข้อมูลทั้งหมดเป็นตัวอย่าง (ชื่อสมมติ) ไม่เรียก API · เริ่มที่ 0/8 ทุกครั้ง
const CLASS = [
  { no: 1, name: 'ด.ช. ก้องภพ ใจดี', color: 'blue', seed: 11 },
  { no: 2, name: 'ด.ญ. กานต์ธิดา มีสุข', color: 'gold', seed: 23 },
  { no: 3, name: 'ด.ช. ณัฐวุฒิ แสงทอง', color: 'green', seed: 37 },
  { no: 4, name: 'ด.ญ. ปิยะดา รุ่งเรือง', desk: false },
  { no: 5, name: 'ด.ช. ธนากร สุขใจ', color: 'rose', seed: 41 },
  { no: 6, name: 'ด.ญ. มาลี รักเรียน', color: 'blue', seed: 53 },
  { no: 7, name: 'ด.ช. วีรภัทร ขยัน', desk: false },
  { no: 8, name: 'ด.ญ. สุภาพร เก่งกาจ', color: 'gold', seed: 67 },
];
const DESK = CLASS.filter(s => s.desk !== false);
const short = (n) => n.replace(/^ด\.(ช|ญ)\. /, '');
const TILT = [-2, 1.5, -1, 0, 2, -1.5, 0, 1];

export default function TryScan() {
  const [scanned, setScanned] = useState([]);
  const [copied, setCopied] = useState(false);
  const last = scanned.length ? CLASS.find(s => s.no === scanned[scanned.length - 1]) : null;
  const missing = CLASS.filter(s => !scanned.includes(s.no));
  const left = DESK.length - scanned.length;
  const done = left === 0;
  const hintNo = scanned.length === 0 ? DESK[0].no : null;

  const message = `ม.2/1 คณิตศาสตร์ ใบงานที่ 3\nยังไม่ส่ง ${missing.length} คน: ${missing.map(s => `เลขที่ ${s.no} ${short(s.name)}`).join(', ')}\nส่งที่โต๊ะครูภายในพรุ่งนี้นะคะ`;

  const scan = (no) => { if (!scanned.includes(no)) { setScanned(prev => [...prev, no]); setCopied(false); } };
  const reset = () => { setScanned([]); setCopied(false); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied('ok'); } catch (e) { setCopied('fail'); /* เบราว์เซอร์ไม่ให้คัดลอก */ }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-8">
      {/* แถบสถานะ (บนมือถืออยู่เหนือโต๊ะ เพื่อเห็นผลทันทีที่แตะ) */}
      <div className="rounded-2xl bg-card p-4 shadow-[0_10px_30px_-12px_rgb(12_24_51/0.25)] ring-1 ring-ink/10 sm:p-5 lg:col-start-2 lg:row-start-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-ink/65">{t('กำลังรับงาน · ม.2/1 มีนักเรียน {length} คน', { length: CLASS.length })}</div>
            <div className="truncate font-semibold text-ink">{'คณิตศาสตร์ ใบงานที่ 3'}{/* ชื่อวิชา/ใบงานตัวอย่าง (ข้อมูลสมมติ) */}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-display text-2xl font-bold tabular-nums text-ink">{scanned.length}<span className="text-base font-medium text-ink/65">/{CLASS.length}</span></div>
            <div className="text-xs text-ink/65">{t('ส่งแล้ว')}</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full origin-left rounded-full bg-pass transition-transform duration-500 ease-out" style={{ transform: `scaleX(${scanned.length / CLASS.length || 0.001})` }} />
        </div>
        <div className="mt-3 flex min-h-[44px] items-center gap-2.5 rounded-xl bg-page px-3 py-2 text-sm" aria-live="polite">
          {last ? (
            <>
              <span key={last.no} className="ks-pop grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pass text-white"><Icon.Check width={16} height={16} /></span>
              <span className="min-w-0 truncate text-ink">{tx('เลขที่ {no} {name} · ส่งแล้ว', { no: last.no, name: <b className="font-semibold">{short(last.name)}</b> })}</span>
            </>
          ) : (
            <span className="text-ink/70">{t('ยังไม่ได้สแกน · แตะสมุดบนโต๊ะเพื่อเริ่ม')}</span>
          )}
        </div>
      </div>

      {/* โต๊ะครู: ครบ 8 ช่องตามเลขที่ */}
      <div className="relative rounded-3xl bg-brand-50 p-4 ring-1 ring-ink/5 sm:p-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{t('สมุดบนโต๊ะ {length} เล่ม ', { length: DESK.length })}<span className="font-normal text-ink/65">{t('· สแกนแล้ว {length}', { length: scanned.length })}</span></span>
          <button type="button" onClick={reset} disabled={!scanned.length}
            className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-brand-600 hover:bg-card disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">{t('เริ่มกองใหม่')}</button>
        </div>
        <ul className="grid grid-cols-4 gap-x-2.5 gap-y-3 sm:gap-x-4 md:grid-cols-8 md:gap-x-3 lg:grid-cols-4 lg:gap-x-4 lg:gap-y-4">
          {CLASS.map((s, i) => {
            if (s.desk === false) {
              return (
                <li key={s.no}>
                  <div className="grid aspect-[3/4] place-items-center rounded-lg border-2 border-dashed border-ink/20 px-1 text-center text-[11px] leading-snug text-ink/60">{tx('ยังไม่ส่ง<br/>สมุด', { br: () => <br /> })}</div>
                  <div className="mt-1.5 truncate text-center text-xs text-ink/70">{t('เลขที่ {no}', { no: s.no })}</div>
                </li>
              );
            }
            const on = scanned.includes(s.no);
            const hint = s.no === hintNo;
            return (
              <li key={s.no} className="relative">
                <button
                  type="button"
                  onClick={() => scan(s.no)}
                  disabled={on}
                  aria-label={on ? t('เลขที่ {no} {name} สแกนแล้ว', { no: s.no, name: s.name }) : t('สแกนสมุด เลขที่ {no} {name}', { no: s.no, name: s.name })}
                  className={`group relative block w-full rounded-lg text-left transition duration-300 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/60 ${on ? 'cursor-default' : 'cursor-pointer hover:-translate-y-1.5 active:scale-[0.97]'}`}
                  style={{ transform: on ? 'none' : `rotate(${TILT[i]}deg)` }}
                >
                  <NotebookCover name={short(s.name)} no={s.no} color={s.color} seed={s.seed} size={5.5} className={`transition duration-300 sm:!text-[8px] md:!text-[5.5px] lg:!text-[7.5px] ${on ? 'opacity-45 saturate-50' : ''}`} />
                  {on ? (
                    <span className="ks-stamp absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 -rotate-12 whitespace-nowrap rounded-md border-2 border-pass bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-pass sm:text-sm">{t('ส่งแล้ว')}</span>
                  ) : (
                    <span className={`pointer-events-none absolute inset-0 rounded-lg ring-2 transition ${hint ? 'ks-hint ring-accent' : 'ring-accent/0 group-hover:ring-accent/80'}`} />
                  )}
                </button>
                {hint && (
                  <span className="ks-hint-tag pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-fg shadow">{t('แตะเพื่อสแกน')}</span>
                )}
                <div className="mt-1.5 truncate text-center text-xs text-ink/70">{t('เลขที่ {no}', { no: s.no })}</div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-ink/60">{t('ชื่อนักเรียนเป็นตัวอย่าง · ของจริงสแกนด้วยกล้องมือถือ')}</p>
      </div>

      {/* รายชื่อคนที่ยังไม่ส่ง + ข้อความทวงงาน */}
      <div className="rounded-2xl bg-card p-4 ring-1 ring-ink/10 sm:p-5 lg:col-start-2 lg:row-start-2">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold text-ink">{t('ยังไม่ส่ง')}</h3>
          <span className="rounded-full bg-fail/10 px-2.5 py-0.5 text-sm font-semibold tabular-nums text-fail">{t('{length} คน', { length: missing.length })}</span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {missing.map(s => (
            <li key={s.no} className="ks-chip rounded-full bg-page px-3 py-1.5 text-sm text-ink ring-1 ring-ink/10">
              <span className="tabular-nums text-ink/65">{s.no}</span> {short(s.name)}
            </li>
          ))}
        </ul>
        {done ? (
          <div className="ks-pop mt-4">
            <div className="flex items-center gap-3 rounded-xl bg-pass/10 px-3 py-2.5">
              <StackDone className="h-12 w-auto shrink-0 text-pass" accent="rgb(var(--accent))" />
              <p className="text-sm font-semibold text-ink">{t('สแกนครบทั้ง {length} เล่มบนโต๊ะแล้ว', { length: DESK.length })}<span className="block font-normal text-ink/75">{t('เหลือ {length} คนที่ยังไม่ส่งสมุด ทวงได้เลย', { length: missing.length })}</span></p>
            </div>
            <div className="mt-3 whitespace-pre-line rounded-2xl rounded-bl-md bg-accent/15 p-3 text-sm leading-relaxed text-ink">{message}</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button type="button" onClick={copy}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent px-5 font-semibold text-accent-fg transition hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50">
                {copied === 'ok' ? <Icon.Check width={18} height={18} /> : <Icon.Megaphone width={18} height={18} />}
                {copied === 'ok' ? t('คัดลอกแล้ว วางในกลุ่ม LINE ได้เลย') : copied === 'fail' ? t('คัดลอกไม่ได้ เลือกข้อความด้านบนแทน') : t('คัดลอกข้อความทวงงาน')}
              </button>
              <Link to="/signup" className="inline-flex min-h-[48px] items-center justify-center rounded-xl px-5 font-semibold text-brand-600 ring-1 ring-brand-600/30 hover:bg-brand-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/50">{t('ใช้กับห้องจริง สมัครฟรี')}</Link>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink/65">
            {scanned.length
              ? t('เหลือสมุดบนโต๊ะอีก {left} เล่ม แตะต่อได้เลย', { left: left })
              : t('ทุกคนยังอยู่ในรายชื่อ จนกว่าสมุดจะถูกสแกน (เลขที่ 4 กับ 7 ยังไม่ส่งสมุด)')}
          </p>
        )}
      </div>
    </div>
  );
}
