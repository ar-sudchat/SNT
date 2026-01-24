import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();

  // Redirect based on role
  if (user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  } else if (user?.role === 'TEACHER') {
    return <Navigate to="/teacher" replace />;
  } else if (user?.role === 'STUDENT') {
    return <Navigate to="/student" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          ยินดีต้อนรับสู่ระบบ SNT
        </h1>
        <p className="text-gray-600">
          ระบบติดตามสมุดนักเรียนผ่าน QR Code
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
