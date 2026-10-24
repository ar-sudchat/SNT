// Helpers for StudentMonitor (per-student action page)

export const STATUS_META = {
  APPROVED: { label: 'ผ่าน', icon: '✓', cell: 'bg-green-100 text-green-700', btn: 'bg-green-600 text-white', btnSoft: 'bg-green-50 text-green-800 ring-1 ring-green-200' },
  PENDING: { label: 'รอตรวจ', icon: '○', cell: 'bg-yellow-100 text-yellow-800', btn: 'bg-yellow-500 text-white', btnSoft: 'bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200' },
  REJECTED: { label: 'ไม่ผ่าน', icon: '✗', cell: 'bg-red-100 text-red-700', btn: 'bg-red-600 text-white', btnSoft: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  NOT_SUBMITTED: { label: 'ยังไม่ส่ง', icon: '–', cell: 'bg-gray-100 text-gray-500', btn: 'bg-gray-700 text-white', btnSoft: 'bg-gray-50 text-gray-700 ring-1 ring-gray-200' }
};

export const STATUS_ORDER = ['APPROVED', 'PENDING', 'REJECTED', 'NOT_SUBMITTED'];

export const statusOf = (task) => task?.submission?.status || 'NOT_SUBMITTED';
export const isMissing = (task) => statusOf(task) === 'NOT_SUBMITTED';

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';

export const isOverdue = (task) => {
  if (!task?.deadline) return false;
  const end = new Date(task.deadline);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
};

export const buildParentMessage = (student, missing) => {
  const name = student?.name || 'นักเรียน';
  const cls = student?.class?.className ? ` ห้อง ${student.class.className}` : '';
  if (!missing.length) {
    return `เรียนผู้ปกครองของ ${name}${cls}\n\nขณะนี้ ${name} ส่งงานครบทุกชิ้นแล้ว ขอบคุณที่ช่วยดูแลค่ะ/ครับ`;
  }
  const lines = missing.map((m, i) => {
    const due = m.task.deadline ? ` (กำหนดส่ง ${fmtDate(m.task.deadline)}${isOverdue(m.task) ? ' — เลยกำหนดแล้ว' : ''})` : '';
    return `${i + 1}. ${m.subject.subjectName} · ${m.task.taskName}${due}`;
  });
  return [
    `เรียนผู้ปกครองของ ${name}${cls}`,
    '',
    `ทางโรงเรียนขอแจ้งว่า ${name} ยังมีงานที่ยังไม่ได้ส่ง ${missing.length} งาน ดังนี้`,
    ...lines,
    '',
    'รบกวนผู้ปกครองช่วยติดตามให้นักเรียนส่งงานกับครูประจำวิชาด้วยค่ะ/ครับ หากมีข้อสงสัยติดต่อครูได้เลย',
    'ขอบคุณค่ะ/ครับ'
  ].join('\n');
};

export const copyText = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
};
