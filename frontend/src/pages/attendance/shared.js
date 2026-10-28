import { t } from '../../i18n';
import { subjectAPI, reportAPI } from '../../services/api';

export const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

// วิชาที่เลือกได้: ครู = วิชาที่สอนเอง · แอดมิน/ผู้จัดการ = ทุกวิชา
export async function loadSubjects(seesAll) {
  const res = seesAll ? await subjectAPI.getAll({ status: 'ACTIVE' }) : await reportAPI.teacherSubjects();
  return (res.data || []).map(s => ({ id: s.id, label: `${s.subjectCode} ${s.subjectName}`, subjectName: s.subjectName }));
}

export const errorOf = (err, fallback) => (err && err.response && err.response.data && err.response.data.error) || fallback;

export function saveBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ข้อความ error ของกล้อง (ภาษาคน): ไม่อนุญาต / ไม่พบกล้อง / ต้องใช้ https / อื่นๆ
export function cameraErrorText(err) {
  const raw = `${(err && (err.name || err.message)) || ''} ${typeof err === 'string' ? err : ''}`;
  if (/NotAllowed|Permission/i.test(raw)) return t('ยังไม่ได้อนุญาตให้ใช้กล้อง — แตะไอคอนแม่กุญแจข้างชื่อเว็บ แล้วเลือก "อนุญาต" กล้อง หรือพิมพ์รหัสนักเรียนแทน');
  if (/NotFound|Requested device not found/i.test(raw)) return t('ไม่พบกล้องในอุปกรณ์นี้ พิมพ์รหัสนักเรียนแทนได้');
  if (/NotReadable|Could not start|in use/i.test(raw)) return t('กล้องกำลังถูกใช้โดยแอปอื่น ปิดแอปนั้นแล้วลองใหม่');
  if (!window.isSecureContext || /undefined|secure/i.test(raw)) return t('เปิดกล้องได้เฉพาะเมื่อเข้าเว็บแบบ https (หรือ localhost)');
  return t('เปิดกล้องไม่สำเร็จ ลองใหม่ หรือพิมพ์รหัสนักเรียนแทน');
}
