import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import QRScanner from './pages/teacher/QRScanner';
import SubjectSummary from './pages/teacher/SubjectSummary';
import StudentSummary from './pages/teacher/StudentSummary';
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
import { StudentMonitor, ClassMonitor, SubjectMonitor } from './pages/monitor';
import Layout from './components/Layout';

// Protected Route Component
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
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
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
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
                  <SubjectSummary />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/student/:id"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <StudentSummary />
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

            {/* Admin Routes - accessible by ADMIN and TEACHER */}
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
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ManageAcademicYears />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/grades"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ManageGrades />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/classes"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ManageClasses />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/students"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ManageStudents />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/teachers"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ManageTeachers />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/subjects"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ManageSubjects />
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
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <QRCodeGenerator />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/import"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <DataImport />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/transfer"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ClassTransfer />
                </ProtectedRoute>
              }
            />

            {/* Monitor Routes */}
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
                  <ClassMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="monitor/subject"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <SubjectMonitor />
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
