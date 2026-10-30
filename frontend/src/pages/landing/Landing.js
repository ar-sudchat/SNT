import { t, tx } from '../../i18n';
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Logo, { LogoMark } from '../../components/brand/Logo';
import { StackDone, TeacherWave, ChatSpark, DotPattern } from '../../components/illustrations';
import ScanDemo from './ScanDemo';
import Phone from './Phone';
import TryScan from './TryScan';
import { NotebookCover, StepArt, Icon, Scribble, CurlyArrow, TeacherGroup, QrPattern } from './art';
import './landing.css';
import LanguagePicker from '../../components/LanguagePicker';

// หน้าแรกสาธารณะ (ผู้ที่ยังไม่ล็อกอิน) — เล่าเรื่อง: ปัญหา → ลองสแกน → เริ่มยังไง → หน้าจอจริง → ใช้เป็นกลุ่ม → ฟรี/คำถาม → ชวนเริ่ม

const CTA = 'inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-7 text-base font-semibold transition duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/60';

const STEPS = [
  { k: 'สมัคร', t: 'สมัครฟรี ได้กลุ่มทันที', d: 'ใช้อีเมลหรือ Google ได้กลุ่มส่วนตัวเลย เพิ่มห้อง วิชา รายชื่อ หรือนำเข้าจาก Excel' },
  { k: 'แปะ QR', t: 'พิมพ์ QR แปะปกสมุด', d: 'สมุดหนึ่งเล่ม QR หนึ่งดวง พิมพ์จากในระบบ ใช้สมุดเล่มเดิมของนักเรียน' },
  { k: 'สแกน', t: 'สแกนตอนรับสมุด', d: 'เปิดกล้องมือถือ สแกนต่อกันได้ทั้งกอง เน็ตหลุดก็ยังเก็บไว้ในเครื่อง' },
  { k: 'ทวง', t: 'เห็นคนค้าง ทวงได้ทันที', d: 'รายชื่อคนที่ยังไม่ส่งขึ้นเอง คัดลอกข้อความทวงงานไปวางในกลุ่ม LINE ห้อง' },
];

const FAQ = [
  ['นักเรียนต้องมีมือถือหรือ LINE ไหม', 'ไม่ต้อง ครูเป็นคนสแกนสมุดเอง นักเรียนแค่มี QR แปะที่ปกสมุด ไม่ต้องล็อกอิน ไม่ต้องลงแอป ถ้าอยากให้ผู้ปกครองดูงานของลูก ครูส่งลิงก์ให้ได้'],
  ['ต้องใช้อุปกรณ์อะไรบ้าง', 'มือถือที่มีกล้องเครื่องเดียว เปิดผ่านเบราว์เซอร์ได้เลย จะเพิ่มไว้ที่หน้าจอโฮมให้เปิดเหมือนแอปก็ได้ ส่วนรายงานภาพรวมเปิดบนคอมได้สะดวก'],
  ['สัญญาณเน็ตไม่ดี สแกนได้ไหม', 'ได้ รายการที่สแกนตอนออฟไลน์จะเก็บไว้ในเครื่องก่อน แล้วส่งขึ้นระบบเองเมื่อกลับมาออนไลน์ มีป้ายบอกว่ายังรอส่งกี่รายการ'],
  ['ชวนเพื่อนครูเข้ากลุ่มยังไง', 'ในหน้าตั้งค่ากลุ่มมีรหัสเข้ากลุ่ม 6 ตัว (เช่น MTH-205) และลิงก์เชิญ ส่งให้เพื่อนครู เพื่อนสมัครแล้วกรอกรหัสหรือเปิดลิงก์ก็เข้ากลุ่มได้ทันที'],
  ['ข้อมูลนักเรียนปลอดภัยไหม', 'ข้อมูลแต่ละกลุ่มแยกกันอยู่ คนนอกกลุ่มมองไม่เห็น และออกแบบตามแนวทาง PDPA อ่านรายละเอียดได้ที่นโยบายความเป็นส่วนตัว'],
  ['ใช้ฟรีได้แค่ไหน', 'แพ็กเกจฟรีใช้ฟีเจอร์สแกนและตรวจงานได้ครบ ตามโควตาจำนวนนักเรียนและครูของแพ็กเกจฟรี ไม่ต้องใช้บัตรเครดิต'],
];

