import React from 'react';
import { Link } from 'react-router-dom';
import { settingsFor, Icon } from '../../components/navConfig';
import { useAuth } from '../../context/AuthContext';
import InvitePanel from '../signup/InvitePanel';

const SettingsHub = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || !!user?.canManage;
  return (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{canManage ? 'ตั้งค่าระบบ' : 'ห้องและนักเรียน'}</h1>
      <p className="text-sm text-gray-500">{canManage ? 'ข้อมูลหลักของกลุ่ม ทำครั้งเดียวตอนต้นปี แล้วแก้เมื่อมีการเปลี่ยนแปลง' : 'ครูทุกคนในกลุ่มจัดการชั้นปี ห้องเรียน และรายชื่อนักเรียนได้เอง'}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {settingsFor(canManage).map(item => (
        <Link
          key={item.path}
          to={item.path}
          className="flex min-h-[44px] items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 hover:ring-brand-300 transition"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Icon d={item.icon} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-gray-800">{item.label}</span>
            <span className="block text-sm text-gray-500">{item.desc}</span>
          </span>
        </Link>
      ))}
    </div>
    <Link to="/group" className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-100 hover:ring-brand-300">
      <span><span className="block font-semibold text-brand-800">รหัสเชิญและสมาชิกกลุ่ม</span><span className="block text-sm text-gray-600">แชร์รหัสเข้ากลุ่ม ดูสมาชิก เปลี่ยนชื่อกลุ่ม</span></span>
      <span aria-hidden="true">›</span>
    </Link>
    {canManage && <InvitePanel />}
  </div>
  );
};

export default SettingsHub;
