import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DialogProvider } from './components/ui/DialogProvider';
import { I18nProvider } from './i18n';

// Pages
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import QRScanner from './pages/teacher/QRScanner';
import ScanCheck from './pages/teacher/ScanCheck';
import AttendanceCheck from './pages/attendance/AttendanceCheck';
import DaySummary from './pages/attendance/DaySummary';
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
import SetupWizard from './pages/admin/SetupWizard';
import SignupPage from './pages/signup/SignupPage';
import InviteAccept from './pages/signup/InviteAccept';
import JoinGroup from './pages/groups/JoinGroup';
import PlanPage from './pages/admin/PlanPage';
import DataPrivacy from './pages/admin/DataPrivacy';
import Layout from './components/Layout';
import Profile from './pages/Profile';
import Landing from './pages/landing/Landing';
import { OpsTenants } from './pages/ops';
import GroupSettings from './pages/groups/GroupSettings';
import LessonLogHome from './pages/lessonlog/LessonLogHome';
import CreateRecord from './pages/lessonlog/CreateRecord';
import RecordPage from './pages/lessonlog/RecordPage';
import ExportPage from './pages/lessonlog/ExportPage';
import SummaryPage from './pages/lessonlog/SummaryPage';
import TemplatesPage from './pages/lessonlog/TemplatesPage';

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

  // เจ้าของ/ผู้ดูแลกลุ่ม (canManage) เข้าหน้าตั้งค่าของกลุ่มได้เหมือนผู้ดูแลระบบ
  if (roles && !roles.includes(user.role) && !(user.canManage && roles.includes('ADMIN'))) {
    const home = user.role === 'ADMIN' ? '/admin' : user.role === 'TEACHER' ? '/teacher' : '/dashboard';
    return <Navigate to={home} replace />;
  }

  return children;
};

// "/" : ผู้เยี่ยมชมที่ยังไม่ล็อกอินเห็นหน้า Landing, ผู้ล็อกอินเข้า Layout ตามเดิม
const RootGate = () => {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (!loading && !user && pathname === '/') return <Landing />;
  return <ProtectedRoute><Layout /></ProtectedRoute>;
};

function App() {
  return (
    <I18nProvider>
    <AuthProvider>
      <DialogProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          {/* ลิงก์ผู้ปกครอง: สาธารณะ ไม่ต้องล็อกอิน */}
          <Route path="/p/:token" element={<ParentView />} />
          <Route path="/privacy" element={<PrivacyNotice />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/join" element={<JoinGroup />} />
          <Route path="/join/:code" element={<JoinGroup />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <RootGate />
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="group" element={<GroupSettings />} />
            {/* ผู้ดูแลแพลตฟอร์ม: API ตรวจสิทธิ์ด้วย PLATFORM_ADMIN_EMAILS */}
            <Route path="ops" element={<OpsTenants />} />

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
                  <ScanCheck />
                </ProtectedRoute>
              }
            />
            <Route
              path="teacher/scan/classic"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <QRScanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="attendance"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <AttendanceCheck />
                </ProtectedRoute>
              }
            />
            <Route
              path="summary"
              element={
                <ProtectedRoute roles={['TEACHER', 'ADMIN']}>
                  <DaySummary />
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
                <ProtectedRoute roles={['ADMIN']}>
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

            <Route
              path="admin/setup"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <SetupWizard />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/settings"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <SettingsHub />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/privacy"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <DataPrivacy />
                </ProtectedRoute>
              }
            />

            <Route
              path="admin/plan"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <PlanPage />
                </ProtectedRoute>
              }
            />

            {/* บันทึกหลังแผน: เส้นทางตายตัวต้องมาก่อน :id */}
            <Route
              path="lesson-log"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <LessonLogHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="lesson-log/new"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <CreateRecord />
                </ProtectedRoute>
              }
            />
            <Route
              path="lesson-log/export"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <ExportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="lesson-log/summary"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <SummaryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="lesson-log/templates"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <TemplatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="lesson-log/:id"
              element={
                <ProtectedRoute roles={['ADMIN', 'TEACHER']}>
                  <RecordPage />
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
      </DialogProvider>
    </AuthProvider>
    </I18nProvider>
  );
}

export default App;
