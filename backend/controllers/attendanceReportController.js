// รายงานเวลาเรียนรายเดือน (กราฟ · % รายวิชา/รายคน · รายชื่อขาดบ่อย) และส่งออก ปพ.5 (เวลาเรียน)
// อ่านข้อมูลชุดเดียวกับ attendanceController (ตาราง Attendance) · ไม่มีแถว = ไม่มา ตามที่ buildSummary นับ
const prisma = require('../config/database');
const { buildPp5Workbook } = require('../services/attendanceReportExport');

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const teacherIdOf = (req) => req.user && (req.user.teacherId || (req.user.teacher && req.user.teacher.id)) || null;
const seesAll = (req) => !!(req.user && (req.user.role === 'ADMIN' || req.user.canManage));
const intIn = (v, def, min, max) => { const n = parseInt(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };

// สำเนาตรรกะ rosterOf / visibleSubjects ของ attendanceController (ไฟล์นั้นไม่ export ฟังก์ชันเหล่านี้)
async function rosterOf(subject, classId) {
  const where = { status: 'ACTIVE' };
  const cls = {};
  if (subject.gradeId) {
    cls.gradeId = subject.gradeId;
    if (subject.academicYearId) cls.academicYearId = subject.academicYearId;
  } else {
    where.qrcodes = { some: { subjectId: subject.id } };
  }
  if (classId) cls.id = classId;
  if (Object.keys(cls).length) where.class = cls;
  return prisma.student.findMany({
    where,
    select: { id: true, studentCode: true, name: true, studentNumber: true, classId: true, class: { select: { className: true } } },
    orderBy: [{ classId: 'asc' }, { studentNumber: 'asc' }, { studentCode: 'asc' }]
  });
}

async function visibleSubjects(req, { subjectId, academicYearId }) {
  const where = { status: 'ACTIVE' };
  if (subjectId) where.id = parseInt(subjectId);
  if (academicYearId) where.academicYearId = parseInt(academicYearId);
  if (!seesAll(req)) where.teacherId = teacherIdOf(req) || -1;
  return prisma.subject.findMany({ where, select: { id: true, subjectCode: true, subjectName: true, gradeId: true, academicYearId: true }, orderBy: { subjectCode: 'asc' } });
}

const monthRange = (ym) => ({ from: `${ym}-01`, to: `${ym}-31` });
const monthsBetween = (from, to) => {
  const out = [];
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7));
  const end = to.slice(0, 7);
  while (out.length < 24) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    if (ym > end) break;
    out.push(ym);
    if (++m > 12) { m = 1; y += 1; }
  }
  return out;
};

// วันที่มีเรียน (มีการเช็คชื่ออย่างน้อย 1 แถวของนักเรียนในรายชื่อ) + ใครมาวันไหน
async function attendanceOf(subjectId, studentIds, from, to) {
  const rows = studentIds.length ? await prisma.attendance.findMany({
    where: { subjectId, studentId: { in: studentIds }, date: { gte: from, lte: to } },
    select: { studentId: true, date: true, status: true }
  }) : [];
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, new Set());
    if (r.status === 'PRESENT') byDate.get(r.date).add(r.studentId);
  }
  return { dates: [...byDate.keys()].sort(), byDate };
}

