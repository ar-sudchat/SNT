import { t, dateLocale, tx } from '../i18n';
import React, { useEffect, useRef, useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Avatar, { PRESETS, PresetArt, displayNameOf } from '../components/Avatar';

const ROLE_LABEL = { ADMIN: 'ผู้ดูแลระบบ', TEACHER: 'ครู', STUDENT: 'นักเรียน' };
const inputCls = 'block w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-20 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500';
const fieldCls = 'block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500';
const btn2 = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-4 text-sm font-medium text-ink-700 hover:bg-ink-50';

// สีแบนเนอร์ — key ต้องตรงกับ ACCENTS ใน backend/services/profile.js
const ACCENTS = [
  { key: 'brand', label: 'น้ำเงินหมึก', from: '#0c1833', to: '#2f5fc4' },
  { key: 'sky', label: 'ฟ้าใส', from: '#0b4a6f', to: '#1d9bd1' },
  { key: 'violet', label: 'ม่วงลาเวนเดอร์', from: '#3b1c78', to: '#7c4ddb' },
  { key: 'rose', label: 'ชมพูกุหลาบ', from: '#7a1838', to: '#d94a72' },
  { key: 'amber', label: 'ส้มดาวเรือง', from: '#7a3a06', to: '#e08a12' },
  { key: 'emerald', label: 'เขียวมรกต', from: '#064e3b', to: '#14a37a' },
];
const accentOf = (k) => ACCENTS.find(a => a.key === k) || ACCENTS[0];

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target == null) return undefined;
    if (reducedMotion() || !target) { setV(target); return undefined; }
    let raf; const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function StatCard({ label, value, hint, icon }) {
  const n = useCountUp(value);
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-ink-200 sm:p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-gray-600 sm:text-sm">
        <span aria-hidden="true" className="text-base">{icon}</span>{t(label)}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 sm:text-3xl" aria-label={`${t(label)} ${value ?? 0}`}>{value == null ? '–' : n.toLocaleString(dateLocale())}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

function statsFor(role, s) {
  if (!s) return [];
  if (role === 'TEACHER') return [
    { label: 'สแกนตรวจแล้ว', value: s.reviewed, icon: '📷', hint: t('สัปดาห์นี้ {value1} งาน', { value1: s.reviewedWeek }) },
    { label: 'สแกนติดกัน', value: s.streak, icon: '🔥', hint: t('วัน') },
    { label: 'วิชาที่สอน', value: s.subjects, icon: '📚' },
    { label: 'นักเรียน', value: s.students, icon: '🧑‍🎓', hint: t('ที่มีงานในวิชาของคุณ') },
  ];
  if (role === 'STUDENT') return [
    { label: 'ส่งงานแล้ว', value: s.submitted, icon: '📝' },
    { label: 'ผ่านแล้ว', value: s.approved, icon: '✅' },
    { label: 'ส่งตรงเวลา', value: s.onTime, icon: '⏰' },
    { label: 'ตรงเวลาติดกัน', value: s.onTimeStreak, icon: '🔥', hint: t('งานล่าสุด') },
  ];
  return [
    { label: 'ครู', value: s.teachers, icon: '👩‍🏫' },
    { label: 'นักเรียน', value: s.students, icon: '🧑‍🎓' },
    { label: 'วิชาที่เปิด', value: s.subjects, icon: '📚' },
    { label: 'งานที่ผ่าน', value: s.approved, icon: '✅', hint: t('ทั้งกลุ่ม') },
  ];
}

function badgesFor(role, s, u) {
  if (!s) return [];
  const profileDone = (u.avatar || u.avatarPreset ? 1 : 0) + (u.bio ? 1 : 0) + (u.displayName ? 1 : 0);
  const common = [
    { icon: '🎨', name: 'แต่งโปรไฟล์ครบ', desc: t('ตั้งรูป ชื่อที่แสดง และคำแนะนำตัว'), cur: profileDone, goal: 3 },
    { icon: '🤖', name: role === 'STUDENT' ? 'นักเรียนสายเทค' : 'ครูสายเทค', desc: t('คุยกับผู้ช่วย AI'), cur: s.aiChats, goal: 1 },
  ];
  if (role === 'TEACHER') return [
    { icon: '✋', name: 'สแกนแรก', desc: t('ตรวจงานด้วยการสแกนครั้งแรก'), cur: s.reviewed, goal: 1 },
    { icon: '🏅', name: 'นักสแกนมือทอง', desc: t('สแกนตรวจครบ 100 งาน'), cur: s.reviewed, goal: 100 },
    { icon: '🚀', name: 'ขยันสุดสัปดาห์', desc: t('สแกน 50 งานใน 7 วัน'), cur: s.reviewedWeek, goal: 50 },
    { icon: '🔥', name: 'ไฟไม่มอด', desc: t('สแกนติดกัน 5 วัน'), cur: s.streak, goal: 5 },
    { icon: '🧭', name: 'ครูหลายวิชา', desc: t('สอน 3 วิชาขึ้นไป'), cur: s.subjects, goal: 3 },
    ...common,
  ];
  if (role === 'STUDENT') return [
    { icon: '📝', name: 'ส่งงานแรก', desc: t('ส่งงานชิ้นแรก'), cur: s.submitted, goal: 1 },
    { icon: '⏰', name: 'ตรงต่อเวลา', desc: t('ส่งตรงเวลาติดกัน 5 งาน'), cur: s.onTimeStreak, goal: 5 },
    { icon: '🌟', name: 'ผ่านฉลุย', desc: t('ผ่าน 20 งาน'), cur: s.approved, goal: 20 },
    ...common,
  ];
  return [
    { icon: '🏫', name: 'กลุ่มพร้อม', desc: t('มีครูในระบบ 5 คน'), cur: s.teachers, goal: 5 },
    { icon: '👥', name: 'ห้องเต็ม', desc: t('มีนักเรียน 100 คน'), cur: s.students, goal: 100 },
    { icon: '🏆', name: 'ล้านงานเริ่มที่หนึ่งพัน', desc: t('งานผ่าน 1,000 งาน'), cur: s.approved, goal: 1000 },
    ...common,
  ];
}

function Badge({ b }) {
  const done = (b.cur || 0) >= b.goal;
  const pct = Math.min(100, Math.round(((b.cur || 0) / b.goal) * 100));
  return (
    <li className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${done ? 'bg-brand-50 ring-brand-100' : 'bg-white ring-black/10'}`}>
      <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl ${done ? 'bg-white shadow-sm' : 'bg-gray-100 opacity-60 grayscale'}`}>{b.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          {t(b.name)}{done ? <span className="rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-fg">{t('ได้แล้ว')}</span> : <span className="sr-only">{t('(ยังไม่ได้)')}</span>}
        </p>
        <p className="text-xs text-gray-600">{b.desc}</p>
        {!done && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t('ความคืบหน้า {value1}', { value1: t(b.name) })}>
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] tabular-nums text-gray-500">{Math.min(b.cur || 0, b.goal)}/{b.goal}</span>
          </div>
        )}
      </div>
    </li>
  );
}

