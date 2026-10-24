import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, homePathFor } from '../context/AuthContext';

const ERRORS = {
  cancelled: 'ยกเลิกการเข้าสู่ระบบด้วย Google',
  state: 'ลิงก์เข้าสู่ระบบหมดอายุ กรุณาลองใหม่',
  conflict: 'อีเมลนี้ผูกกับบัญชี Google อื่นแล้ว',
  link_required: 'อีเมลนี้มีบัญชีที่ใช้รหัสผ่านอยู่แล้ว กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน',
  google: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ',
};

// Landing page for /auth/callback#token=... (Google sign-in). Token stays in the fragment, never sent to a server log.
const AuthCallback = () => {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    window.history.replaceState(null, '', window.location.pathname);
    const token = params.get('token');
    if (!token) { setError(ERRORS[params.get('error')] || ERRORS.google); return; }
    loginWithToken(token)
      .then((u) => navigate(homePathFor(u), { replace: true }))
      .catch(() => setError(ERRORS.google));
  }, [loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundImage: 'linear-gradient(to bottom right, rgb(var(--login-from)), rgb(var(--login-to)))' }}>
      <div className="max-w-sm w-full bg-white rounded-xl shadow-2xl p-6 text-center space-y-4">
        {error ? (
          <>
            <p className="text-gray-800">{error}</p>
            <a href="/login" className="inline-block py-2 px-4 rounded-lg text-white bg-brand-600 hover:bg-brand-700">กลับไปหน้าเข้าสู่ระบบ</a>
          </>
        ) : (
          <p className="text-gray-700">กำลังเข้าสู่ระบบ…</p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
