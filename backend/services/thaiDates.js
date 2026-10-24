// วันที่สอน: เก็บเป็นวันจริง (YYYY-MM-DD) · แปลงข้อความไทยเดิม เช่น "3, 9, 10 มิ.ย. 69" "19-20 พ.ค. 69" "30 พ.ค. - 2 มิ.ย. 69"
const MONTHS = [
  ['ม.ค.', 'มกราคม'], ['ก.พ.', 'กุมภาพันธ์'], ['มี.ค.', 'มีนาคม'], ['เม.ย.', 'เมษายน'], ['พ.ค.', 'พฤษภาคม'], ['มิ.ย.', 'มิถุนายน'],
  ['ก.ค.', 'กรกฎาคม'], ['ส.ค.', 'สิงหาคม'], ['ก.ย.', 'กันยายน'], ['ต.ค.', 'ตุลาคม'], ['พ.ย.', 'พฤศจิกายน'], ['ธ.ค.', 'ธันวาคม'],
];
const SHORT = MONTHS.map(m => m[0]);
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MONTH_RE = MONTHS.flat().sort((a, b) => b.length - a.length).map(esc).join('|');
const monthIndex = (t) => MONTHS.findIndex(m => m.includes(t));
const MAX_DAYS = 62;

const iso = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
};
// ปี พ.ศ. 2 หรือ 4 หลัก / ค.ศ. 4 หลัก -> ค.ศ.
const toCE = (y) => {
  if (!y) return null;
  const n = Number(y);
  if (y.length <= 2) return 2500 + n - 543;
  return n > 2400 ? n - 543 : n;
};
const daysBetween = (a, b) => {
  const out = [];
  for (let t = Date.parse(a); t <= Date.parse(b) && out.length <= MAX_DAYS; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
};

function parseThaiDates(text, fallbackYear = new Date().getFullYear()) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  const out = new Set();
  // ข้ามเดือน: "30 พ.ค. - 2 มิ.ย. 69" / "30 พ.ค. 68 - 2 ม.ค. 69"
  const cross = new RegExp(`(\\d{1,2}) ?(${MONTH_RE}) ?(\\d{2,4})? ?- ?(\\d{1,2}) ?(${MONTH_RE}) ?(\\d{2,4})?`, 'g');
  let rest = s.replace(cross, (_, d1, m1, y1, d2, m2, y2) => {
    const yb = toCE(y2) || fallbackYear;
    const mi1 = monthIndex(m1), mi2 = monthIndex(m2);
    const ya = toCE(y1) || (mi1 > mi2 ? yb - 1 : yb);
    const a = iso(ya, mi1, +d1), b = iso(yb, mi2, +d2);
    if (a && b && a <= b) daysBetween(a, b).forEach(x => out.add(x));
    return ' ';
  });
  // กลุ่มวันในเดือนเดียว: "3, 9, 10 มิ.ย. 69" / "19-20 พ.ค." (ปีว่างใช้ปีของกลุ่มถัดไป)
  const group = new RegExp(`((?:\\d{1,2}(?: ?- ?\\d{1,2})?(?: ?,? ?))+) ?(${MONTH_RE}) ?(\\d{2,4})?`, 'g');
  const groups = [];
  rest.replace(group, (_, days, m, y) => { groups.push({ days, m: monthIndex(m), y: toCE(y) }); return ' '; });
  for (let i = groups.length - 1, nextYear = fallbackYear; i >= 0; i--) {
    const g = groups[i];
    const y = g.y || nextYear;
    nextYear = y;
    g.days.split(/ ?, ?| /).filter(Boolean).forEach(part => {
      const [a, b] = part.split(/ ?- ?/).map(Number);
      if (b) { const from = iso(y, g.m, a), to = iso(y, g.m, b); if (from && to && from <= to) daysBetween(from, to).forEach(x => out.add(x)); }
      else { const d = iso(y, g.m, a); if (d) out.add(d); }
    });
  }
  return [...out].sort().slice(0, MAX_DAYS);
}

// วันจริงที่ส่งมาจากหน้าจอ: 'YYYY-MM-DD' ไม่ซ้ำ เรียงแล้ว · ผิดรูป = null
function cleanDates(list) {
  if (!Array.isArray(list) || list.length > MAX_DAYS) return null;
  const out = new Set();
  for (const v of list) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const [y, m, d] = v.split('-').map(Number);
    if (!iso(y, m - 1, d)) return null;
    out.add(v);
  }
  return [...out].sort();
}

// ข้อความแสดงผลจากวันจริง (ใช้เมื่อหน้าจอไม่ได้ส่งข้อความมา): "3, 9, 10 มิ.ย. 69"
function formatThaiDates(list) {
  const groups = [];
  list.forEach(v => {
    const [y, m, d] = v.split('-').map(Number);
    const g = groups[groups.length - 1];
    if (g && g.y === y && g.m === m) g.days.push(d); else groups.push({ y, m, days: [d] });
  });
  return groups.map((g, i) => {
    const last = i === groups.length - 1 || groups[i + 1].y !== g.y;
    return `${g.days.join(', ')} ${SHORT[g.m - 1]}${last ? ` ${String(g.y + 543).slice(-2)}` : ''}`;
  }).join(' และ ');
}

// ฟิลด์วันที่ของบันทึกจาก dates (ถ้ามี) หรือจาก dateText
function dateFields(dates, dateText) {
  const list = dates || parseThaiDates(dateText);
  return {
    teachDates: list.map(v => new Date(`${v}T00:00:00Z`)),
    dateFrom: list.length ? new Date(`${list[0]}T00:00:00Z`) : null,
    dateTo: list.length ? new Date(`${list[list.length - 1]}T00:00:00Z`) : null,
    ...(list.length ? { assessedOn: new Date(`${list[0]}T00:00:00Z`) } : {}),
  };
}

module.exports = { parseThaiDates, cleanDates, formatThaiDates, dateFields, MAX_DAYS };