// เผยเนื้อหาเมื่อเลื่อนถึง: ใส่ .is-in ให้ [data-reveal] (CSS ทำงานเฉพาะเมื่อไม่ได้ขอลดการเคลื่อนไหว)
function useReveal(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const els = root.querySelectorAll('[data-reveal]');
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('is-in'));
      return undefined;
    }
    root.classList.add('ks-reveal-on');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [ref]);
}

const d = (ms) => ({ '--d': `${ms}ms` });

function SectionTitle({ id, children, sub, center = false }) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} data-reveal>
      <h2 id={id} className="font-display text-[1.75rem] font-bold leading-[1.3] text-ink sm:text-[2.5rem] sm:leading-[1.25]" style={{ textWrap: 'balance' }}>{children}</h2>
      {sub && <p className="mt-3 text-base leading-relaxed text-ink/75 sm:text-lg">{sub}</p>}
    </div>
  );
}

function BrowserFrame({ src, alt, label }) {
  return (
    <figure className="overflow-hidden rounded-xl bg-card shadow-[0_30px_70px_-30px_rgb(8_14_30/0.5)] ring-1 ring-ink/10">
      <div className="flex h-8 items-center gap-1.5 border-b border-ink/10 px-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" /><span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" /><span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
        <span className="ml-3 truncate rounded-md bg-page px-3 py-0.5 text-[11px] text-ink/60">{label}</span>
      </div>
      <img src={src} alt={alt} width="1400" height="875" loading="lazy" decoding="async" className="block h-auto w-full" />
    </figure>
  );
}

