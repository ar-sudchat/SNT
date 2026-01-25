import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({});

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Check if menu is active - exact match for root paths (Dashboard)
  const isActive = (path) => {
    // For root dashboard paths, only exact match
    if (path === '/admin' || path === '/teacher' || path === '/student') {
      return location.pathname === path;
    }
    // For other paths, check exact or starts with
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const toggleGroup = (groupId) => {
    setOpenGroups(prev => {
      // Accordion behavior: only one group can be open at a time
      if (prev[groupId]) {
        return {}; // Close if already open
      }
      return { [groupId]: true }; // Open only this group
    });
  };

  // Menu structure with groups for ADMIN
  const adminMenuGroups = [
    {
      id: 'main',
      items: [
        { path: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' }
      ]
    },
    {
      id: 'general',
      label: 'ข้อมูลทั่วไป',
      icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
      items: [
        { path: '/admin/academic-years', label: 'ปีการศึกษา', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
        { path: '/admin/grades', label: 'ชั้นปี', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { path: '/admin/classes', label: 'ห้องเรียน', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
        { path: '/admin/students', label: 'นักเรียน', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
        { path: '/admin/teachers', label: 'ครู', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
        { path: '/admin/subjects', label: 'วิชา', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
        { path: '/admin/transfer', label: 'ย้ายชั้นเรียน', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
        { path: '/admin/import', label: 'Import ข้อมูล', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' }
      ]
    },
    {
      id: 'tasks',
      items: [
        { path: '/admin/tasks', label: 'งาน', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
        { path: '/admin/qrcode', label: 'สร้าง QR Code', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' },
        { path: '/teacher/scan', label: 'สแกน QR', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' }
      ]
    },
    {
      id: 'monitor',
      items: [
        { path: '/monitor/class', label: 'Monitor ห้องเรียน', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { path: '/monitor/subject', label: 'Monitor รายวิชา', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }
      ]
    }
  ];

  const menuItems = {
    ADMIN: adminMenuGroups,
    TEACHER: [
      {
        id: 'main',
        items: [
          { path: '/teacher', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
          { path: '/teacher/scan', label: 'สแกน QR Code', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z' },
          { path: '/monitor/class', label: 'Monitor ห้องเรียน', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
          { path: '/monitor/subject', label: 'Monitor รายวิชา', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' }
        ]
      }
    ],
    STUDENT: [
      {
        id: 'main',
        items: [
          { path: '/student', label: 'งานของฉัน', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' }
        ]
      }
    ]
  };

  const currentMenuGroups = menuItems[user?.role] || [];

  // Close all menu groups when clicking outside
  const closeAllGroups = () => {
    setOpenGroups({});
  };

  const renderMenuItem = (item) => (
    <Link
      key={item.path}
      to={item.path}
      className={`flex items-center px-6 py-3 text-white hover:bg-blue-700 transition-colors ${
        isActive(item.path) ? 'bg-blue-700 border-l-4 border-white' : ''
      }`}
      onClick={() => {
        setIsSidebarOpen(false);
        closeAllGroups(); // Collapse all groups when clicking non-group menu item
      }}
    >
      <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
      </svg>
      {item.label}
    </Link>
  );

  const renderMenuGroup = (group) => {
    if (!group.label) {
      // No label = no collapsible, just render items
      return group.items.map(renderMenuItem);
    }

    const isOpen = openGroups[group.id];
    const hasActiveItem = group.items.some(item => isActive(item.path));

    return (
      <div key={group.id}>
        {/* Group header */}
        <button
          onClick={() => toggleGroup(group.id)}
          className={`w-full flex items-center justify-between px-6 py-3 text-white hover:bg-blue-700 transition-colors ${
            hasActiveItem && !isOpen ? 'bg-blue-700' : ''
          }`}
        >
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={group.icon} />
            </svg>
            {group.label}
          </div>
          <svg
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Collapsible items - lighter background for submenu */}
        <div className={`overflow-hidden transition-all duration-200 bg-white/15 ${isOpen ? 'max-h-[500px]' : 'max-h-0'}`}>
          {group.items.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center pl-10 pr-6 py-3 text-white hover:bg-blue-700 transition-colors ${
                isActive(item.path) ? 'bg-blue-700 border-l-4 border-white' : ''
              }`}
              onClick={() => {
                setIsSidebarOpen(false);
                // Keep only this group open, close others
                setOpenGroups({ [group.id]: true });
              }}
            >
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-blue-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-center h-16 bg-blue-900">
          <span className="text-white text-xl font-bold">SNT System</span>
        </div>

        <nav className="mt-4 pb-4">
          {currentMenuGroups.map(renderMenuGroup)}
        </nav>

        {/* Version info at bottom of sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-center text-xs text-blue-300 bg-blue-900">
          <p>Version 1.1.0</p>
          <p className="text-blue-400">Build: 2026-01-25</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top navbar */}
        <header className="bg-white shadow-sm print:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                {user?.teacher?.name || user?.student?.name || user?.email}
              </span>
              <span className="px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded">
                {user?.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : user?.role === 'TEACHER' ? 'ครู' : 'นักเรียน'}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 text-sm text-white bg-red-500 rounded hover:bg-red-600 transition-colors"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
