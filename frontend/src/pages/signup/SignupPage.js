import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, homePathFor } from '../../context/AuthContext';
import { groupsAPI, googleHref, errMsg } from './client';
import GoogleButton from './GoogleButton';
import AuthLayout, { Field, PasswordField, OrDivider, FormError, Spinner, primaryBtn, linkClass } from './AuthLayout';

const SignupPage = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [googleOn, setGoogleOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    groupsAPI.config().then((r) => setGoogleOn(!!r.data.google)).catch(() => setGoogleOn(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { data } = await groupsAPI.signup({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      const u = await loginWithToken(data.token);
      navigate(homePathFor(u), { replace: true });
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="สมัครใช้ฟรี" subtitle="ได้กลุ่มส่วนตัวทันที ชวนเพื่อนครูเข้าร่วมได้ภายหลัง">
      <GoogleButton href={googleHref} label="สมัครด้วย Google" enabled={googleOn} />
      <OrDivider />

      <form onSubmit={submit} className="space-y-5">
        <Field id="name" name="name" label="ชื่อที่แสดง" value={form.name} onChange={set('name')} required minLength={2} maxLength={80}
          autoComplete="name" placeholder="เช่น ครูสมศรี ใจดี" />
        <Field id="email" name="email" type="email" label="อีเมล" value={form.email} onChange={set('email')} required
          autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" />
        <PasswordField id="new-password" name="password" label="ตั้งรหัสผ่าน" value={form.password} onChange={set('password')}
          required minLength={8} autoComplete="new-password" showStrength hint="อย่างน้อย 8 ตัว" />
        <FormError message={error} />
        <button type="submit" className={primaryBtn} disabled={busy}>
          {busy && <Spinner />}{busy ? 'กำลังสร้างบัญชี...' : 'สร้างบัญชี'}
        </button>
        <p className="text-center text-xs leading-relaxed text-gray-500">
          เมื่อสมัคร ถือว่าคุณยอมรับ <a href="/privacy" className="rounded underline underline-offset-4 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">นโยบายความเป็นส่วนตัว</a>
        </p>
      </form>

      <div className="mt-7 space-y-2 border-t border-gray-100 pt-6 text-center text-[15px] text-gray-600">
        <p>มีบัญชีอยู่แล้ว? <Link to="/login" className={linkClass}>เข้าสู่ระบบ</Link></p>
        <p>มีรหัสจากเพื่อนครู? <Link to="/join" className={linkClass}>เข้าร่วมกลุ่มด้วยรหัส</Link></p>
      </div>
    </AuthLayout>
  );
};

export default SignupPage;