// ครอปกลางเป็นสี่เหลี่ยมจัตุรัส 256px แล้วบีบเป็น webp (หรือ jpeg ถ้าเบราว์เซอร์ไม่รองรับ)
function fileToAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error(t('กรุณาเลือกไฟล์รูปภาพ'))); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas'); c.width = 256; c.height = 256;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/webp', 0.85);
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.85);
      if (out.length > 190000) out = c.toDataURL('image/jpeg', 0.6);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(t('เปิดรูปนี้ไม่ได้ ลองรูปอื่น'))); };
    img.src = url;
  });
}

function AvatarSheet({ user, onClose, onSave, busy }) {
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try { setErr(''); onSave({ avatar: await fileToAvatar(f) }); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel rounded-b-none p-4 sm:rounded-lg sm:p-5" role="dialog" aria-modal="true" aria-labelledby="av-title"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between">
          <h2 id="av-title" className="text-lg font-semibold text-gray-900">{t('เปลี่ยนรูปโปรไฟล์')}</h2>
          <button type="button" onClick={onClose} className="min-h-[44px] px-3 text-sm text-gray-600">{t('ปิด')}</button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={btn2}>{t('🖼️ อัปโหลดรูป')}</button>
          <button type="button" disabled={busy} onClick={() => camRef.current?.click()} className={btn2}>{t('📸 ถ่ายรูป')}</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} data-testid="avatar-file" />
          <input ref={camRef} type="file" accept="image/*" capture="user" className="hidden" onChange={pick} />
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('ระบบครอปเป็นสี่เหลี่ยมและย่อให้เล็กอัตโนมัติ')}</p>
        {err && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <h3 className="mt-4 text-sm font-semibold text-gray-800">{t('หรือเลือกตัวการ์ตูน')}</h3>
        <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {PRESETS.map(p => {
            const on = !user.avatar && user.avatarPreset === p.key;
            return (
              <li key={p.key}>
                <button type="button" disabled={busy} title={t(p.label)} aria-label={t(p.label)} aria-pressed={on}
                  onClick={() => onSave({ avatarPreset: p.key })}
                  className={`block aspect-square w-full overflow-hidden rounded-full ring-2 transition-transform hover:scale-105 motion-reduce:transition-none motion-reduce:hover:scale-100 ${on ? 'ring-brand-600 ring-offset-2' : 'ring-transparent'}`}>
                  <PresetArt preset={p} className="h-full w-full" />
                </button>
              </li>
            );
          })}
        </ul>
        {(user.avatar || user.avatarPreset) && (
          <button type="button" disabled={busy} onClick={() => onSave({ avatar: null, avatarPreset: null })}
            className="mt-4 min-h-[44px] w-full rounded-lg text-sm font-medium text-red-700 hover:bg-red-50">{t('ลบรูป ใช้อักษรย่อแทน')}</button>
        )}
      </div>
    </div>
  );
}

