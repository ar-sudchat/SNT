// เช็คมาเรียนรายวัน (ไม่ผูกวิชา): สแกนเอกสารวิชาไหนก็ได้ = มาโรงเรียนวันนั้น · ไม่มีแถว = ไม่มา
const XLSX = require('xlsx');
const prisma = require('../config/database');
const { resolveStudent } = require('../services/scanStudent');

const todayTH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const teacherIdOf = (req) => req.user && (req.user.teacherId || (req.user.teacher && req.user.teacher.id)) || null;
const iso = (d) => d && d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

const rosterOfClass = (classId) => prisma.student.findMany({
  where: { classId, status: 'ACTIVE' },
  select: { id: true, studentCode: true, name: true, studentNumber: true, classId: true, class: { select: { className: true } } },
  orderBy: [{ studentNumber: 'asc' }, { studentCode: 'asc' }]
});
const view = (s) => ({ id: s.id, studentCode: s.studentCode, name: s.name, studentNumber: s.studentNumber, classId: s.classId, className: s.class && s.class.className });

async function classCounts(classId, date) {
  const total = await prisma.student.count({ where: { classId, status: 'ACTIVE' } });
  const present = await prisma.dayAttendance.count({ where: { date, student: { classId, status: 'ACTIVE' } } });
  return { present, absent: total - present, total };
}

async function buildSummary(q) {
  const where = { status: 'ACTIVE' };
  if (q.classId) where.id = parseInt(q.classId);
  if (q.academicYearId) where.academicYearId = parseInt(q.academicYearId);
  const classes = await prisma.class.findMany({ where, select: { id: true, className: true }, orderBy: { className: 'asc' } });
  let from = isDate(q.from) ? q.from : null, to = isDate(q.to) ? q.to : null;
  if (q.academicYearId && (!from || !to)) {
    const y = await prisma.academicYear.findUnique({ where: { id: parseInt(q.academicYearId) }, select: { startDate: true, endDate: true } });
    if (y) { from = from || iso(y.startDate); to = to || iso(y.endDate); }
  }
  const range = {};
  if (from) range.gte = from;
  if (to) range.lte = to;

  const days = [];
  const students = [];
  for (const cls of classes) {
    const roster = await rosterOfClass(cls.id);
    if (!roster.length) continue;
    const rows = await prisma.dayAttendance.findMany({ where: { studentId: { in: roster.map(s => s.id) }, ...(from || to ? { date: range } : {}) }, select: { studentId: true, date: true } });
    const byDate = new Map();
    for (const r of rows) { if (!byDate.has(r.date)) byDate.set(r.date, new Set()); byDate.get(r.date).add(r.studentId); }
    const dates = [...byDate.keys()].sort();
    for (const date of dates) days.push({ date, classId: cls.id, className: cls.className, present: byDate.get(date).size, absent: roster.length - byDate.get(date).size, total: roster.length });
    for (const s of roster) {
      const present = dates.filter(d => byDate.get(d).has(s.id)).length;
      students.push({ ...view(s), present, absent: dates.length - present, classDays: dates.length, percent: pct(present, dates.length) });
    }
  }
  days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.className.localeCompare(b.className)));
  return { from, to, days, students };
}

module.exports = {
  // สแกนเอกสารวิชาไหนก็ได้ → มาเรียนวันนี้
  async scan(req, res) {
    try {
      const date = req.body.date || todayTH();
      if (!isDate(date)) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' });
      const found = await resolveStudent(req.body);
      if (found.error) return res.status(found.status).json({ error: found.error });
      const student = found.student;
      const existing = await prisma.dayAttendance.findUnique({ where: { studentId_date: { studentId: student.id, date } } });
      if (!existing) await prisma.dayAttendance.create({ data: { studentId: student.id, date, markedById: teacherIdOf(req) } });
      res.json({ student: view(student), date, status: 'PRESENT', alreadyMarked: !!existing, counts: await classCounts(student.classId, date) });
    } catch (error) {
      console.error('Day attendance scan error:', error);
      res.status(500).json({ error: 'บันทึกการมาเรียนไม่สำเร็จ' });
    }
  },

  async sheet(req, res) {
    try {
      const date = req.query.date || todayTH();
      const classId = parseInt(req.query.classId);
      if (!isDate(date)) return res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' });
      if (!classId) return res.status(400).json({ error: 'กรุณาเลือกห้อง' });
      const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, className: true } });
      if (!cls) return res.status(404).json({ error: 'ไม่พบห้องเรียน' });
      const roster = await rosterOfClass(classId);
      const rows = await prisma.dayAttendance.findMany({ where: { date, studentId: { in: roster.map(s => s.id) } }, select: { studentId: true } });
      const here = new Set(rows.map(r => r.studentId));
      res.json({ cls, date, students: roster.map(s => ({ ...view(s), status: here.has(s.id) ? 'PRESENT' : null })), counts: await classCounts(classId, date) });
    } catch (error) {
      console.error('Day attendance sheet error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // ติ๊กด้วยมือ: present true = มา · false = ล้าง (กลับเป็นไม่มา)
  async mark(req, res) {
    try {
      const date = req.body.date || todayTH();
      const studentId = parseInt(req.body.studentId);
      if (!isDate(date) || !studentId) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง' });
      const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, classId: true } });
      if (!student) return res.status(404).json({ error: 'ไม่พบนักเรียน' });
      if (req.body.present) {
        await prisma.dayAttendance.upsert({ where: { studentId_date: { studentId, date } }, create: { studentId, date, markedById: teacherIdOf(req) }, update: {} });
      } else {
        await prisma.dayAttendance.deleteMany({ where: { studentId, date } });
      }
      res.json({ studentId, counts: await classCounts(student.classId, date) });
    } catch (error) {
      console.error('Day attendance mark error:', error);
      res.status(500).json({ error: 'บันทึกไม่สำเร็จ' });
    }
  },

  async summary(req, res) {
    try { res.json(await buildSummary(req.query)); } catch (error) {
      console.error('Day attendance summary error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  async exportXlsx(req, res) {
    try {
      const s = await buildSummary(req.query);
      if (!s.days.length) return res.status(404).json({ error: 'ไม่มีข้อมูลการมาเรียนให้ส่งออก' });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.days.map(d => ({ 'วันที่': d.date, 'ห้อง': d.className, 'มา': d.present, 'ไม่มา': d.absent, 'ทั้งหมด': d.total }))), 'รายวัน');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.students.map(x => ({ 'รหัส': x.studentCode, 'เลขที่': x.studentNumber || '', 'ชื่อ': x.name, 'ห้อง': x.className, 'มา': x.present, 'ไม่มา': x.absent, 'จำนวนวัน': x.classDays, '% มา': x.percent }))), 'รายบุคคล');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=day-attendance.xlsx');
      res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    } catch (error) {
      console.error('Day attendance export error:', error);
      res.status(500).json({ error: 'ส่งออกข้อมูลไม่สำเร็จ' });
    }
  }
};
