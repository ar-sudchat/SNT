import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui';

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-2xl">
        <div>
          <h1 className="text-center text-3xl font-bold text-blue-600">
            SNT System
          </h1>
          <h2 className="mt-2 text-center text-lg text-gray-600">
            ระบบติดตามสมุดนักเรียน
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Student Notebook Tracking via QR Code
          </p>
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="กรอกรหัสผ่าน"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <p className="text-xs text-gray-600 font-medium mb-2">วิธีเข้าสู่ระบบ:</p>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• <strong>ครู:</strong> user: รหัสครู, pass: รหัสผ่าน (ครั้งแรกใช้รหัสครู)</li>
            <li>• <strong>นักเรียน:</strong> user: รหัสนักเรียน, pass: รหัสนักเรียน</li>
          </ul>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Version 1.0.0</p>
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