function strengthOf(pw) {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-zA-Zก-๙]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9ก-๙]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++;
  if (pw.length < 8) return { label: t('สั้นเกินไป'), cls: 'bg-red-500', w: '20%', text: 'text-red-700' };
  if (s <= 1) return { label: t('อ่อน'), cls: 'bg-orange-500', w: '40%', text: 'text-orange-700' };
  if (s === 2) return { label: t('พอใช้'), cls: 'bg-yellow-500', w: '65%', text: 'text-yellow-800' };
  return { label: t('ดี'), cls: 'bg-green-600', w: '100%', text: 'text-green-700' };
}

function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete} className={inputCls} />
        <button type="button" onClick={onToggle} aria-pressed={show} aria-label={show ? t('ซ่อน{label}', { label: label }) : t('แสดง{label}', { label: label })}
          className="absolute inset-y-0 right-0 min-w-[64px] px-3 text-sm text-brand-700 hover:text-brand-900">
          {show ? t('ซ่อน') : t('แสดง')}
        </button>
      </div>
    </div>
  );
}

function PasswordCard({ code, isAdmin, notify }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const strength = strengthOf(form.next);
  const set = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };
  const toggle = (k) => () => setShow(s => ({ ...s, [k]: !s[k] }));
  const validate = () => {
    if (form.next.length < 8) return t('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
    if (code && form.next.toLowerCase() === code.toLowerCase()) return t('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผู้ใช้');
    if (form.next !== form.confirm) return t('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
    return '';
  };
  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ newPassword: form.next });
      setForm({ current: '', next: '', confirm: '' });
      setShow({ current: false, next: false, confirm: false });
      notify(t('เปลี่ยนรหัสผ่านสำเร็จ ครั้งหน้าเข้าสู่ระบบด้วยรหัสใหม่'));
    } catch (err) {
      setError(err.response?.data?.error || t('เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section aria-labelledby="pf-pw" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200 sm:p-6">
      <h2 id="pf-pw" className="flex items-center gap-2 text-lg font-semibold text-gray-900"><span aria-hidden="true">🔒</span>{t('เปลี่ยนรหัสผ่าน')}</h2>
      <p className="mt-1 text-sm text-gray-600">
        {isAdmin ? t('เปลี่ยนแล้ว รหัสเดิมที่ตั้งไว้ที่เซิร์ฟเวอร์จะใช้ไม่ได้อีก') : t('ครั้งแรกรหัสผ่านคือรหัสผู้ใช้ ควรเปลี่ยนเป็นรหัสใหม่อย่างน้อย 8 ตัวอักษร')}
      </p>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <div>
          <PasswordField id="pw-new" label={t("รหัสผ่านใหม่")} value={form.next} onChange={set('next')} show={show.next} onToggle={toggle('next')} autoComplete="new-password" />
          {strength ? (
            <div className="mt-2" aria-live="polite">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"><div className={`h-full ${strength.cls}`} style={{ width: strength.w }} /></div>
              <p className={`mt-1 text-xs ${strength.text}`}>{t('ความแข็งแรง: {value1}', { value1: strength.label })}</p>
            </div>
          ) : (
            <p className="mt-1 text-xs text-gray-500">{t('อย่างน้อย 8 ตัวอักษร ผสมตัวอักษรกับตัวเลขจะปลอดภัยกว่า')}</p>
          )}
        </div>
        <PasswordField id="pw-confirm" label={t("ยืนยันรหัสผ่านใหม่")} value={form.confirm} onChange={set('confirm')} show={show.confirm} onToggle={toggle('confirm')} autoComplete="new-password" />
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
        <button type="submit" disabled={saving}
          className="min-h-[48px] w-full rounded-lg bg-brand-600 px-4 font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 sm:w-auto">
          {saving ? t('กำลังบันทึก…') : t('บันทึกรหัสผ่านใหม่')}
        </button>
      </form>
      {isAdmin && (
        <details className="mt-4 border-t border-gray-100 pt-3">
          <summary className="cursor-pointer select-none text-sm text-gray-600">{t('ถ้าลืมรหัส ผู้ดูแลเซิร์ฟเวอร์รีเซ็ตได้')}</summary>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">{tx('ให้ผู้ดูแลเซิร์ฟเวอร์ตั้งค่า {reset} แล้วเริ่มระบบใหม่ เข้าสู่ระบบด้วยรหัสใน {hash} เปลี่ยนรหัสที่หน้านี้ แล้วลบค่ารีเซ็ตออก', {
            reset: <code className="rounded bg-gray-100 px-1 text-xs">ADMIN_PASSWORD_RESET=true</code>,
            hash: <code className="rounded bg-gray-100 px-1 text-xs">ADMIN_PASSWORD_HASH</code>,
          })}</p>
        </details>
      )}
    </section>
  );
}