const reportController = {
  // GET /attendance/monthly?month=YYYY-MM&subjectId&classId&academicYearId&threshold=80&streak=3&absentLimit=5
  async monthly(req, res) {
    try {
      const q = req.query;
      if (!MONTH_RE.test(q.month || '')) return res.status(400).json({ error: 'เดือนไม่ถูกต้อง (ใช้รูปแบบ ปปปป-ดด)' });
      const threshold = intIn(q.threshold, 80, 1, 100);
      const streak = intIn(q.streak, 3, 1, 31);
      const absentLimit = intIn(q.absentLimit, 5, 1, 99);
      const classId = q.classId ? parseInt(q.classId) : null;
      const { from, to } = monthRange(q.month);
      const subjects = await visibleSubjects(req, q);

      const subjectStats = [];
      const perStudent = new Map();
      const perDate = new Map();
      for (const subject of subjects) {
        const roster = await rosterOf(subject, classId);
        if (!roster.length) continue;
        const { dates, byDate } = await attendanceOf(subject.id, roster.map(s => s.id), from, to);
        if (!dates.length) continue;
        let presentSum = 0;
        for (const date of dates) {
          const present = byDate.get(date).size;
          presentSum += present;
          const d = perDate.get(date) || { date, present: 0, total: 0 };
          d.present += present; d.total += roster.length;
          perDate.set(date, d);
        }
        subjectStats.push({ id: subject.id, subjectCode: subject.subjectCode, subjectName: subject.subjectName, classDays: dates.length, students: roster.length, present: presentSum, absent: dates.length * roster.length - presentSum, percent: pct(presentSum, dates.length * roster.length) });
        for (const s of roster) {
          const cur = perStudent.get(s.id) || { id: s.id, studentCode: s.studentCode, name: s.name, studentNumber: s.studentNumber, classId: s.classId, className: s.class && s.class.className, present: 0, absent: 0, classDays: 0, maxStreak: 0, maxSubjectAbsent: 0, subjects: [] };
          let p = 0, a = 0, run = 0, best = 0;
          for (const date of dates) {
            if (byDate.get(date).has(s.id)) { p += 1; run = 0; } else { a += 1; run += 1; best = Math.max(best, run); }
          }
          cur.present += p; cur.absent += a; cur.classDays += dates.length;
          cur.maxStreak = Math.max(cur.maxStreak, best);
          cur.maxSubjectAbsent = Math.max(cur.maxSubjectAbsent, a);
          cur.subjects.push({ subjectId: subject.id, subjectName: subject.subjectName, present: p, absent: a, classDays: dates.length, percent: pct(p, dates.length), streak: best });
          perStudent.set(s.id, cur);
        }
      }
      const students = [...perStudent.values()].map(s => {
        const percent = pct(s.present, s.classDays);
        const low = percent < threshold;
        const frequent = s.maxStreak >= streak || s.maxSubjectAbsent >= absentLimit;
        return { ...s, percent, low, frequent };
      }).sort((a, b) => (a.classId - b.classId) || ((a.studentNumber || 0) - (b.studentNumber || 0)) || a.studentCode.localeCompare(b.studentCode));
      const days = [...perDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).map(d => ({ ...d, percent: pct(d.present, d.total) }));
      const frequentAbsent = students.filter(s => s.frequent || s.low)
        .sort((a, b) => (b.frequent - a.frequent) || (b.maxStreak - a.maxStreak) || (a.percent - b.percent));
      res.json({ month: q.month, from, to, threshold, streak, absentLimit, subjects: subjectStats, students, days, frequentAbsent });
    } catch (error) {
      console.error('Attendance monthly error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // GET /attendance/pp5-export?subjectId=&month=YYYY-MM | from=&to= &classId=  → 1 ชีตต่อห้อง×เดือน
  async pp5Export(req, res) {
    try {
      const q = req.query;
      if (!q.subjectId) return res.status(400).json({ error: 'กรุณาเลือกวิชา' });
      let from, to;
      if (q.month) {
        if (!MONTH_RE.test(q.month)) return res.status(400).json({ error: 'เดือนไม่ถูกต้อง (ใช้รูปแบบ ปปปป-ดด)' });
        ({ from, to } = monthRange(q.month));
      } else if (isDate(q.from) && isDate(q.to) && q.from <= q.to) {
        from = q.from; to = q.to;
      } else {
        return res.status(400).json({ error: 'กรุณาเลือกเดือนหรือช่วงวันที่' });
      }
      const [subject] = await visibleSubjects(req, { subjectId: q.subjectId });
      if (!subject) return res.status(404).json({ error: 'ไม่พบข้อมูลวิชา' });
      const classId = q.classId ? parseInt(q.classId) : null;
      const roster = await rosterOf(subject, classId);
      const { byDate } = await attendanceOf(subject.id, roster.map(s => s.id), from, to);

      const byClass = new Map();
      for (const s of roster) {
        if (!byClass.has(s.classId)) byClass.set(s.classId, { className: (s.class && s.class.className) || '-', students: [] });
        byClass.get(s.classId).students.push(s);
      }
      const rooms = [];
      for (const room of byClass.values()) {
        const ids = new Set(room.students.map(s => s.id));
        // วันที่มีเรียนของห้องนี้ = วันที่มีการเช็คชื่อนักเรียนห้องนี้ (ดูจาก byDate ซึ่งรวมเฉพาะแถวที่มี)
        const rows = await prisma.attendance.findMany({ where: { subjectId: subject.id, studentId: { in: [...ids] }, date: { gte: from, lte: to } }, select: { date: true } });
        const roomDates = [...new Set(rows.map(r => r.date))].sort();
        const months = [];
        for (const ym of monthsBetween(from, to)) {
          const dates = roomDates.filter(d => d.startsWith(ym));
          if (!dates.length) continue;
          const presentBy = new Map();
          for (const s of room.students) presentBy.set(s.id, new Set(dates.filter(d => byDate.has(d) && byDate.get(d).has(s.id))));
          months.push({ ym, dates, presentBy });
        }
        if (months.length) rooms.push({ className: room.className, students: room.students, months });
      }
      if (!rooms.length) return res.status(404).json({ error: 'ไม่มีข้อมูลการเช็คชื่อในช่วงนี้' });

      const tid = req.tenantId || (req.user && req.user.tid);
      const [tenant, year] = await Promise.all([
        tid ? prisma.tenant.findUnique({ where: { id: tid }, select: { name: true, docSettings: true } }).catch(() => null) : null,
        subject.academicYearId ? prisma.academicYear.findUnique({ where: { id: subject.academicYearId }, select: { year: true, name: true } }) : null
      ]);
      const saved = tenant && tenant.docSettings && typeof tenant.docSettings === 'object' ? tenant.docSettings : {};
      const school = (typeof saved.schoolName === 'string' && saved.schoolName) || (tenant && tenant.name) || '';
      const termLabel = year ? `ปีการศึกษา ${year.year}` : '';
      const buf = buildPp5Workbook({ school, subject, termLabel, rooms });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=pp5-attendance.xlsx');
      res.send(buf);
    } catch (error) {
      console.error('Attendance pp5 export error:', error);
      res.status(500).json({ error: 'ส่งออกข้อมูลไม่สำเร็จ' });
    }
  }
};

module.exports = reportController;
