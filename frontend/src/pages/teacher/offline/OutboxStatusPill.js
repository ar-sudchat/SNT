import React from 'react';

// ป้ายสถานะ: ออนไลน์ / ออฟไลน์ — รอส่ง N รายการ + ปุ่ม "ส่งตอนนี้"
const OutboxStatusPill = ({ online, pending, otherSchool = 0, flushing, onFlush }) => {
  const waiting = pending > 0;
  const tone = !online
    ? 'bg-amber-50 border-amber-300 text-amber-800'
    : waiting
      ? 'bg-amber-50 border-amber-300 text-amber-800'
      : 'bg-green-50 border-green-200 text-green-700';
  const dot = !online || waiting ? 'bg-amber-500' : 'bg-green-500';
  const label = !online
    ? `ออฟไลน์${waiting ? ` — รอส่ง ${pending} รายการ` : ''}`
    : waiting
      ? `ออนไลน์ — รอส่ง ${pending} รายการ`
      : 'ออนไลน์';

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 flex-shrink-0" role="status" aria-live="polite" data-testid="outbox-pill">
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${tone}`}>
        <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
        {label}
      </span>
      {waiting && (
        <button
          type="button"
          onClick={onFlush}
          disabled={flushing}
          className="min-h-[44px] px-3 rounded-lg text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
        >
          {flushing ? 'กำลังส่ง…' : 'ส่งตอนนี้'}
        </button>
      )}
      {otherSchool > 0 && (
        <span className="text-xs text-amber-800" data-testid="outbox-other-school">
          มี {otherSchool} รายการที่บันทึกไว้ของกลุ่มอื่น — ยังไม่ส่ง จะส่งเมื่อสลับกลับไปกลุ่มนั้น
        </span>
      )}
    </div>
  );
};

export default OutboxStatusPill;
