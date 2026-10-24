import React, { useState } from 'react';
import Logo from '../components/brand/Logo';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui';
import { SchoolLogin, DotPattern } from '../components/illustrations';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: 'info', title: '', message: '' });
  const { login } = useAuth();
  const navigate = useNavigate();

  const showAlert = (type, title, message) => {
    setAlert({ show: true, type, title, message });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(username, password);

      // Show success message briefly then redirect
      showAlert('success', 'เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${user.teacher?.name || user.student?.name || 'Admin'}`);

      // Redirect after showing success message
      setTimeout(() => {
        if (user.role === 'ADMIN') {
          navigate('/admin');
        } else if (user.role === 'TEACHER') {
          navigate('/teacher');
        } else {
          navigate('/student');
        }
      }, 1000);
    } catch (err) {
      showAlert('danger', 'เข้าสู่ระบบไม่สำเร็จ', err.response?.data?.error || 'กรุณาตรวจสอบรหัสผู้ใช้และรหัสผ่าน');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundImage: 'linear-gradient(to bottom right, rgb(var(--login-from)), rgb(var(--login-to)))' }} className="relative min-h-screen flex flex-col lg:flex-row items-center justify-center lg:gap-16 py-8 sm:py-12 px-0 sm:px-6 lg:px-8 overflow-hidden">
      <DotPattern />
      <div className="relative mb-4 lg:mb-0 flex flex-col items-center text-white">
        <SchoolLogin className="h-28 sm:h-36 lg:h-60 w-auto text-white" />
        <p className="hidden lg:block mt-4 text-white/85 text-lg">สแกนสมุด รู้ทันทีว่าใครส่งงานแล้ว</p>
      </div>
      <div className="relative max-w-md w-full space-y-8 bg-white p-6 sm:p-8 mx-4 sm:mx-0 rounded-xl shadow-2xl">
        <div>
          <h1 className="flex justify-center"><Logo size={56} tone="theme" /><span className="sr-only">KruScan ครูสแกน — สแกนสมุด รู้ทันทีใครส่งงานแล้ว</span></h1>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                รหัสผู้ใช้
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="รหัสครู, รหัสนักเรียน หรือ admin"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                รหัสผ่าน
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                placeholder="กรอกรหัสผ่าน"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'เข้าสู่ระบบ'
            )}
          </button>
        </form>

        {/* Login hints */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">ลืมรหัสผ่าน แจ้งผู้ดูแลระบบ · <a href="/privacy" className="underline">ความเป็นส่วนตัว</a> · <a href="/guide/" target="_blank" rel="noopener noreferrer" className="underline">คู่มือการใช้งาน</a></p>
        </div>
      </div>

      {/* Alert Dialog */}
      <ConfirmDialog
        isOpen={alert.show}
        onClose={() => setAlert({ ...alert, show: false })}
        title={alert.title}
        message={alert.message}
        confirmText="ตกลง"
        type={alert.type}
        mode="alert"
      />
    </div>
  );
};

export default Login;
