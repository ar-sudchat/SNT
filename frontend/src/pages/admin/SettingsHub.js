import React from 'react';
import { Link } from 'react-router-dom';
import { SETTINGS_ITEMS, Icon } from '../../components/navConfig';

const SettingsHub = () => (
  <div className="space-y-4">
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ตั้งค่าระบบ</h1>
      <p className="text-sm text-gray-500">ข้อมูลหลักของโรงเรียน ทำครั้งเดียวตอนต้นปี แล้วแก้เมื่อมีการเปลี่ยนแปลง</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {SETTINGS_ITEMS.map(item => (
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
  </div>
);

export default SettingsHub;