export default function Profile() {
  const { user: authUser, updateUser } = useAuth();
  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ displayName: '', bio: '' });
  const [busy, setBusy] = useState(false);
  const [editErr, setEditErr] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => {
    authAPI.me().then(r => setMe(r.data)).catch(() => setMe(null));
    authAPI.profileStats().then(r => setStats(r.data)).catch(() => setStats(null));
    return () => clearTimeout(toastTimer.current);
  }, []);

  const notify = (m) => { clearTimeout(toastTimer.current); setToast(m); toastTimer.current = setTimeout(() => setToast(''), 3000); };
  const u = me || authUser || {};
  const role = u.role;
  const isAdmin = role === 'ADMIN';
  const code = u.teacher?.teacherCode || u.student?.studentCode || (isAdmin ? 'admin' : '');
  const name = displayNameOf(u);
  const realName = u.teacher?.name || u.student?.name || (isAdmin ? 'ผู้ดูแลระบบ' : '');
  const realNameLabel = u.teacher?.name || u.student?.name || (isAdmin ? t('ผู้ดูแลระบบ') : '');
  const subjects = u.teacher?.subjects || [];
  const homeClass = u.teacher?.homeClass || [];
  const sClass = u.student?.class;
  const accent = accentOf(u.accent);

  const save = async (patch, okMsg = t('บันทึกแล้ว')) => {
    setBusy(true);
    try {
      const r = await authAPI.updateProfile(patch);
      setMe(m => ({ ...(m || u), ...r.data }));
      updateUser && updateUser(r.data);
      notify(okMsg);
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || t('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง');
      notify(msg);
      setEditErr(msg);
      return false;
    } finally { setBusy(false); }
  };

  const startEdit = () => { setDraft({ displayName: u.displayName || '', bio: u.bio || '' }); setEditErr(''); setEditing(true); };
  const saveEdit = async (e) => {
    e.preventDefault();
    if (await save({ displayName: draft.displayName, bio: draft.bio }, t('บันทึกชื่อและคำแนะนำตัวแล้ว'))) setEditing(false);
  };

  const cards = statsFor(role, stats);
  const badges = badgesFor(role, stats, u);
  const earned = badges.filter(b => (b.cur || 0) >= b.goal).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="sr-only">{t('โปรไฟล์ของฉัน')}</h1>

      {/* Hero */}
      <section aria-label={t("ข้อมูลโปรไฟล์")} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200">
        <div className="relative h-28 sm:h-36" style={{ background: `linear-gradient(120deg, ${accent.from}, ${accent.to})` }} data-testid="profile-banner">
          <svg className="absolute inset-0 h-full w-full opacity-[0.18]" aria-hidden="true">
            <defs>
              <pattern id="pf-pat" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
                <rect x="3" y="3" width="8" height="8" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.5" />
                <circle cx="21" cy="19" r="2" fill="#fff" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pf-pat)" />
          </svg>
          <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">{ROLE_LABEL[role] ? t(ROLE_LABEL[role]) : ''}</span>
        </div>
        <div className="px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="-mt-12 flex items-end gap-3 sm:-mt-14">
            <div className="relative">
              <Avatar user={u} size={104} ring="ring-4 ring-white shadow-md" className="bg-white" />
              <button type="button" onClick={() => setSheet(true)} aria-label={t("เปลี่ยนรูปโปรไฟล์")}
                className="absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-fg shadow-md ring-4 ring-white hover:brightness-110">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.5" /></svg>
              </button>
            </div>
          </div>

          {!editing ? (
            <div className="mt-3 flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="break-words text-xl font-bold text-gray-900 sm:text-2xl">{name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-gray-600">
                  {u.displayName && realName && u.displayName !== realName && <span>{realNameLabel}</span>}
                  {code && <span>{t('รหัสผู้ใช้ ')}<span className="font-mono text-gray-800">{code}</span></span>}
                </p>
                <p className={`mt-2 break-words text-base ${u.bio ? 'text-gray-800' : 'italic text-gray-500'}`}>{u.bio || t('ยังไม่มีคำแนะนำตัว เขียนอะไรสนุกๆ สักประโยคสิ')}</p>
              </div>
              <button type="button" onClick={startEdit} className={btn2}>{t('✏️ แก้ไข')}</button>
            </div>
          ) : (
            <form onSubmit={saveEdit} className="mt-3 space-y-3" noValidate>
              <div>
                <label htmlFor="pf-dn" className="mb-1 block text-sm font-medium text-gray-700">{t('ชื่อที่แสดง')}</label>
                <input id="pf-dn" className={fieldCls} maxLength={40} value={draft.displayName} placeholder={realNameLabel}
                  onChange={e => setDraft(d => ({ ...d, displayName: e.target.value }))} />
                <p className="mt-1 text-xs text-gray-500">{t('เว้นว่างเพื่อใช้ชื่อจริง')}</p>
              </div>
              <div>
                <label htmlFor="pf-bio" className="mb-1 block text-sm font-medium text-gray-700">{t('คำแนะนำตัว')}</label>
                <textarea id="pf-bio" rows={2} className={fieldCls} maxLength={120} value={draft.bio} placeholder={t("เช่น ครูคณิตที่ชอบกาแฟและแมว")}
                  onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))} />
                <p className="mt-1 text-right text-xs tabular-nums text-gray-500">{draft.bio.length}/120</p>
              </div>
              {editErr && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{editErr}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="min-h-[44px] flex-1 rounded-lg bg-brand-600 px-4 font-medium text-white hover:bg-brand-700 disabled:opacity-50 sm:flex-none">{t('บันทึก')}</button>
                <button type="button" onClick={() => setEditing(false)} className={btn2}>{t('ยกเลิก')}</button>
              </div>
            </form>
          )}

          <fieldset className="mt-4 border-t border-gray-100 pt-3">
            <legend className="sr-only">{t('สีแบนเนอร์')}</legend>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 w-full text-sm text-gray-600 xs:w-auto">{t('สีแบนเนอร์')}</span>
              {ACCENTS.map(a => {
                const on = accent.key === a.key;
                return (
                  <button key={a.key} type="button" disabled={busy} onClick={() => !on && save({ accent: a.key }, t('เปลี่ยนเป็นสี{value1}แล้ว', { value1: t(a.label) }))}
                    aria-label={t(a.label)} aria-pressed={on} title={t(a.label)}
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${on ? 'ring-2 ring-gray-900 ring-offset-2' : ''}`}>
                    <span className="h-8 w-8 rounded-full shadow-inner" style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }} />
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </section>

      {/* Stats */}
      {cards.length > 0 && (
        <section aria-labelledby="pf-stats">
          <h2 id="pf-stats" className="mb-2 text-lg font-semibold text-gray-900">{isAdmin ? t('ภาพรวมกลุ่ม') : t('ผลงานของฉัน')}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {cards.map(c => <StatCard key={c.label} {...c} />)}
          </div>
        </section>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <section aria-labelledby="pf-badges">
          <h2 id="pf-badges" className="mb-2 flex items-baseline gap-2 text-lg font-semibold text-gray-900">{t('เหรียญรางวัล ')}<span className="text-sm font-normal text-gray-600">{t('ได้แล้ว {earned}/{value2}', { earned: earned, value2: badges.length })}</span>
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {badges.map(b => <Badge key={b.name} b={b} />)}
          </ul>
        </section>
      )}

      {/* Account details */}
      {(sClass || subjects.length > 0 || homeClass.length > 0) && (
        <section aria-labelledby="pf-info" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200 sm:p-6">
          <h2 id="pf-info" className="text-lg font-semibold text-gray-900">{t('ข้อมูลการสอน')}</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            {sClass && (
              <div><dt className="text-gray-500">{t('ห้องเรียน')}</dt><dd className="font-medium text-gray-900">{sClass.grade?.gradeName ? `${sClass.grade.gradeName} · ` : ''}{sClass.className}</dd></div>
            )}
            {homeClass.length > 0 && (
              <div><dt className="text-gray-500">{t('ครูประจำชั้น')}</dt><dd className="font-medium text-gray-900">{homeClass.map(c => c.className).join(', ')}</dd></div>
            )}
            {subjects.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500">{t('วิชาที่สอน ({value1})', { value1: subjects.length })}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {subjects.map(s => <span key={s.id} className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-800">{s.subjectName}</span>)}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <PasswordCard code={code} isAdmin={isAdmin} notify={notify} />

      {sheet && <AvatarSheet user={u} busy={busy} onClose={() => setSheet(false)} onSave={async (p) => { if (await save(p, t('เปลี่ยนรูปแล้ว'))) setSheet(false); }} />}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
