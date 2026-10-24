import React, { useEffect, useRef, useState } from 'react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ROLE_LABEL = { ADMIN: 'ผู้ดูแลระบบ', TEACHER: 'ครู', STUDENT: 'นักเรียน' };
const inputCls = 'block w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-20 text-base shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500';

function strengthOf(pw) {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-zA-Zก-๙]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9ก-๙]/.test(pw) || (/[a-z]/.test(pw) && /[A-Z]/.test(pw))) s++;
  if (pw.length < 8) return { label: 'สั้นเกินไป', cls: 'bg-red-500', w: '20%', text: 'text-red-700' };
  if (s <= 1) return { label: 'อ่อน', cls: 'bg-orange-500', w: '40%', text: 'text-orange-700' };
  if (s === 2) return { label: 'พอใช้', cls: 'bg-yellow-500', w: '65%', text: 'text-yellow-800' };
  return { label: 'ดี', cls: 'bg-green-600', w: '100%', text: 'text-green-700' };
}

function PasswordField({ id, label, value, onChange, show, onToggle, autoComplete }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete} className={inputCls} />
        <button type="button" onClick={onToggle} aria-pressed={show} aria-label={show ? `ซ่อน${label}` : `แสดง${label}`}
          className="absolute inset-y-0 right-0 min-w-[64px] px-3 text-sm text-brand-700 hover:text-brand-900">
          {show ? 'ซ่อน' : 'แสดง'}
        </button>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user: authUser } = useAuth();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  useEffect(() => {
    authAPI.me().then(r => setMe(r.data)).catch(() => setMe(null));
    return () => clearTimeout(toastTimer.current);
  }, []);

  const u = me || authUser || {};
  const role = u.role;
  const code = u.teacher?.teacherCode || u.student?.studentCode || (role === 'ADMIN' ? 'admin' : '');
  const name = u.name || u.teacher?.name || u.student?.name || (role === 'ADMIN' ? 'ผู้ดูแลระบบ' : u.email);
  const subjects = u.teacher?.subjects || [];
  const homeClass = u.teacher?.homeClass || [];
  const sClass = u.student?.class;
  const strength = strengthOf(form.next);

  const set = (k) => (v) => { setForm(f => ({ ...f, [k]: v })); setError(''); };
  const toggle = (k) => () => setShow(s => ({ ...s, [k]: !s[k] }));

  const validate = () => {
    if (!form.current) return 'กรุณากรอกรหัสผ่านปัจจุบัน';
    if (form.next.length < 8) return 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร';
    if (code && form.next.toLowerCase() === code.toLowerCase()) return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผู้ใช้';
    if (form.next === form.current) return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน';
    if (form.next !== form.confirm) return 'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: form.current, newPassword: form.next });
      setForm({ current: '', next: '', confirm: '' });
      setShow({ current: false, next: false, confirm: false });
      clearTimeout(toastTimer.current);
      setToast('เปลี่ยนรหัสผ่านสำเร็จ ครั้งหน้าเข้าสู่ระบบด้วยรหัสใหม่');
      toastTimer.current = setTimeout(() => setToast(''), 3500);
    } catch (err) {
      setError(err.response?.data?.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์ของฉัน</h1>

      <section aria-labelledby="pf-info" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200 sm:p-6">
        <h2 id="pf-info" className="sr-only">ข้อมูลบัญชี</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-800" aria-hidden="true">
            {(name || '?').trim().charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words text-lg font-semibold text-gray-900">{name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              {role && <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-brand-100">{ROLE_LABEL[role] || role}</span>}
              {code && <span>รหัสผู้ใช้ <span className="font-mono text-gray-800">{code}</span></span>}
            </div>
          </div>
        </div>
        {(sClass || subjects.length > 0 || homeClass.length > 0) && (
          <dl className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
            {sClass && (
              <div><dt className="text-gray-500">ห้องเรียน</dt><dd className="font-medium text-gray-900">{sClass.grade?.gradeName ? `${sClass.grade.gradeName} · ` : ''}{sClass.className}</dd></div>
            )}
            {homeClass.length > 0 && (
              <div><dt className="text-gray-500">ครูประจำชั้น</dt><dd className="font-medium text-gray-900">{homeClass.map(c => c.className).join(', ')}</dd></div>
            )}
            {subjects.length > 0 && (
              <div className="sm:col-span-2">
                <dt className="text-gray-500">วิชาที่สอน ({subjects.length})</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {subjects.map(s => <span key={s.id} className="rounded-md bg-gray-100 px-2 py-0.5 text-gray-800">{s.subjectName}</span>)}
                </dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {role === 'ADMIN' ? (
        <section aria-labelledby="pf-admin" className="rounded-xl bg-brand-50 p-4 ring-1 ring-brand-100 sm:p-6">
          <h2 id="pf-admin" className="text-lg font-semibold text-brand-900">รหัสผ่านผู้ดูแลระบบ</h2>
          <p className="mt-2 text-base leading-relaxed text-ink-800">
            รหัสผ่านของบัญชีผู้ดูแลระบบตั้งไว้ที่เซิร์ฟเวอร์ (ค่า <code className="rounded bg-white px-1 text-sm">ADMIN_PASSWORD_HASH</code>) จึงเปลี่ยนจากหน้านี้ไม่ได้
            ถ้าต้องการเปลี่ยน ให้ผู้ดูแลเซิร์ฟเวอร์สร้างค่า bcrypt ใหม่ ตั้งค่าในเซิร์ฟเวอร์ แล้วเริ่มระบบใหม่
          </p>
        </section>
      ) : (
        <section aria-labelledby="pf-pw" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-ink-200 sm:p-6">
          <h2 id="pf-pw" className="text-lg font-semibold text-gray-900">เปลี่ยนรหัสผ่าน</h2>
          <p className="mt-1 text-sm text-gray-600">ครั้งแรกรหัสผ่านคือรหัสผู้ใช้ ควรเปลี่ยนเป็นรหัสใหม่อย่างน้อย 8 ตัวอักษร</p>
          <form onSubmit={submit} noValidate className="mt-4 space-y-4">
            <PasswordField id="pw-current" label="รหัสผ่านปัจจุบัน" value={form.current} onChange={set('current')} show={show.current} onToggle={toggle('current')} autoComplete="current-password" />
            <div>
              <PasswordField id="pw-new" label="รหัสผ่านใหม่" value={form.next} onChange={set('next')} show={show.next} onToggle={toggle('next')} autoComplete="new-password" />
              {strength ? (
                <div className="mt-2" aria-live="polite">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200"><div className={`h-full ${strength.cls}`} style={{ width: strength.w }} /></div>
                  <p className={`mt-1 text-xs ${strength.text}`}>ความแข็งแรง: {strength.label}</p>
                </div>
              ) : (
                <p className="mt-1 text-xs text-gray-500">อย่างน้อย 8 ตัวอักษร ผสมตัวอักษรกับตัวเลขจะปลอดภัยกว่า</p>
              )}
            </div>
            <PasswordField id="pw-confirm" label="ยืนยันรหัสผ่านใหม่" value={form.confirm} onChange={set('confirm')} show={show.confirm} onToggle={toggle('confirm')} autoComplete="new-password" />
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>}
            <button type="submit" disabled={saving}
              className="min-h-[48px] w-full rounded-lg bg-brand-600 px-4 font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 sm:w-auto">
              {saving ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>
        </section>
      )}

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg lg:bottom-6">
          {toast}
        </div>
      )}
    </div>
  );
}