export default function Landing() {
  const rootRef = useRef(null);
  useReveal(rootRef);

  return (
    <div ref={rootRef} className="ks-landing min-h-screen overflow-x-clip bg-page text-ink">
      {/* แถบบน */}
      <header className="sticky top-0 z-40 bg-title text-title-fg shadow-[0_1px_0_rgb(255_255_255/0.08)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link to="/" aria-label={t("KruScan หน้าแรก")} className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <Logo variant="horizontal" size={34} tone="white" tagline={false} />
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2" aria-label={t("เมนูหลัก")}>
            <LanguagePicker compact dark />
            <a href="/guide/" className="hidden min-h-[44px] items-center rounded-lg px-3 text-title-fg/80 hover:text-title-fg md:inline-flex">{t('คู่มือ')}</a>
            <a href="#faq" className="hidden min-h-[44px] items-center rounded-lg px-3 text-title-fg/80 hover:text-title-fg md:inline-flex">{t('คำถามที่พบบ่อย')}</a>
            <Link to="/login" className="inline-flex min-h-[44px] items-center rounded-lg px-3 font-medium text-title-fg hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">{t('เข้าสู่ระบบ')}</Link>
            <Link to="/signup" className="inline-flex min-h-[44px] items-center rounded-lg bg-accent px-4 font-semibold text-accent-fg hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">{t('สมัครใช้ฟรี')}</Link>
          </nav>
        </div>
        <div className="ks-progress h-[3px] bg-accent" aria-hidden="true" />
      </header>

      <main>
        {/* 1 · ฮีโร่ */}
        <section className="ks-ruled ks-margin relative overflow-hidden bg-title text-title-fg" aria-labelledby="hero">
          <DotPattern className="text-white/[0.07] [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-24 lg:pt-16">
            <div className="pl-4 lg:pl-6">
              <h1 id="hero" className="font-display text-[2.6rem] font-bold leading-[1.22] tracking-[-0.01em] sm:text-6xl sm:leading-[1.18] lg:text-[4.1rem]">{t('หยิบ สแกน วาง')}<br />
                <span className="ks-draw-now relative inline-block">
                  {tx('<hl>รู้ทันที</hl>ใครยังไม่ส่ง', { hl: (c) => <span className="ks-hl">{c}</span> })}<Scribble className="absolute -bottom-2 left-0 h-3 w-[46%] sm:-bottom-3 sm:h-4" />
                </span>
              </h1>
              <p className="mt-7 max-w-[37rem] text-lg leading-relaxed text-title-fg/85" style={{ textWrap: 'pretty' }}>{t('แปะ QR ที่ปกสมุดนักเรียน รับสมุดมาทั้งกองแล้วสแกนด้วยมือถือ ระบบจดให้ว่าใครส่งแล้ว ใครยังค้าง พร้อมข้อความทวงงานให้คัดลอกไปวางใน LINE')}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className={`${CTA} bg-accent text-accent-fg shadow-[0_14px_30px_-12px_rgb(var(--accent)/0.8)] hover:-translate-y-0.5 hover:brightness-105`}>{t('สมัครใช้ฟรี ')}<Icon.Arrow width={20} height={20} />
                </Link>
                <a href="#try" className={`${CTA} text-title-fg ring-1 ring-white/30 hover:bg-white/10`}>{t('ลองสแกนดูก่อน')}</a>
              </div>
              <ul className="mt-7 grid gap-2 text-sm text-title-fg/80 sm:grid-cols-2">
                {['สมัครด้วยอีเมลหรือ Google', 'นักเรียนไม่ต้องมีมือถือ ไม่ต้องล็อกอิน', 'สแกนได้แม้เน็ตหลุด', 'ไม่ต้องใช้บัตรเครดิต'].map(txt => (
                  <li key={txt} className="flex items-center gap-2"><Icon.Check width={18} height={18} className="shrink-0 text-accent" />{t(txt)}</li>
                ))}
              </ul>
            </div>
            <div data-reveal="zoom"><ScanDemo /></div>
          </div>
        </section>

        {/* 2 · ปัญหา → แบบเดิม vs ครูสแกน */}
        <section className="relative py-16 sm:py-24" aria-labelledby="pain">
          <div className="ks-dots pointer-events-none absolute inset-x-0 top-0 h-64 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle id="pain" sub={t("ลองนึกภาพสมุด 40 เล่มบนโต๊ะหลังคาบ งานตรวจยังไม่เริ่ม แต่ต้องรู้ก่อนว่าใครยังไม่ส่ง")}>{t('สมุดกองโตบนโต๊ะ แต่')}<span className="relative inline-block">{t('ใครยังไม่ส่ง?')}<Scribble className="absolute -bottom-2 left-0 h-3 w-full" /></span>
            </SectionTitle>

            <div className="mt-12 grid gap-6 lg:grid-cols-2 lg:gap-10">
              {/* แบบเดิม: กระดาษสมุดเส้น */}
              <div data-reveal="left" className="relative">
                <div className="ks-paper relative rounded-2xl px-6 pb-8 pl-[68px] pt-6 shadow-[0_20px_40px_-24px_rgb(8_14_30/0.4)] ring-1 ring-black/5" style={{ transform: 'rotate(-1deg)' }}>
                  <div className="text-sm font-bold uppercase tracking-wide text-[#a33]">{t('แบบเดิม')}</div>
                  <ul className="mt-3 space-y-[12px] text-[15px] leading-[24px]">
                    {['นับสมุดทีละเล่ม แล้วจดชื่อลงกระดาษ', 'ไล่เทียบรายชื่อว่าใครยังไม่ส่ง', 'จำไม่ได้ว่าใครค้างวิชาไหน ทวงซ้ำทวงพลาด', 'ให้ส่งรูปงานในแชท เด็กที่ไม่มี LINE ก็ตกหล่น'].map(txt => (
                      <li key={txt} className="flex gap-2.5"><Icon.Cross width={20} height={20} className="mt-0.5 shrink-0 text-[#c0392b]" /><span>{t(txt)}</span></li>
                    ))}
                  </ul>
                  {/* รอยขีดนับแบบมือ */}
                  <svg viewBox="0 0 150 40" className="mt-5 h-9 w-auto text-[#5a6785]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    {[0, 1].map(g => (
                      <g key={g} transform={`translate(${g * 52} 0)`}>
                        {[0, 1, 2, 3].map(i => <path key={i} d={`M${6 + i * 9} 6l-1 28`} />)}
                        <path d="M0 28L40 10" />
                      </g>
                    ))}
                    <path d="M112 6l-1 28M121 6l-1 28" />
                    <text x="132" y="28" fontSize="16" fill="currentColor" stroke="none">?</text>
                  </svg>
                </div>
              </div>

              {/* ครูสแกน */}
              <div data-reveal="right" style={d(120)} className="relative overflow-hidden rounded-2xl bg-card p-6 ring-1 ring-ink/10 shadow-[0_24px_50px_-28px_rgb(12_24_51/0.45)]">
                <div className="relative">
                  <div className="text-sm font-bold tracking-wide text-pass">{t('ครูสแกน')}</div>
                  <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink">
                    {['สแกน QR บนปกสมุดต่อเนื่องได้ทั้งกอง', 'รายชื่อคนที่ยังไม่ส่งขึ้นให้เอง ไม่ต้องเทียบ', 'กดคัดลอกข้อความทวงงาน วางในกลุ่ม LINE ห้อง', 'นักเรียนไม่ต้องมีมือถือ ใช้สมุดเล่มเดิม'].map(txt => (
                      <li key={txt} className="flex gap-2.5"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-pass text-white"><Icon.Check width={13} height={13} /></span><span>{t(txt)}</span></li>
                    ))}
                  </ul>
                  <div className="mt-5 flex items-end justify-between gap-4">
                    <p className="max-w-[17rem] text-sm text-ink/70">{t('หยิบ สแกน วาง ทีละเล่ม ที่เหลือระบบนับให้')}</p>
                    <StackDone className="h-20 w-auto shrink-0 text-brand-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 · ลองเอง */}
        <section id="try" className="relative scroll-mt-20 bg-card py-16 sm:py-24" aria-labelledby="try-title">
          <div className="ks-ruled-light pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex items-start justify-between gap-6">
              <SectionTitle id="try-title" sub={t("แตะสมุดบนโต๊ะทีละเล่มเหมือนครูสแกนจริง แล้วดูรายชื่อคนที่ยังไม่ส่งหดลงเรื่อยๆ")}>{t('ลองเป็นครูดูสักกอง')}</SectionTitle>
              <CurlyArrow className="hidden h-20 w-auto shrink-0 lg:block" />
            </div>
            <div className="mt-10" data-reveal style={d(100)}><TryScan /></div>
          </div>
        </section>

        {/* 4 · เริ่มยังไง */}
        <section className="relative py-16 sm:py-24" aria-labelledby="how">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle id="how" center sub={t("ไม่ต้องติดตั้งอะไร ไม่ต้องรอแอดมินโรงเรียน เริ่มได้เองตั้งแต่วันนี้")}>{t('จากสมัคร ถึงสแกนเล่มแรก')}</SectionTitle>
            <p className="mx-auto mt-6 flex max-w-max flex-wrap items-center justify-center gap-x-2 gap-y-2 rounded-full bg-card px-4 py-2 text-sm font-semibold text-ink ring-1 ring-ink/10" data-reveal aria-label={t("สรุป 4 ขั้น: สมัคร แปะ QR สแกน ทวง")}>
              {STEPS.map((s, i) => (
                <React.Fragment key={s.k}>
                  {i > 0 && <Icon.Arrow width={16} height={16} className="text-accent" />}
                  <span>{t(s.k)}</span>
                </React.Fragment>
              ))}
            </p>
            <ol className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              <svg className="pointer-events-none absolute left-[12%] right-[12%] top-[56px] hidden h-4 lg:block" preserveAspectRatio="none" viewBox="0 0 100 4" aria-hidden="true">
                <path d="M0 2h100" stroke="rgb(var(--accent))" strokeWidth="0.6" strokeDasharray="1.4 1.6" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
              </svg>
              {STEPS.map((s, i) => (
                <li key={s.t} data-reveal style={d(i * 110)} className="relative flex gap-4 sm:block">
                  <div className="relative grid h-[88px] w-[92px] shrink-0 sm:h-[112px] sm:w-[120px] place-items-center rounded-3xl bg-card text-brand-600 ring-1 ring-ink/10 shadow-[0_14px_30px_-20px_rgb(12_24_51/0.5)] sm:mx-0">
                    <StepArt step={i + 1} className="h-[60px] w-auto sm:h-[78px]" />
                    <span className="absolute -left-2 -top-2 grid h-8 w-8 place-items-center rounded-full bg-accent font-display text-sm font-bold text-accent-fg ring-4 ring-page">{i + 1}</span>
                  </div>
                  <div className="sm:mt-5">
                    <h3 className="font-display text-lg font-semibold leading-snug text-ink">{t(s.t)}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-ink/75">{t(s.d)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5 · หน้าจอจริง */}
        <section className="relative overflow-hidden bg-card py-16 sm:py-24" aria-labelledby="proof">
          <div className="pointer-events-none absolute right-0 top-0 hidden h-64 w-80 text-brand-600 lg:block [mask-image:radial-gradient(circle_at_top_right,black,transparent_70%)]" style={{ opacity: 0.06 }} aria-hidden="true">
            <QrPattern className="" id="ks-qr-proof" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <SectionTitle id="proof" sub={t("ภาพจากแอปจริง ใช้บนมือถือตอนสแกน และเปิดบนคอมตอนดูภาพรวม")}>{t('หน้าจอจริง ที่ครูจะได้ใช้')}</SectionTitle>

            {/* แถว 1: ติดตาม + ภาพรวม */}
            <div className="mt-12 grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
              <div className="relative pb-16 pr-[18%] sm:pb-20 lg:col-span-7" data-reveal="left">
                <BrowserFrame src="/guide/img/desktop-admin.jpg" alt={t("หน้าภาพรวมบนคอม แสดงสัดส่วนงานที่ส่งแล้ว วิชาที่ต้องติดตาม และความพร้อมของระบบ")} label={t("ครูสแกน · ภาพรวม")} />
                <Phone src="/guide/img/phone-mon-class.jpg" alt={t("หน้าตรวจงานบนมือถือ แสดงรายชื่อนักเรียนที่ยังค้างงานพร้อมจำนวน และปุ่มคัดลอกข้อความทวงงาน")}
                  className="absolute -bottom-6 right-0 w-[30%] max-w-[210px] rotate-[3deg]" />
              </div>
              <div className="space-y-7 lg:col-span-5">
                {[
                  [Icon.Chart, 'เปิดมาเห็นเลยว่าใครค้าง', 'ดูได้ทั้งรายห้อง รายวิชา รายคน แตะชื่อนักเรียนเพื่อดูว่าค้างงานไหนบ้าง'],
                  [Icon.Megaphone, 'ทวงงานด้วยปุ่มเดียว', 'คัดลอกข้อความรายชื่อคนที่ยังไม่ส่ง ไปวางในกลุ่ม LINE ห้องหรือกลุ่มผู้ปกครองได้ทันที'],
                  [Icon.Table, 'รายงานพร้อมส่งออก', 'สรุปการส่งงานเป็นไฟล์ ใช้ประกอบการประเมินหรือรายงานผู้บริหารได้'],
                ].map(([Ic, title, dd], i) => (
                  <div key={title} className="flex gap-4" data-reveal style={d(i * 100)}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Ic /></span>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-ink">{t(title)}</h3>
                      <p className="mt-1 text-[15px] leading-relaxed text-ink/75">{t(dd)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* แถว 2: ผู้ปกครอง + ของแถม */}
            <div className="mt-20 grid items-center gap-12 lg:grid-cols-12 lg:gap-10">
              <div className="lg:order-2 lg:col-span-7" data-reveal="right">
                <div className="relative mx-auto flex max-w-[560px] items-end justify-center pt-6">
                  <Phone src="/guide/img/phone-student.jpg" alt={t("รายงานนักเรียนรายคน มีปุ่มคัดลอกข้อความถึงผู้ปกครองและลิงก์สำหรับผู้ปกครอง")} className="relative z-0 -mr-[4%] w-[32%] max-w-[180px] -rotate-[5deg]" />
                  <Phone src="/guide/img/phone-home.jpg" alt={t("หน้าแรกของครู มีปุ่มสแกนส่งงาน ตัวเลขงานค้าง และงานที่ต้องติดตาม")} className="relative z-10 -mb-2 w-[36%] max-w-[205px] -translate-y-6" />
                  <Phone src="/guide/img/phone-ai-draft.jpg" alt={t("ผู้ช่วย AI ช่วยร่างงานหรือข้อความให้ครู")} className="relative z-0 -ml-[4%] w-[32%] max-w-[180px] rotate-[5deg]" />
                </div>
              </div>
              <div className="lg:order-1 lg:col-span-5">
                <div className="flex gap-4" data-reveal>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/20 text-ink"><Icon.Link /></span>
                  <div>
                    <h3 className="font-display text-lg font-semibold text-ink">{t('ผู้ปกครองดูเองได้ ไม่ต้องสมัคร')}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink/75">{t('ส่งลิงก์ให้ผู้ปกครอง เปิดดูได้ว่าลูกส่งงานไหนแล้ว อะไรยังค้าง โดยไม่ต้องสมัครหรือโหลดแอป')}</p>
                  </div>
                </div>
                <h3 className="mt-9 text-sm font-semibold text-ink/70" data-reveal>{t('อีกนิดที่ครูชอบ')}</h3>
                <ul className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {[
                    [Icon.Offline, 'สแกนได้แม้เน็ตหลุด', 'เก็บไว้ในเครื่อง แล้วส่งขึ้นเองทีหลัง'],
                    [Icon.Ai, 'ผู้ช่วย AI', 'ช่วยสรุปห้อง ร่างข้อความถึงผู้ปกครอง'],
                    [Icon.Shuffle, 'สุ่มชื่อเรียกตอบ', 'สล็อต วงล้อ ไข่สุ่ม ใช้ในคาบได้เลย'],
                    [Icon.Table, 'นำเข้ารายชื่อจาก Excel', 'ไม่ต้องพิมพ์ทีละคน'],
                  ].map(([Ic, title, dd], i) => (
                    <li key={title} className="flex gap-3" data-reveal style={d(i * 80)}>
                      <Ic className="mt-0.5 shrink-0 text-brand-600" />
                      <div><div className="font-semibold text-ink">{t(title)}</div><div className="text-sm text-ink/70">{t(dd)}</div></div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 6 · ใช้คนเดียวหรือทั้งกลุ่ม */}
        <section className="py-16 sm:py-24" aria-labelledby="group">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-[2rem] bg-brand-50 px-5 py-10 sm:px-10 sm:py-14 lg:px-14">
              <div className="ks-dots pointer-events-none absolute inset-0 opacity-70 [mask-image:linear-gradient(to_left,black,transparent_65%)]" aria-hidden="true" />
              <div className="relative grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
                <div>
                  <SectionTitle id="group" sub={t("สมัครแล้วได้กลุ่มส่วนตัวทันที ใช้คนเดียวได้เต็มที่ พร้อมเมื่อไรค่อยชวนเพื่อนครูมาใช้ด้วยกัน")}>
                    <span className="inline-block">{t('ใช้คนเดียวก็ได้')}</span> <span className="relative inline-block">{t('ชวนทั้งหมวดก็ดี')}<Scribble className="absolute -bottom-2 left-0 h-3 w-full" /></span>
                  </SectionTitle>
                  <ul className="mt-7 space-y-4">
                    {[
                      ['ชวนด้วยรหัสหรือลิงก์', 'ส่งรหัสเข้ากลุ่ม 6 ตัว หรือลิงก์เชิญ ให้เพื่อนครูในหมวดเข้ามาดูงานห้องเดียวกันได้'],
                      ['โรงเรียนเดียว มีได้หลายกลุ่ม', 'แยกตามกลุ่มสาระ ระดับชั้น หรือชุมนุม ข้อมูลของแต่ละกลุ่มไม่ปนกัน'],
                      ['นักเรียนไม่ต้องล็อกอิน', 'ครูสแกนสมุดอย่างเดียว ไม่ต้องสร้างบัญชีให้นักเรียนทีละคน'],
                    ].map(([title, dd], i) => (
                      <li key={title} className="flex gap-3" data-reveal style={d(i * 100)}>
                        <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-accent-fg"><Icon.Check width={15} height={15} /></span>
                        <div><div className="font-semibold text-ink">{t(title)}</div><div className="text-[15px] leading-relaxed text-ink/75">{t(dd)}</div></div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative" data-reveal="rise">
                  <TeacherGroup className="mx-auto mb-[-6px] h-28 w-auto text-brand-600 sm:h-32" />
                  <div className="ks-ticket mx-auto max-w-sm rounded-2xl bg-card px-6 py-6 shadow-[0_24px_50px_-28px_rgb(12_24_51/0.55)] ring-1 ring-ink/10 sm:px-8">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-ink">{t('กลุ่มสาระคณิตศาสตร์')}</span>
                      <span className="rounded-full bg-page px-2 py-0.5 text-xs text-ink/60">{t('ตัวอย่าง')}</span>
                    </div>
                    <div className="mt-4 text-xs text-ink/60">{t('รหัสเข้ากลุ่ม')}</div>
                    <div className="font-display text-[2.6rem] font-bold leading-tight tracking-[0.12em] tabular-nums text-brand-600">MTH-205</div>
                    <div className="my-4 border-t-2 border-dashed border-ink/15" />
                    <div className="text-xs text-ink/60">{t('หรือส่งลิงก์เชิญ')}</div>
                    <div className="mt-1 flex items-center gap-2 truncate rounded-lg bg-page px-3 py-2 text-sm text-ink/80"><Icon.Link width={16} height={16} className="shrink-0 text-brand-600" />/join/MTH-205</div>
                    <ul className="mt-5 flex flex-wrap items-center gap-2" aria-label={t("ตัวอย่างสมาชิกกลุ่ม")}>
                      {['ครูมานี', 'ครูปิติ', 'ครูชูใจ'].map((n, i) => (
                        <li key={n} className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-1 pr-3 text-sm text-ink">
                          <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${['bg-accent text-accent-fg', 'bg-brand-600 text-white', 'bg-pass text-white'][i]}`}>{n.slice(3, 4)}</span>{n}
                        </li>
                      ))}
                      <li className="text-xs text-pass">{t('เข้ากลุ่มแล้ว')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7 · ฟรี + คำถาม */}
        <section id="faq" className="scroll-mt-20 bg-card py-16 sm:py-24" aria-labelledby="faq-title">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-5">
              <div className="ks-ruled relative overflow-hidden rounded-3xl bg-title p-7 text-title-fg sm:p-9 lg:sticky lg:top-24" data-reveal>
                <div className="relative">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-display text-3xl font-bold leading-snug sm:text-4xl">{t('เริ่มฟรี')}<span className="mt-1 block whitespace-nowrap text-lg font-semibold text-title-fg/85 sm:text-xl">{t('ไม่ต้องใช้บัตรเครดิต')}</span></h2>
                    <TeacherWave className="h-20 w-auto shrink-0 text-white/90" />
                  </div>
                  <ul className="mt-5 space-y-2.5 text-title-fg/85">
                    {['สแกน ตรวจงาน คัดลอกข้อความทวงงาน ครบทุกฟีเจอร์หลัก', 'ลิงก์ผู้ปกครองและรายงานรายคน', 'ข้อมูลอยู่ในกลุ่มของคุณเอง', 'ใช้ได้ตามโควตาของแพ็กเกจฟรี'].map(txt => (
                      <li key={txt} className="flex gap-2.5"><Icon.Check width={20} height={20} className="mt-0.5 shrink-0 text-accent" />{t(txt)}</li>
                    ))}
                  </ul>
                  <Link to="/signup" className={`${CTA} mt-7 w-full bg-accent text-accent-fg hover:brightness-105`}>{t('สมัครใช้ฟรี')}</Link>
                  <p className="mt-3 text-center text-sm text-title-fg/70">{t('มีบัญชีแล้ว? ')}<Link to="/login" className="font-semibold text-title-fg underline">{t('เข้าสู่ระบบ')}</Link></p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-7">
              <div className="flex items-end justify-between gap-4" data-reveal>
                <h2 id="faq-title" className="font-display text-[1.75rem] font-bold leading-[1.3] text-ink sm:text-[2.25rem]">{t('ครูมักถามว่า…')}</h2>
                <ChatSpark className="h-16 w-auto shrink-0 text-brand-600" />
              </div>
              <div className="ks-faq mt-6 divide-y divide-ink/10 border-y border-ink/10">
                {FAQ.map(([q, a], i) => (
                  <details key={q} className="group" open={i === 0}>
                    <summary className="flex min-h-[60px] cursor-pointer items-center justify-between gap-4 py-4 text-left font-semibold text-ink hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      <span>{t(q)}</span>
                      <span className="ks-chev grid h-8 w-8 shrink-0 place-items-center rounded-full bg-page text-brand-600"><Icon.Plus width={18} height={18} /></span>
                    </summary>
                    <p className="pb-5 pr-10 text-[15px] leading-relaxed text-ink/75">
                      {t(a)}{i === 4 && <> · <Link to="/privacy" className="font-medium text-brand-600 underline">{t('นโยบายความเป็นส่วนตัว')}</Link></>}
                    </p>
                  </details>
                ))}
              </div>
              <p className="mt-5 text-sm text-ink/70">{t('อยากเห็นทุกขั้นตอนก่อน? ')}<a href="/guide/" className="font-semibold text-brand-600 underline">{t('เปิดคู่มือการใช้งาน')}</a></p>
            </div>
          </div>
        </section>

        {/* 8 · ชวนเริ่ม */}
        <section className="ks-ruled relative overflow-hidden bg-title text-title-fg" aria-labelledby="final">
          <DotPattern className="text-white/[0.06]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.3fr_1fr]">
            <div data-reveal>
              <h2 id="final" className="font-display text-[2rem] font-bold leading-[1.25] sm:text-5xl sm:leading-[1.2]" style={{ textWrap: 'balance' }}>{t('รับสมุดครั้งหน้า ')}<span className="ks-hl inline-block">{t('ลองสแกนดูสักกอง')}</span>
              </h2>
              <p className="mt-4 max-w-xl text-lg text-title-fg/80">{t('สมัครวันนี้ ได้กลุ่มพร้อมใช้ในไม่กี่นาที แล้วค่อยชวนเพื่อนครูตามมา')}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/signup" className={`${CTA} bg-accent text-accent-fg hover:-translate-y-0.5 hover:brightness-105`}>{t('สมัครใช้ฟรี ')}<Icon.Arrow width={20} height={20} /></Link>
                <Link to="/login" className={`${CTA} text-title-fg ring-1 ring-white/30 hover:bg-white/10`}>{t('เข้าสู่ระบบ')}</Link>
              </div>
            </div>
            <div className="relative mx-auto hidden h-[260px] w-[340px] sm:block" aria-hidden="true" data-reveal="rise" style={d(150)}>
              {[['rose', -14, 0, 40], ['green', -4, 70, 18], ['gold', 7, 150, 34]].map(([c, r, x, y], i) => (
                <div key={c} className="absolute w-[150px]" style={{ left: x, top: y, transform: `rotate(${r}deg)` }}>
                  <NotebookCover name={['ปิยะดา', 'ณัฐวุฒิ', 'กานต์ธิดา'][i]} no={[4, 3, 2][i]} color={c} seed={71 + i * 6} size={8} />
                </div>
              ))}
              <div className="absolute -right-2 top-0 grid h-16 w-16 place-items-center rounded-full bg-pass text-white shadow-lg ring-4 ring-title"><Icon.Check width={32} height={32} /></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10 bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-9 text-sm text-ink/70 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="inline-flex items-center gap-2.5"><LogoMark size={28} tone="theme" /><span><b className="font-semibold text-ink">KruScan</b>{t(' · ครูสแกน — สแกนสมุด รู้ทันทีใครส่งงานแล้ว')}</span></span>
          <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label={t("ลิงก์ท้ายหน้า")}>
            <a href="/guide/" className="inline-flex min-h-[44px] items-center hover:text-ink">{t('คู่มือการใช้งาน')}</a>
            <Link to="/privacy" className="inline-flex min-h-[44px] items-center hover:text-ink">{t('นโยบายความเป็นส่วนตัว')}</Link>
            <Link to="/login" className="inline-flex min-h-[44px] items-center hover:text-ink">{t('เข้าสู่ระบบ')}</Link>
            <Link to="/signup" className="inline-flex min-h-[44px] items-center hover:text-ink">{t('สมัครใช้ฟรี')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
