import { t } from '../../i18n';
import React from 'react';

// โลโก้ KruScan (ครูสแกน) — อักษร K: สันสมุด + ลำแสงสแกน + เครื่องหมายถูกสีดาวเรือง (ส่งแล้ว) · ดู /BRAND.md
// variant: 'mark' | 'horizontal' · tone: 'color' | 'white' | 'mono'
const logoTagline = () => t('สแกนสมุด รู้ทันทีใครส่งงานแล้ว');

const TONES = {
  // ตามธีมสี (CSS variables ใน src/theme/themes.css)
  side: { cover: 'rgb(var(--side-logo))', cut: 'rgb(var(--side))', accent: 'rgb(var(--accent))', word: 'rgb(var(--side-logo))', kru: 'rgb(var(--accent))', tag: 'rgb(var(--side-fg))' },
  theme: { cover: 'rgb(var(--brand-link))', cut: 'rgb(var(--card))', accent: '#f6a92e', word: 'rgb(var(--ink))', kru: 'rgb(var(--brand-link))', tag: 'rgb(var(--ink) / 0.72)' },
  // ธีมสี + พิมพ์เป็นสีเข้ม (ใช้บนใบรายงาน): ตอนพิมพ์ CSS ใน index.css ตั้ง --kru-word/--kru-kru ให้กลับเป็นสีเข้ม
  report: { cover: 'rgb(var(--brand-link))', cut: 'rgb(var(--card))', accent: '#f6a92e', word: 'var(--logo-word, rgb(var(--ink)))', kru: 'var(--logo-kru, rgb(var(--brand-link)))', tag: 'rgb(var(--ink) / 0.72)' },
  color: { cover: '#1b3366', cut: '#ffffff', accent: '#f6a92e', word: '#152851', kru: '#2b4f99', tag: '#5f6b84' },
  white: { cover: '#ffffff', cut: '#1b3366', accent: '#e8901a', word: '#ffffff', tag: '#dae4f5' },
  mono: { cover: 'currentColor', cut: '#ffffff', accent: '#ffffff', word: 'currentColor', tag: 'currentColor' },
};

export function LogoMark({ size = 40, tone = 'color', title = 'KruScan' }) {
  const t = TONES[tone] || TONES.color;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} focusable="false">
      <rect x="4" y="4" width="56" height="56" rx="14" style={{ fill: t.cover }} />
      <rect x="16" y="14" width="7" height="36" rx="2" style={{ fill: t.cut }} />
      <path d="M27 32L44 15" style={{ stroke: t.cut }} strokeWidth="7" strokeLinecap="round" />
      <path d="M29 36l7 7 13-14" style={{ fill: 'none', stroke: t.accent }} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Logo({ variant = 'horizontal', size = 40, tone = 'color', tagline = true, className = '' }) {
  if (variant === 'mark') return <span className={className}><LogoMark size={size} tone={tone} /></span>;
  const t = TONES[tone] || TONES.color;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} tone={tone} />
      <span className="flex flex-col leading-none">
        <span className="font-display tracking-wide" style={{ color: t.word, fontSize: size * 0.55 }}>
          <span className="font-bold" style={{ color: t.kru || t.word }}>Kru</span><span className="font-medium">Scan</span>
        </span>
        {tagline && (
          <span className="mt-1 font-display font-normal" style={{ color: t.tag, fontSize: Math.max(10, size * 0.26) }}>{logoTagline()}</span>
        )}
      </span>
    </span>
  );
}
