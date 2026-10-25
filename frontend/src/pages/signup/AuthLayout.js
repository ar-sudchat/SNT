import { t, tx } from '../../i18n';
import React, { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/brand/Logo';
import LanguagePicker from '../../components/LanguagePicker';
import Phone from '../landing/Phone';

// โครงหน้าเข้าสู่ระบบ / สมัคร / เข้าร่วมกลุ่ม / ตอบรับคำเชิญ (ใช้ร่วมกัน)
// จอ lg+: ซ้าย = แผงแบรนด์ (มือถือแสดงหน้าจอจริง + จุดเด่น 3 ข้อ) · ขวา = ฟอร์มบนพื้นสว่าง
// จอเล็ก: หัวแบรนด์แถบบาง แล้วฟอร์มทันที (ไม่มีภาพใหญ่)

// ลวดลายสมุด: จุดตาราง + เส้นบรรทัด + เส้นกั้นหน้าสีดาวเรือง (สีขาวจางบนพื้นสีหลัก)
const DOTS = { backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.11) 1.2px, transparent 1.5px)', backgroundSize: '22px 22px' };
const RULED = { backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 39px, rgb(255 255 255 / 0.06) 39px 40px)' };
const PANEL_BG = { backgroundImage: 'linear-gradient(150deg, rgb(var(--login-from)), rgb(var(--login-to)))' };

const I = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false' };
const ScanIcon = (p) => <svg {...I} {...p}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></svg>;
const ListIcon = (p) => <svg {...I} {...p}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9.5l1.5 1.5L12 8.5M8 15h.01M14 10h2.5M11 15h5.5" /></svg>;
const CloudIcon = (p) => <svg {...I} {...p}><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.2 9.3 4.4 4.4 0 0 0 7 18z" /><path d="M12 10.5v5M9.8 13.4L12 15.6l2.2-2.2" /></svg>;

const BENEFITS = [
  { Icon: ScanIcon, text: 'สแกน QR บนปกสมุด ระบบบันทึกว่าส่งแล้วทันที' },
  { Icon: ListIcon, text: 'เห็นงานค้างทั้งห้อง ทุกวิชา ในจอเดียว' },
  { Icon: CloudIcon, text: 'เน็ตหลุดก็สแกนต่อได้ ข้อมูลส่งขึ้นเองเมื่อกลับมาออนไลน์' },
];

// เส้นใต้แบบลายมือ สีดาวเรือง
const Scribble = ({ className = '' }) => (
  <svg viewBox="0 0 300 24" preserveAspectRatio="none" className={className} aria-hidden="true" focusable="false">
    <path d="M4 15c40-7 92-11 150-9 52 2 98 6 142 3M24 21c58-5 130-7 214-3" fill="none" stroke="rgb(var(--accent))" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
);

