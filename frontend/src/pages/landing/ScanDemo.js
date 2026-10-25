import { t } from '../../i18n';
import React from 'react';
import { LogoMark } from '../../components/brand/Logo';
import { NotebookCover, Icon } from './art';
import Phone from './Phone';

// ฉากสาธิตบนส่วนหัว: สมุดเลื่อนเข้ากรอบสแกนทีละเล่ม → ขึ้นว่าส่งแล้ว → ตัวนับเพิ่ม (CSS ล้วน · ดู landing.css)
const ROLL = [
  { name: 'ด.ญ. มาลี รักเรียน', short: 'มาลี รักเรียน', no: 12, color: 'blue', seed: 5 },
  { name: 'ด.ช. ธนากร สุขใจ', short: 'ธนากร สุขใจ', no: 13, color: 'gold', seed: 9 },
  { name: 'ด.ญ. สุภาพร เก่งกาจ', short: 'สุภาพร เก่งกาจ', no: 14, color: 'green', seed: 15 },
];

const Reticle = () => (
  <svg viewBox="0 0 100 100" className="ks-reticle absolute inset-[12%] h-[76%] w-[76%]" fill="none" aria-hidden="true" preserveAspectRatio="none">
    <path d="M2 18V2h16M82 2h16v16M98 82v16H82M18 98H2V82" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>
);

export default function ScanDemo() {
  return (
    <div className="ks-scan-live relative mx-auto h-[560px] w-full max-w-[380px] sm:h-[640px] sm:max-w-[440px]" role="img"
      aria-label={t("ตัวอย่าง: ครูสแกนคิวอาร์บนปกสมุดทีละเล่ม ระบบขึ้นชื่อนักเรียนว่าส่งแล้ว และนับจำนวนให้")}>
      {/* กองสมุดบนโต๊ะ */}
      <div className="absolute left-0 top-6 w-[138px] -rotate-[11deg] sm:left-2 sm:top-8 sm:w-[170px]">
        <NotebookCover name="ปิยะดา" no={4} color="rose" seed={21} size={8} />
      </div>
      <div className="absolute left-5 top-24 w-[138px] -rotate-[3deg] sm:left-10 sm:top-28 sm:w-[170px]">
        <NotebookCover name="วีรภัทร" no={7} color="green" seed={33} size={8} />
      </div>

      {/* มือถือ */}
      <Phone className="absolute right-0 top-0 w-[226px] sm:w-[262px]" screenClass="bg-page" barClass="text-ink">
        <div className="flex min-h-0 flex-1 flex-col">
        <div className="mt-2 flex items-center justify-between px-3.5">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink"><LogoMark size={20} tone="theme" />{t(' สแกนส่งงาน')}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-pass/10 px-2 py-0.5 text-[10px] font-medium text-pass ring-1 ring-pass/25">
            <span className="h-1.5 w-1.5 rounded-full bg-pass" />{t(' ออนไลน์')}</span>
        </div>
        <div className="mx-3.5 mt-2 truncate text-[11px] text-ink/70">{'คณิตศาสตร์ ม.2/1 · ใบงานที่ 3'}{/* ชื่อวิชา/ใบงานตัวอย่าง (ข้อมูลสมมติ) */}</div>

        {/* กรอบกล้อง */}
        <div className="relative mx-3 mt-2 aspect-[1/0.92] overflow-hidden rounded-2xl bg-[#0c1220]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(255_255_255/0.10),transparent_65%)]" />
          {ROLL.map((s, i) => (
            <div key={s.no} className={`ks-nb-${i} absolute left-1/2 top-1/2 -ml-[25%] -mt-[33%] w-[50%]`}>
              <NotebookCover name={s.short} no={s.no} color={s.color} seed={s.seed} size={6.5} />
            </div>
          ))}
          <Reticle />
          <div className="ks-beam absolute inset-x-[14%] bottom-[12%] top-[12%]">
            <div className="h-[2px] rounded-full bg-accent shadow-[0_0_14px_3px_rgb(var(--accent)/0.7)]" />
          </div>
          <div className="ks-flash absolute inset-0 bg-[#22c55e] opacity-0" />
        </div>

        {/* แจ้งผลการสแกน */}
        <div className="relative mx-3 mt-2.5 h-[46px]">
          {ROLL.map((s, i) => (
            <div key={s.no} className={`ks-toast-${i} absolute inset-0 flex items-center gap-2 rounded-xl bg-card px-2.5 shadow-[0_6px_16px_-8px_rgb(12_24_51/0.35)] ring-1 ring-pass/30`}>
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pass text-white"><Icon.Check width={14} height={14} /></span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[11.5px] font-semibold text-ink">{s.name}</span>
                <span className="block text-[10px] text-pass">{t('ส่งแล้ว · เลขที่ {no}', { no: s.no })}</span>
              </span>
            </div>
          ))}
        </div>

        {/* ตัวนับ */}
        <div className="mx-3 mt-2 rounded-xl bg-card px-3 py-2.5 ring-1 ring-ink/10">
          <div className="flex items-baseline justify-between text-[11px] text-ink/70">
            <span>{t('ส่งแล้ว')}</span>
            <span className="text-ink">
              <span className="relative inline-grid font-display text-[17px] font-bold tabular-nums">
                {[28, 29, 30, 31].map((n, i) => <span key={n} className={`ks-cnt-${i} [grid-area:1/1]`}>{n}</span>)}
              </span>
              <span className="text-ink/60">{t('/32 คน')}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div className="ks-bar h-full rounded-full bg-pass" />
          </div>
        </div>
          <div className="mx-3 mt-2 flex items-center justify-between rounded-xl bg-card px-3 py-2 text-[11px] ring-1 ring-ink/10">
            <span className="text-ink/70">{t('ยังไม่ส่ง')}</span>
            <span className="font-semibold text-fail">{t('เลขที่ 4, 7 ›')}</span>
          </div>
          <div className="flex-1" />
          <nav className="mt-2 grid grid-cols-5 items-end border-t border-ink/10 bg-card px-1 pb-2 pt-1.5 text-[9px] text-ink/60" aria-hidden="true">
            {[t('หน้าแรก'), t('ติดตาม'), null, t('งาน'), t('เพิ่มเติม')].map((label, i) => label ? (
              <span key={i} className="flex flex-col items-center gap-0.5"><span className="h-3.5 w-3.5 rounded-[4px] border-[1.5px] border-current" />{label}</span>
            ) : (
              <span key={i} className="-mt-5 flex flex-col items-center gap-0.5 font-semibold text-ink"><span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-fg ring-4 ring-card"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></svg></span>{t('สแกน')}</span>
            ))}
          </nav>
        </div>
      </Phone>

      {/* ข้อความทวงงานที่คัดลอกไปวางใน LINE */}
      <div className="ks-float absolute bottom-0 left-0 w-[200px] sm:bottom-2 sm:w-[224px]">
        <div className="rounded-2xl rounded-bl-md bg-card p-3 text-ink shadow-[0_24px_48px_-18px_rgb(0_0_0/0.55)] ring-1 ring-ink/10">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-600"><Icon.Megaphone width={14} height={14} />{t(' ข้อความทวงงาน · คัดลอกแล้ว')}</div>
          <p className="mt-1.5 text-[12px] leading-relaxed">{'ม.2/1 ใบงานที่ 3 ยังไม่ส่ง เลขที่ 4, 7 ส่งพรุ่งนี้นะคะ'}{/* ข้อความทวงงานคงภาษาไทย (ตามที่ครูคัดลอกไปส่งผู้ปกครอง) */}</p>
        </div>
      </div>
    </div>
  );
}
