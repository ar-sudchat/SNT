import React from 'react';
import { SmartComboBox } from '../../components/ui';

// แถบตัวกรองที่แสดงตลอด (ไม่มี popup) — เปลี่ยนค่าแล้วใช้ทันที
// มือถือ: ตัวกรองที่ใช้บ่อย (วิชา/ห้อง) เป็นชิปแตะครั้งเดียวอยู่บนสุด (prop `chips`) ·
//         ปีการศึกษา/ชั้น เป็นช่องเลือก 2 คอลัมน์ใต้ชิป · md+ ใช้ช่องเลือก 4 คอลัมน์ตามเดิม
export const MonitorFilterBar = ({ chips, children }) => (
  <div className="bg-white rounded-lg shadow p-3 sm:p-4">
    {chips && <div className="space-y-1 md:hidden mb-2">{chips}</div>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2 gap-y-3 sm:gap-x-3">{children}</div>
  </div>
);

// หนึ่งตัวกรอง = ป้าย + SmartComboBox (รับ props ของ SmartComboBox ได้ทั้งหมด)
// mobileHidden = ซ่อนบนมือถือ (มีชิปแทนแล้ว)
export const MonitorFilterField = ({ label, mobileHidden, ...comboProps }) => (
  <div className={`min-w-0 ${mobileHidden ? 'hidden md:block' : ''}`}>
    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 truncate">{label}</label>
    <SmartComboBox searchable clearable className="[&_[role=combobox]]:min-h-[44px]" {...comboProps} />
  </div>
);

// ชิปเลือก 1 ค่า (ต้องมีค่าเสมอ ไม่มีปุ่ม "ทั้งหมด") — หน้าตาเดียวกับ QuickFilterBar
export const MonitorChips = ({ label, options, value, onChange, labelKey, valueKey = 'id' }) => (
  <div role="group" aria-label={label} className="flex items-center gap-2">
    <span className="w-12 shrink-0 text-xs font-medium text-gray-500">{label}</span>
    <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {options.map(o => {
        const on = o[valueKey] === value;
        return (
          <button
            key={o[valueKey]}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o[valueKey])}
            className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition ${
              on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {o[labelKey]}
          </button>
        );
      })}
    </div>
  </div>
);