const BrandPanel = () => (
  <aside className="relative hidden overflow-hidden text-white lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col" style={PANEL_BG}>
    <div className="pointer-events-none absolute inset-0" style={DOTS} aria-hidden="true" />
    <div className="pointer-events-none absolute inset-0" style={RULED} aria-hidden="true" />
    <span className="pointer-events-none absolute inset-y-0 left-8 w-1.5 border-x border-accent-400/30" aria-hidden="true" />

    <div className="relative flex h-full flex-col px-12 py-10 xl:px-16">
      <Link to="/" className="self-start rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-4 focus-visible:ring-offset-brand-900" aria-label={t("KruScan หน้าแรก")}>
        <Logo tone="white" size={40} tagline={false} />
      </Link>

      <div className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-8 xl:gap-12">
        <div>
          <p className="font-display text-[clamp(1.75rem,2.6vw,2.6rem)] font-semibold leading-[1.25] tracking-tight [text-wrap:balance]">{tx('สแกนสมุด <hl>รู้ทันที</hl><br/>ใครส่งงานแล้ว', {
            hl: (c) => <span className="relative inline-block whitespace-nowrap">{c}<Scribble className="absolute -bottom-2 left-0 h-3 w-full" /></span>,
            br: () => <br />,
          })}</p>
          <ul className="mt-9 space-y-4">
            {BENEFITS.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
                  <Icon className="size-5 text-accent-300" />
                </span>
                <span className="pt-1.5 text-[15px] leading-relaxed text-brand-100 [text-wrap:pretty]">{t(text)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative w-[clamp(176px,16vw,236px)]">
          <Phone src="/guide/img/phone-scan-grade.jpg" alt="" className="absolute left-[50%] -top-[6%] w-[88%] rotate-[9deg] brightness-[0.92]" />
          <Phone src="/guide/img/phone-mon-all.jpg" alt={t("หน้าติดตามงานบนมือถือ แสดงจำนวนนักเรียนที่ส่งและยังไม่ส่งแต่ละห้อง")} className="relative w-full rotate-2" />
        </div>
      </div>

      <p className="text-sm text-brand-200">{t('ใช้ฟรีสำหรับครู · ชวนเพื่อนครูเข้ากลุ่มเดียวกันได้')}</p>
    </div>
  </aside>
);

const MobileHeader = () => (
  <header className="relative overflow-hidden text-white lg:hidden" style={PANEL_BG}>
    <div className="pointer-events-none absolute inset-0" style={DOTS} aria-hidden="true" />
    <div className="relative mx-auto flex w-full max-w-[400px] items-center justify-between gap-3 px-4 py-4 sm:max-w-[432px]">
      <Link to="/" className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-300" aria-label={t("KruScan หน้าแรก")}>
        <Logo tone="white" size={36} />
      </Link>
    </div>
  </header>
);

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-[100dvh] bg-white selection:bg-accent-200 selection:text-ink-900 lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
      <BrandPanel />
      <div className="flex min-h-[100dvh] flex-col lg:min-h-0">
        <MobileHeader />
        <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-7 sm:items-center sm:py-12">
          <div className="w-full max-w-[400px]">
            <div className="mb-4 flex justify-end"><LanguagePicker /></div>
            {title && <h1 className="font-display text-2xl font-bold tracking-tight text-gray-900 sm:text-[1.75rem]">{title}</h1>}
            {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{subtitle}</p>}
            <div className={title || subtitle ? 'mt-7' : ''}>{children}</div>
          </div>
        </main>
        <footer className="px-4 pb-6 text-xs text-gray-500">
          <div className="mx-auto flex w-full max-w-[400px] flex-wrap items-center justify-center gap-x-1 gap-y-1">
            {footer}
            {footer && <span aria-hidden="true">·</span>}
            <a href="/privacy" className={footerLinkClass}>{t('ความเป็นส่วนตัว')}</a>
            <span aria-hidden="true">·</span>
            <a href="/guide/" target="_blank" rel="noopener noreferrer" className={footerLinkClass}>{t('คู่มือการใช้งาน')}</a>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ---------- ชิ้นส่วนฟอร์มที่ใช้ร่วมกัน ----------

export const inputClass = 'block w-full min-h-[48px] rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-base text-gray-900 caret-brand-600 shadow-[0_1px_2px_rgb(16_24_40/0.04)] placeholder:text-gray-400 transition-colors hover:border-gray-400 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-500/20 read-only:bg-gray-50 read-only:text-gray-600';

export const footerLinkClass = 'inline-flex min-h-[44px] items-center rounded px-2 underline-offset-4 hover:text-gray-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

export const linkClass = 'rounded font-semibold text-brand-700 underline decoration-brand-300 underline-offset-4 hover:decoration-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

export function Field({ label, hint, id, className = '', inputClassName = '', ...props }) {
  const auto = useId();
  const fid = id || auto;
  const hid = hint ? `${fid}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <input id={fid} aria-describedby={hid} className={`${inputClass} ${inputClassName}`} {...props} />
      {hint && <p id={hid} className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

const EyeIcon = ({ off }) => (
  <svg {...I} className="size-5">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);

// ประเมินความแข็งแรงรหัสผ่านแบบหยาบ (แนะนำเท่านั้น เซิร์ฟเวอร์ตรวจแค่ความยาว ≥ 8)
export function passwordStrength(pw) {
  if (!pw) return null;
  if (pw.length < 8) return { level: 0, label: t('สั้นไป อีก {value1} ตัว', { value1: 8 - pw.length }) };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 12 && kinds >= 3) return { level: 3, label: t('แข็งแรง') };
  if (kinds >= 2) return { level: 2, label: t('ดี — ยาวขึ้นอีกนิดจะปลอดภัยกว่า') };
  return { level: 1, label: t('พอใช้ — ผสมตัวเลขหรือสัญลักษณ์จะดีขึ้น') };
}

const BAR = ['bg-red-500', 'bg-accent-500', 'bg-brand-500', 'bg-pass'];

export function PasswordField({ label = t('รหัสผ่าน'), id, value, onChange, autoComplete = 'current-password', showStrength = false, hint, ...props }) {
  const auto = useId();
  const fid = id || auto;
  const [show, setShow] = useState(false);
  const s = showStrength ? passwordStrength(value) : null;
  const hid = `${fid}-hint`;
  const hintText = s ? s.label : hint;
  return (
    <div>
      <label htmlFor={fid} className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input id={fid} type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete}
          aria-describedby={hintText ? hid : undefined} className={`${inputClass} pr-12`} {...props} />
        <button type="button" onClick={() => setShow((v) => !v)} aria-controls={fid} aria-pressed={show}
          aria-label={show ? t('ซ่อนรหัสผ่าน') : t('แสดงรหัสผ่าน')} title={show ? t('ซ่อนรหัสผ่าน') : t('แสดงรหัสผ่าน')}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-gray-500 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
          <EyeIcon off={show} />
        </button>
      </div>
      {showStrength && (
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${s && (s.level > i || (s.level === 0 && i === 0)) ? BAR[s.level] : 'bg-gray-200'}`} />
          ))}
        </div>
      )}
      {hintText && <p id={hid} aria-live={showStrength ? 'polite' : undefined} className="mt-1.5 text-xs text-gray-500">{hintText}</p>}
    </div>
  );
}

export const OrDivider = () => (
  <div className="my-6 flex items-center gap-3 text-sm text-gray-500" role="separator" aria-label={t("หรือ")}>
    <span className="h-px flex-1 bg-gray-200" /><span aria-hidden="true">{t('หรือ')}</span><span className="h-px flex-1 bg-gray-200" />
  </div>
);

export const primaryBtn = 'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2 text-base font-semibold text-white shadow-[0_1px_2px_rgb(16_24_40/0.12)] transition-colors hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
export const secondaryBtn = 'flex min-h-[48px] w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2 text-base font-medium text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

export const Spinner = () => (
  <svg className="size-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

// ข้อความผิดพลาด: กล่อง aria-live อยู่ตลอด เพื่อให้ screen reader อ่านเมื่อมีข้อความใหม่
export const FormError = ({ title, message }) => (
  <div aria-live="assertive" aria-atomic="true">
    {(title || message) && (
      <div className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
        <svg {...I} className="mt-0.5 size-4 shrink-0"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>
        <div>
          {title && <p className="font-semibold">{title}</p>}
          {message && <p className={title ? 'mt-0.5' : ''}>{message}</p>}
        </div>
      </div>
    )}
  </div>
);
