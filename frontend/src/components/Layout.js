import { t } from '../i18n';
import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import Logo from './brand/Logo';
import ThemePicker from './ThemePicker';
import LanguagePicker from './LanguagePicker';
import TenantSwitcher from './TenantSwitcher';
import Avatar, { displayNameOf } from './Avatar';
import { ICON, settingsFor, Icon } from './navConfig';
import { CRUMB_LINK } from './ui/PageHeader';

const SCAN_PATH = '/teacher/scan';
const GUIDE_URL = '/guide/';

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const role = user?.role;
  const isStaff = role === 'ADMIN' || role === 'TEACHER';
  const isAdmin = role === 'ADMIN';
  // เจ้าของ/ผู้ดูแลกลุ่มตั้งค่ากลุ่มได้ แม้บัญชีจะเป็นครู
  const canManage = isAdmin || !!user?.canManage;
  const homePath = isAdmin ? '/admin' : role === 'TEACHER' ? '/teacher' : '/student';

  useEffect(() => { setMoreOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const path = location.pathname;
  const settingsItem = isStaff ? settingsFor(canManage).find(i => path === i.path || path.startsWith(i.path + '/')) : null;
  const isActive = (p) => {
    if (p === homePath) return path === p;
    if (p === '/admin/settings') return path === p || !!settingsItem;
    return path === p || path.startsWith(p + '/');
  };

  // เมนูหลัก: 4 รายการ (+ ตั้งค่าระบบ สำหรับแอดมิน)
  const mainItems = isStaff
    ? [
        { path: homePath, label: t('หน้าแรก'), icon: ICON.home },
        { path: '/monitor', label: t('ตรวจงาน'), icon: ICON.chart },
        { path: '/admin/tasks', label: t('สร้างงาน'), icon: ICON.task },
        { path: '/attendance', label: t('เช็คชื่อ'), icon: ICON.attendance },
        { path: '/summary', label: t('สรุปรายวัน'), icon: ICON.chart },
        { path: '/lesson-log', label: t('บันทึกหลังแผน'), icon: ICON.lessonlog },
        { path: '/ai', label: t('ผู้ช่วย AI'), icon: ICON.ai },
        { path: '/tools', label: t('เครื่องมือห้องเรียน'), icon: ICON.tools },
        { path: '/admin/settings', label: canManage ? t('ตั้งค่าระบบ') : t('ห้องและนักเรียน'), icon: ICON.gear }
      ]
    : [{ path: '/student', label: t('งานของฉัน'), icon: ICON.task }];

  // รายการในแผ่น "เพิ่มเติม" (เช็คชื่อ/สรุปรายวันขึ้นก่อน เพราะใช้ทุกคาบ)
  const moreItems = [
    { path: '/attendance', label: t('เช็คชื่อเข้าเรียน'), icon: ICON.attendance },
    { path: '/summary', label: t('สรุปรายวัน'), icon: ICON.chart },
    { path: '/lesson-log', label: t('บันทึกหลังแผน'), icon: ICON.lessonlog },
    { path: '/ai', label: t('ผู้ช่วย AI'), icon: ICON.ai },
    { path: '/tools', label: t('เครื่องมือห้องเรียน'), icon: ICON.tools },
    { path: '/admin/settings', label: canManage ? t('ตั้งค่าระบบ') : t('ห้องและนักเรียน'), icon: ICON.gear },
    { path: '/group', label: t('ตั้งค่ากลุ่ม / รหัสเชิญ'), icon: ICON.students }
  ];

  const userName = displayNameOf(user && user.role === 'ADMIN' && !user.displayName ? { ...user, name: t('ผู้ดูแลระบบ') } : user);
  const roleLabel = isAdmin ? t('ผู้ดูแลระบบ') : role === 'TEACHER' ? t('ครู') : t('นักเรียน');

  const tabCls = (active) =>
    `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-brand-700' : 'text-gray-500'}`;

  return (
    <div className="min-h-screen bg-page">
      {/* Sidebar (จอใหญ่เท่านั้น) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-side lg:flex print:hidden">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-side-fg/15 px-4">
          <Link to={homePath} aria-label={t("หน้าแรก")} className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"><Logo size={36} tone="side" /></Link>
        </div>
        {isStaff && (
          <div className="px-4 pt-4">
            <Link
              to={SCAN_PATH}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-accent-fg shadow-md hover:brightness-110"
            >
              <Icon d={ICON.scan} />{t(" สแกนส่งงาน")}</Link>
          </div>
        )}
        <nav className="mt-3 flex-1 pb-4" aria-label={t("เมนูหลัก")}>
          {mainItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className={`flex min-h-[44px] items-center gap-3 border-l-4 px-5 py-3 text-side-fg transition-colors hover:bg-side-on/80 hover:text-side-on-fg ${
                isActive(item.path) ? 'border-accent bg-side-on font-semibold text-side-on-fg' : 'border-transparent'
              }`}
            >
              <Icon d={item.icon} /> {item.label}
            </Link>
          ))}
        </nav>
        <div className="shrink-0 border-t border-side-fg/15 px-2 pt-2">
          <Link to="/group" aria-current={isActive('/group') ? 'page' : undefined}
            className={`flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm text-side-fg hover:bg-side-on/80 hover:text-side-on-fg ${isActive('/group') ? 'bg-side-on text-side-on-fg' : ''}`}>
            <Icon d={ICON.students} className="h-4 w-4" />{t(" กลุ่มและรหัสเชิญ")}</Link>
          <Link to="/profile" aria-current={isActive('/profile') ? 'page' : undefined}
            className={`flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm text-side-fg hover:bg-side-on/80 hover:text-side-on-fg ${isActive('/profile') ? 'bg-side-on text-side-on-fg' : ''}`}>
            <Icon d={ICON.user} className="h-4 w-4" />{t(" โปรไฟล์ของฉัน")}</Link>
          <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer"
            className="flex min-h-[40px] items-center gap-2 rounded-lg px-3 text-sm text-side-fg hover:bg-side-on/80 hover:text-side-on-fg">
            <Icon d={ICON.help} className="h-4 w-4" />{t(" คู่มือการใช้งาน")}<span className="sr-only">{t(" (เปิดแท็บใหม่)")}</span>
          </a>
        </div>
        <div className="shrink-0 px-4 py-2 text-center text-[11px] text-side-fg">v1.2.0</div>
      </aside>

      <div className="min-w-0 lg:ml-60">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-white shadow-sm print:hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 lg:py-3">
            <Link to={homePath} className="shrink-0 lg:hidden" aria-label={t("หน้าแรก")}><Logo size={30} tone="theme" tagline={false} /></Link>
            <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
              <div className={isStaff ? 'hidden lg:block' : ''}><TenantSwitcher /></div>
              {isStaff && (
                <button type="button" onClick={() => setMoreOpen(true)} aria-label={t("เมนูบัญชี")} aria-expanded={moreOpen}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full lg:hidden">
                  <Avatar user={user} size={36} ring="ring-2 ring-brand-100" />
                </button>
              )}
              <Link to="/profile" title={t("โปรไฟล์ของฉัน")} className={`${isStaff ? 'hidden lg:flex' : 'flex'} min-h-[44px] min-w-0 max-w-[11rem] items-center gap-2 text-sm text-gray-700 underline-offset-4 hover:text-brand-700 hover:underline sm:max-w-[18rem] sm:text-base`}>
                <Avatar user={user} size={32} ring="ring-2 ring-brand-100" />
                <span className="truncate">{userName}</span>
              </Link>
              {!isStaff && (
                <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" aria-label={t("คู่มือการใช้งาน (เปิดแท็บใหม่)")} title={t("คู่มือการใช้งาน")}
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-ink-600 hover:bg-brand-50 hover:text-brand-700">
                  <Icon d={ICON.help} />
                </a>
              )}
              <span className="hidden shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 ring-1 ring-brand-100 lg:inline">{roleLabel}</span>
              <div className={isStaff ? 'hidden lg:block' : ''}><LanguagePicker compact /></div>
              <div className={isStaff ? 'hidden lg:block' : ''}><ThemePicker /></div>
              <button
                onClick={handleLogout}
                aria-label={t("ออกจากระบบ")}
                className={`${isStaff ? 'hidden lg:flex' : 'flex'} min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1 text-sm text-ink-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700`}
              >
                <Icon d={ICON.logout} /><span className="hidden sm:inline">{t("ออกจากระบบ")}</span>
              </button>
            </div>
          </div>
        </header>

        {/* บนคอมขอบบน 16px (เดิม 24px) · แถบล่างของมือถือ/แท็บเล็ตต้องเว้นท้ายเสมอ จึงแยก pb ตามบทบาท */}
        <main className={`min-w-0 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6 ${isStaff ? 'pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6' : 'pb-3 sm:pb-4 lg:pb-6'}`}>
          {/* breadcrumb สูงบรรทัดเดียว ติดเหนือชื่อหน้า (พื้นที่กดยัง 44px ด้วย ::after) */}
          {settingsItem && (
            <nav aria-label="breadcrumb" className="mb-0.5 flex items-center gap-1 text-sm leading-5 print:hidden">
              <Link to="/admin/settings" className={CRUMB_LINK}>
                <Icon d="M15 19l-7-7 7-7" className="h-4 w-4" />{t(" ตั้งค่าระบบ")}</Link>
              <span className="text-gray-400">›</span>
              <span className="text-gray-600">{t(settingsItem.label)}</span>
            </nav>
          )}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* แถบล่าง (มือถือ/แท็บเล็ต) */}
      {isStaff && (
        <nav
          aria-label={t("เมนูหลัก")}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white lg:hidden print:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto flex max-w-lg items-end px-1">
            <Link to={homePath} className={tabCls(isActive(homePath))} aria-current={isActive(homePath) ? 'page' : undefined}>
              <Icon d={ICON.home} className="h-6 w-6" />{t("หน้าแรก")}</Link>
            <Link to="/monitor" className={tabCls(isActive('/monitor'))} aria-current={isActive('/monitor') ? 'page' : undefined}>
              <Icon d={ICON.chart} className="h-6 w-6" />{t("ตรวจงาน")}</Link>
            <Link to={SCAN_PATH} aria-current={isActive(SCAN_PATH) ? 'page' : undefined} className="flex flex-1 flex-col items-center pb-1 text-[11px] font-semibold text-brand-700" aria-label={t("สแกนส่งงาน")}>
              <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg ring-4 ring-white">
                <Icon d={ICON.scan} className="h-7 w-7" />
              </span>{t("สแกน")}</Link>
            <Link to="/admin/tasks" className={tabCls(isActive('/admin/tasks'))} aria-current={isActive('/admin/tasks') ? 'page' : undefined}>
              <Icon d={ICON.task} className="h-6 w-6" />{t("สร้างงาน")}</Link>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={tabCls(moreOpen || isActive('/attendance') || isActive('/summary') || isActive('/lesson-log') || isActive('/ai') || isActive('/tools') || isActive('/admin/settings') || isActive('/profile') || isActive('/group'))}
            >
              <Icon d={ICON.more} className="h-6 w-6" />{t("เพิ่มเติม")}</button>
          </div>
        </nav>
      )}

      {/* แผ่น "เพิ่มเติม" · สูงไม่เกิน 85% ของจอ ส่วนหัว+ปุ่มปิดติดบน รายการเลื่อนได้ (จอ 360x640 ไม่ถูกตัด) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("เพิ่มเติม")}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4">
              <h2 className="text-base font-semibold text-gray-900">{t("เพิ่มเติม")}</h2>
              <button type="button" autoFocus onClick={() => setMoreOpen(false)} className="min-h-[48px] min-w-[48px] px-3 text-sm font-medium text-gray-700">{t("ปิด")}</button>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto overscroll-contain px-4" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
              <div className="flex min-h-[56px] items-center justify-between gap-3">
                <span className="w-12 shrink-0 text-sm text-gray-600">{t("กลุ่ม")}</span>
                <TenantSwitcher fullWidth />
              </div>
              {moreItems.map(item => (
                <Link key={item.path} to={item.path} aria-current={isActive(item.path) ? 'page' : undefined}
                  className={`-mx-4 flex min-h-[52px] items-center gap-3 px-4 ${isActive(item.path) ? 'bg-brand-50 font-semibold text-brand-800' : 'text-gray-800'}`}>
                  <Icon d={item.icon} />{item.label}
                </Link>
              ))}
              <Link to="/profile" aria-current={isActive('/profile') ? 'page' : undefined}
                className={`-mx-4 flex min-h-[60px] items-center gap-3 px-4 ${isActive('/profile') ? 'bg-brand-50 text-brand-800' : 'text-gray-800'}`}>
                <Avatar user={user} size={36} ring="ring-2 ring-brand-100" />
                <span className="min-w-0"><span className="block truncate font-medium">{userName}</span><span className="block text-xs text-gray-600">{t("โปรไฟล์ของฉัน")}</span></span>
              </Link>
              <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-[52px] items-center gap-3 text-gray-800"><Icon d={ICON.help} />{t(" คู่มือการใช้งาน")}<span className="sr-only">{t(" (เปิดแท็บใหม่)")}</span></a>
              <div className="flex min-h-[52px] items-center justify-between gap-3 text-gray-800">
                <span>{t("ธีมสี")}</span>
                <ThemePicker onChoose={() => setMoreOpen(false)} />
              </div>
              <div className="flex min-h-[52px] items-center justify-between gap-3 text-gray-800">
                <span>{t("ภาษา")}</span>
                <LanguagePicker onChoose={() => setMoreOpen(false)} />
              </div>
              <button type="button" onClick={handleLogout} className="flex min-h-[52px] w-full items-center gap-3 text-red-700">
                <Icon d={ICON.logout} />{t(" ออกจากระบบ")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
