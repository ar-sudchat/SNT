import React from 'react';
import { SmartComboBox } from '../../components/ui';

// แถบตัวกรองที่แสดงตลอด (ไม่มี popup) — เปลี่ยนค่าแล้วใช้ทันที
// มือถือ 2 คอลัมน์, md+ 4 คอลัมน์ · ช่องเลือกสูง ≥ 44px
export const MonitorFilterBar = ({ children }) => (
  <div className="bg-white rounded-lg shadow p-3 sm:p-4">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-3 sm:gap-x-3">{children}</div>
  </div>
);

// หนึ่งตัวกรอง = ป้าย + SmartComboBox (รับ props ของ SmartComboBox ได้ทั้งหมด)
export const MonitorFilterField = ({ label, ...comboProps }) => (
  <div className="min-w-0">
    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 truncate">{label}</label>
    <SmartComboBox searchable clearable className="[&_[role=combobox]]:min-h-[44px]" {...comboProps} />
  </div>
);
