// สร้างไฟล์ Excel แบบบันทึกเวลาเรียน (ปพ.5) · 1 ชีตต่อห้อง×เดือน · ข้อความในฟอร์มเป็นไทยตามแบบราชการ
const XLSX = require('xlsx');

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const PRESENT = '/';
const ABSENT = 'ข';
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

const monthLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return { name: MONTHS[m - 1], short: SHORT[m - 1], be: y + 543 }; };

function sheetName(base, used) {
  let name = base.replace(/[\[\]:*?/\\]/g, '-').slice(0, 31) || 'sheet';
  let n = 2;
  while (used.has(name.toLowerCase())) { const suf = ` (${n++})`; name = base.replace(/[\[\]:*?/\\]/g, '-').slice(0, 31 - suf.length) + suf; }
  used.add(name.toLowerCase());
  return name;
}

// rooms: [{ className, students:[{studentNumber,studentCode,name}], months:[{ ym, dates:[YYYY-MM-DD], presentBy: Map(studentId -> Set(date)) , ids:[studentId per row] }] }]
function buildPp5Workbook({ school, subject, termLabel, rooms }) {
  const wb = XLSX.utils.book_new();
  const used = new Set();
  for (const room of rooms) {
    for (const mo of room.months) {
      const { name, short, be } = monthLabel(mo.ym);
      const nd = mo.dates.length;
      const first = 3; // คอลัมน์แรกของวันที่ (0-based)
      const last = first + nd + 3; // มา ขาด ร้อยละ
      const width = last + 1;
      const row = (cells) => { const r = new Array(width).fill(''); cells.forEach(([i, v]) => { r[i] = v; }); return r; };
      const aoa = [
        row([[0, 'แบบบันทึกเวลาเรียน (ปพ.5)']]),
        row([[0, school || '']]),
        row([[0, `รายวิชา ${subject.subjectCode} ${subject.subjectName}   ชั้น ${room.className}   ${termLabel}`]]),
        row([[0, `เดือน${name} พ.ศ. ${be}`]]),
        row([[0, 'เลขที่'], [1, 'รหัสนักเรียน'], [2, 'ชื่อ - สกุล'], [first, 'วันที่'], [first + nd, 'รวม']]),
        row([...mo.dates.map((d, i) => [first + i, Number(d.slice(8, 10))]), [first + nd, 'มา'], [first + nd + 1, 'ขาด'], [first + nd + 2, 'ร้อยละ']])
      ];
      // ปพ.5: "/" = มาเรียน · "ข" = ขาด
      room.students.forEach((s) => {
        const set = mo.presentBy.get(s.id) || new Set();
        const marks = mo.dates.map(d => (set.has(d) ? PRESENT : ABSENT));
        const present = marks.filter(m => m === PRESENT).length;
        aoa.push(row([[0, s.studentNumber || ''], [1, s.studentCode], [2, s.name], ...marks.map((m, i) => [first + i, m]),
          [first + nd, present], [first + nd + 1, nd - present], [first + nd + 2, pct(present, nd)]]));
      });
      const perDay = mo.dates.map(d => room.students.filter(s => (mo.presentBy.get(s.id) || new Set()).has(d)).length);
      aoa.push(row([[2, 'จำนวนผู้มาเรียน (คน)'], ...perDay.map((n, i) => [first + i, n])]));
      aoa.push(row([[2, 'จำนวนผู้ขาดเรียน (คน)'], ...perDay.map((n, i) => [first + i, room.students.length - n])]));
      aoa.push(row([]));
      aoa.push(row([[0, `หมายเหตุ  ${PRESENT} = มาเรียน   ${ABSENT} = ขาดเรียน   (นับเฉพาะวันที่มีการเช็คชื่อในรายวิชานี้ เดือน${short})`]]));
      aoa.push(row([]));
      aoa.push(row([[2, 'ลงชื่อ ................................ ครูผู้สอน'], [first + Math.max(0, Math.floor(nd / 2)), 'ลงชื่อ ................................ หัวหน้างานวัดผล']]));

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const merges = [0, 1, 2, 3].map(r => ({ s: { r, c: 0 }, e: { r, c: last } }));
      merges.push({ s: { r: 4, c: first }, e: { r: 4, c: first + nd - 1 } }, { s: { r: 4, c: first + nd }, e: { r: 4, c: last } });
      for (const c of [0, 1, 2]) merges.push({ s: { r: 4, c }, e: { r: 5, c } });
      ws['!merges'] = merges.filter(m => m.e.c >= m.s.c);
      ws['!cols'] = [{ wch: 7 }, { wch: 14 }, { wch: 28 }, ...mo.dates.map(() => ({ wch: 4 })), { wch: 6 }, { wch: 6 }, { wch: 9 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName(`${room.className} ${short}${String(be).slice(2)}`, used));
    }
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildPp5Workbook, MONTHS, PRESENT, ABSENT };
