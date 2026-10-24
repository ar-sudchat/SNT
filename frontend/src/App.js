import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import QRScanner from './pages/teacher/QRScanner';
import StudentPortal from './pages/student/StudentPortal';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageAcademicYears from './pages/admin/ManageAcademicYears';
import ManageGrades from './pages/admin/ManageGrades';
import ManageClasses from './pages/admin/ManageClasses';
import ManageStudents from './pages/admin/ManageStudents';
import ManageTeachers from './pages/admin/ManageTeachers';
import ManageSubjects from './pages/admin/ManageSubjects';
import ManageTasks from './pages/admin/ManageTasks';
import QRCodeGenerator from './pages/admin/QRCodeGenerator';
import DataImport from './pages/admin/DataImport';
import ClassTransfer from './pages/admin/ClassTransfer';
import AIAssistant from './pages/ai/AIAssistant';
import ClassroomTools from './pages/tools/ClassroomTools';
import ParentView from './pages/parent/ParentView';
import PrivacyNotice from './pages/legal/PrivacyNotice';
import { StudentMonitor, MonitorPage, MonitorRedirect } from './pages/monitor';
import SettingsHub from './pages/admin/SettingsHub';
import Layout from './components/Layout';

// เส้นทางเก่า → หน้าติดตามใหม่
const LegacySubjectRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/monitor?mode=subject&subject=${id}`} replace />;
};
const LegacyStudentRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/monitor/student/${id}`} replace />;
};

// Protected Route Component
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    const home = user.role === 'ADMIN' ? '/admin' : user.role === 'TEACHER' ? '/teacher' : '/dashboard';
    return <Navigate to={home} replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          {/* ลิงก์ผู้ปกครอง: สาธารณะ ไม่ต้องล็อกอิน */}
          <Route path="/p/:token" element={<ParentView />} />
          <Route path="/privacy" element={<PrivacyNotice />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            {/* Teacher Routes */}
            <Route
              path="teacher"
              element={
                <ProtectedRoute roles={['TEACHER']}>
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/scan"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <QRScanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/subject/:id"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <LegacySubjectRedirect />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/student/:id"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <LegacyStudentRedirect />
                </ProtectedRoute>
              }
            />

            {/* Student Routes */}
            <Route
              path="student"
              element={
                <ProtectedRoute roles={['STUDENT']}>
                  <StudentPortal />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes - ADMIN only (except tasks / ai) */}
            <Route
              path="admin"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/academic-years"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ManageAcademicYears />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/grades"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ManageGrades />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/classes"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ManageClasses />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/students"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ManageStudents />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/teachers"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ManageTeachers />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/subjects"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ManageSubjects />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <AIAssistant />
                </ProtectedRoute>
              }
            />
            <Route
              path="tools"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ClassroomTools />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/tasks"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ManageTasks />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/qrcode"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <QRCodeGenerator />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/import"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <DataImport />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/transfer"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ClassTransfer />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/settings"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <SettingsHub />
                </ProtectedRoute>
              }
            />

            {/* Monitor Routes */}
            <Route
              path="monitor"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <MonitorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="monitor/student/:id"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <StudentMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="monitor/class/:id?"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <MonitorRedirect mode="class" />
                </ProtectedRoute>
              }
            />
            <Route
              path="monitor/subject"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <MonitorRedirect mode="subject" />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
