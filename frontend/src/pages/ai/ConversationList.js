import { t, dateLocale } from '../../i18n';
import React from 'react';

// วันที่แบบสัมพัทธ์ภาษาไทย (เมื่อสักครู่ / 5 นาทีที่แล้ว / เมื่อวาน / 12 ต.ค.)
export const relativeDate = (value, now = new Date()) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (now - d) / 1000;
  if (diff < 60) return t('เมื่อสักครู่');
  if (diff < 3600) return t("{value1} นาทีที่แล้ว", { value1: Math.floor(diff / 60) });
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) return t("{value1} ชั่วโมงที่แล้ว", { value1: Math.floor(diff / 3600) });
  if (days === 1) return t('เมื่อวาน');
  if (days < 7) return t("{days} วันที่แล้ว", { days: days });
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: '2-digit' } : {}) });
};

const ConversationList = ({ items, loading, activeId, onSelect, onNew, onDelete }) => (
  <div className="flex flex-col h-full min-h-0">
    <button
      type="button"
      onClick={onNew}
      className="w-full min-h-[44px] px-4 py-2 border border-brand-300 text-brand-700 bg-white rounded-lg hover:bg-brand-50 inline-flex items-center justify-center gap-2 font-medium"
    >
      <span aria-hidden="true">+</span>{t(" แชทใหม่")}</button>
    <p className="text-xs font-medium text-gray-500 mt-4 mb-1 px-1">{t("ประวัติการสนทนา")}</p>
    <div className="flex-1 min-h-0 overflow-y-auto -mx-1" data-testid="ai-conversations">
      {loading && items.length === 0 && <p className="text-sm text-gray-500 px-2 py-3">{t("กำลังโหลด...")}</p>}
      {!loading && items.length === 0 && <p className="text-sm text-gray-500 px-2 py-3">{t("ยังไม่มีประวัติ")}</p>}
      <ul className="space-y-1">
        {items.map(c => (
          <li key={c.id} className={`group flex items-stretch rounded-lg ${c.id === activeId ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={c.id === activeId ? 'true' : undefined}
              className="flex-1 min-w-0 text-left px-3 py-2 min-h-[44px]"
            >
              <span className={`block text-sm truncate ${c.id === activeId ? 'text-brand-700 font-semibold' : 'text-gray-800'}`}>{c.title}</span>
              <span className="block text-xs text-gray-500">{relativeDate(c.updatedAt)}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(c)}
              aria-label={t("ลบบทสนทนา {value1}", { value1: c.title })}
              className="shrink-0 min-w-[44px] min-h-[44px] text-gray-400 hover:text-red-600 rounded-lg"
            >
              <svg className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default ConversationList;

