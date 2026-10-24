import React, { useEffect, useMemo, useState } from 'react';
import { WindowModal } from '../../components/ui';

// ข้อความทวงงานสำหรับวางในกลุ่ม LINE ห้องเรียน (ไม่ใช้ LINE API)
// ใช้เฉพาะชื่อจริง + เลขที่ (ไม่ใส่รหัสนักเรียน)

const PREFIXES = ['เด็กชาย', 'เด็กหญิง', 'ด.ช.', 'ด.ญ.', 'นางสาว', 'น.ส.', 'นาย', 'นาง'];
const DEFAULT_CLOSING = 'ส่งได้ที่โต๊ะครูภายในวันศุกร์นี้';
const PARTICLE_KEY = 'monitor.reminderParticle';

export const firstName = (full) => {
  let s = String(full || '').trim();
  for (const p of PREFIXES) {
    if (s.startsWith(p)) { s = s.slice(p.length).trim(); break; }
  }
  return s.split(/\s+/)[0] || String(full || '').trim();
};

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const shortThaiDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;
};

// items: [{ name, number, detail?, group? }]
export function buildReminderText({ title, deadline, items, closing, particle }) {
  const lines = [`📚 ${title}${deadline ? ` (กำหนดส่ง ${deadline})` : ''}`, `ยังไม่ส่ง ${items.length} คน:`];
  const grouped = new Set(items.map(i => i.group).filter(Boolean)).size > 1;
  let n = 0;
  let lastGroup = null;
  items.forEach(it => {
    if (grouped && it.group !== lastGroup) {
      lastGroup = it.group;
      n = 0;
      lines.push(`\n[${it.group || 'ไม่ระบุห้อง'}]`);
    }
    n += 1;
    const num = it.number ? ` (เลขที่ ${it.number})` : '';
    lines.push(`${n}. ${firstName(it.name)}${num}${it.detail ? ` — ${it.detail}` : ''}`);
  });
  const tail = `${(closing || '').trim()}${particle === 'ครับ' ? 'นะครับ' : 'นะคะ'} 🙏`;
  lines.push('', tail);
  return lines.join('\n');
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

const readParticle = () => {
  try { return localStorage.getItem(PARTICLE_KEY) === 'ครับ' ? 'ครับ' : 'ค่ะ'; } catch { return 'ค่ะ'; }
};

// ปุ่ม + หน้าต่างตัวอย่างข้อความ · ไม่แสดงเมื่อไม่มีคนค้าง
export function ReminderButton({ title, deadline, items }) {
  const [open, setOpen] = useState(false);
  const [particle, setParticle] = useState(readParticle);
  const [closing, setClosing] = useState(DEFAULT_CLOSING);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(PARTICLE_KEY, particle); } catch { /* ignore */ }
  }, [particle]);
  useEffect(() => { if (!copied) return undefined; const t = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(t); }, [copied]);

  const text = useMemo(
    () => buildReminderText({ title, deadline, items, closing, particle }),
    [title, deadline, items, closing, particle]
  );

  if (!items || items.length === 0) return null;

  const doCopy = async () => { setCopied(await copyText(text)); };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="คัดลอกข้อความทวงงานไปวางในกลุ่ม LINE"
        className="shrink-0 min-h-[44px] px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 whitespace-nowrap bg-amber-100 text-amber-800 hover:bg-amber-200"
      >
        <span aria-hidden="true">📣</span>
        <span>คัดลอกข้อความทวงงาน</span>
      </button>
      <WindowModal
        open={open}
        title="ข้อความทวงงาน"
        onClose={() => setOpen(false)}
        id="monitor-reminder"
        initialWidth="max-w-lg"
        footer={
          <div className="flex gap-2">
            <button
              onClick={doCopy}
              className="flex-1 min-h-[44px] rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700"
            >
              {copied ? 'คัดลอกแล้ว ✓' : 'คัดลอก'}
            </button>
            <a
              href={`https://line.me/R/share?text=${encodeURIComponent(text)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-h-[44px] rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 flex items-center justify-center"
            >
              เปิด LINE
            </a>
          </div>
        }
      >
        <div className="p-4 space-y-3">
          <div>
            <label htmlFor="reminder-closing" className="block text-sm font-medium text-gray-700 mb-1">ประโยคปิดท้าย</label>
            <input
              id="reminder-closing"
              type="text"
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              className="w-full min-h-[44px] px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div role="group" aria-label="คำลงท้าย" className="grid grid-cols-2 gap-1 bg-gray-200 rounded-lg p-1">
            {['ค่ะ', 'ครับ'].map(p => (
              <button
                key={p}
                onClick={() => setParticle(p)}
                aria-pressed={particle === p}
                className={`min-h-[44px] rounded-md text-sm font-medium ${particle === p ? 'bg-white text-brand-700 shadow' : 'text-gray-600'}`}
              >
                {p}
              </button>
            ))}
          </div>
          <pre
            data-testid="reminder-preview"
            className="whitespace-pre-wrap break-words text-sm bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-[40vh] overflow-y-auto font-sans"
          >{text}</pre>
        </div>
      </WindowModal>
    </>
  );
}
