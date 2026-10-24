import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homePathFor } from '../context/AuthContext';
import { groupsAPI, googleHref } from './signup/client';
import GoogleButton from './signup/GoogleButton';
import AuthLayout, { Field, PasswordField, OrDivider, FormError, Spinner, primaryBtn, linkClass, footerLinkClass } from './signup/AuthLayout';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [admin, setAdmin] = useState(false); // username login for the system admin
  const [googleOn, setGoogleOn] = useState(false);
  const [error, setError] = useState(null);
  const { login, loginWithEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    groupsAPI.config().then(r => setGoogleOn(!!r.data.google)).catch(() => setGoogleOn(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = admin ? await login(username.trim(), password) : await loginWithEmail(username.trim(), password);
      const from = location.state?.from;
      navigate(from && from.startsWith('/') ? from : homePathFor(user), { replace: true });
    } catch (err) {
      setError({ title: 'เข้าสู่ระบบไม่สำเร็จ', message: err.response?.data?.error || 'กรุณาตรวจสอบอีเมลและรหัสผ่าน' });
      setLoading(false);
    }
  };

  const toggleAdmin = () => { setAdmin(a => !a); setUsername(''); setPassword(''); setError(null); };

  return (
    <AuthLayout
      title={admin ? 'เข้าสู่ระบบด้วยชื่อผู้ใช้' : 'เข้าสู่ระบบ'}
      subtitle={admin ? 'สำหรับผู้ดูแลระบบ หรือบัญชีที่ผู้ดูแลสร้างให้' : 'ยินดีต้อนรับกลับ ดูได้เลยว่าวันนี้ใครส่งงานแล้ว'}
      footer={(
        <button type="button" onClick={toggleAdmin} className={footerLinkClass}>
          {admin ? 'กลับไปเข้าสู่ระบบด้วยอีเมล' : 'เข้าสู่ระบบผู้ดูแลระบบ'}
        </button>
      )}
    >
      {!admin && (
        <>
          <GoogleButton href={googleHref} label="เข้าสู่ระบบด้วย Google" enabled={googleOn} />
          <OrDivider />
        </>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <Field id="username" name="username" label={admin ? 'ชื่อผู้ใช้' : 'อีเมล'}
          type={admin ? 'text' : 'email'} autoComplete={admin ? 'username' : 'email'} autoCapitalize="none" spellCheck={false} required
          inputMode={admin ? 'text' : 'email'} value={username} onChange={(e) => setUsername(e.target.value)} placeholder={admin ? 'admin' : 'you@example.com'} />
        <PasswordField id="password" name="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError title={error?.title} message={error?.message} />
        <button type="submit" disabled={loading} className={primaryBtn}>
          {loading && <Spinner />}{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>

      {!admin && (
        <div className="mt-7 space-y-2 border-t border-gray-100 pt-6 text-center text-[15px] text-gray-600">
          <p>ยังไม่มีบัญชี? <Link to="/signup" className={linkClass}>สมัครใช้ฟรี</Link></p>
          <p>มีรหัสจากเพื่อนครู? <Link to="/join" className={linkClass}>เข้าร่วมกลุ่มด้วยรหัส</Link></p>
        </div>
      )}
    </AuthLayout>
  );
};

export default Login;
