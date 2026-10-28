// สรุปการส่งงานของวันหนึ่ง: วันนี้ส่งกี่คน แยกตามวิชา และตามงาน · export Excel
const XLSX = require('xlsx');
const prisma = require('../config/database');
const { appliesTo, ROOMS } = require('../services/taskRooms');

const todayTH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const teacherIdOf = (req) => req.user && (req.user.teacherId || (req.user.teacher && req.user.teacher.id)) || null;
const seesAll = (req) => !!(req.user && (req.user.role === 'ADMIN' || req.user.canManage));

// subjects[] → tasks[] พร้อมจำนวนคนที่ "ส่งในวันนั้น" และจำนวนนักเรียนที่ได้รับงาน
async function build(req, q) {
  const date = q.date || todayTH();
  if (!isDate(date)) return { error: 'วันที่ไม่ถูกต้อง' };
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  const subjectWhere = { status: 'ACTIVE' };
  if (q.subjectId) subjectWhere.id = parseInt(q.subjectId);
  if (!seesAll(req)) subjectWhere.teacherId = teacherIdOf(req) || -1;
  const subjects = await prisma.subject.findMany({
    where: subjectWhere,
    select: { id: true, subjectCode: true, subjectName: true, gradeId: true, academicYearId: true, tasks: { where: { status: 'ACTIVE' }, orderBy: { taskNumber: 'asc' }, include: ROOMS } },
    orderBy: { subjectCode: 'asc' }
  });

  const taskIds = subjects.flatMap(s => s.tasks.map(t => t.id));
  const subs = await prisma.submission.findMany({
    where: { taskId: { in: taskIds }, status: { not: 'NOT_SUBMITTED' }, submitDate: { gte: start, lt: end } },
    select: { taskId: true, studentId: true }
  });
  const sentByTask = new Map();
  for (const s of subs) {
    if (!sentByTask.has(s.taskId)) sentByTask.set(s.taskId, new Set());
    sentByTask.get(s.taskId).add(s.studentId);
  }

  const out = [];
  for (const subject of subjects) {
    const classes = subject.gradeId
      ? await prisma.class.findMany({
          where: { gradeId: subject.gradeId, status: 'ACTIVE', ...(subject.academicYearId ? { academicYearId: subject.academicYearId } : {}) },
          select: { id: true, _count: { select: { students: { where: { status: 'ACTIVE' } } } } }
        })
      : [];
    const tasks = subject.tasks.map(t => ({
      taskId: t.id, taskNumber: t.taskNumber, taskName: t.taskName,
      count: (sentByTask.get(t.id) || new Set()).size,
      total: classes.filter(c => appliesTo(t, c.id)).reduce((n, c) => n + c._count.students, 0)
    }));
    const students = new Set();
    for (const t of subject.tasks) for (const id of (sentByTask.get(t.id) || [])) students.add(id);
    out.push({
      subjectId: subject.id, subjectCode: subject.subjectCode, subjectName: subject.subjectName,
      students: students.size, // นักเรียนที่ส่งอย่างน้อย 1 งานในวันนั้น
      pieces: tasks.reduce((n, t) => n + t.count, 0), // จำนวนชิ้นที่ส่ง
      tasks
    });
  }
  return { date, subjects: out, totals: { students: out.reduce((n, s) => n + s.students, 0), pieces: out.reduce((n, s) => n + s.pieces, 0) } };
}

module.exports = {
  async daySubmissions(req, res) {
    try {
      const r = await build(req, req.query);
      if (r.error) return res.status(400).json({ error: r.error });
      res.json(r);
    } catch (error) {
      console.error('Day submissions error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  async exportDaySubmissions(req, res) {
    try {
      const r = await build(req, req.query);
      if (r.error) return res.status(400).json({ error: r.error });
      const rows = r.subjects.flatMap(s => s.tasks.map(t => ({
        'วันที่': r.date, 'รหัสวิชา': s.subjectCode, 'วิชา': s.subjectName, 'งานที่': t.taskNumber, 'งาน': t.taskName, 'ส่งวันนี้ (คน)': t.count, 'นักเรียนที่ได้รับงาน': t.total
      })));
      if (!rows.length) return res.status(404).json({ error: 'ไม่มีข้อมูลให้ส่งออก' });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'ส่งงานรายวัน');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r.subjects.map(s => ({
        'วันที่': r.date, 'รหัสวิชา': s.subjectCode, 'วิชา': s.subjectName, 'นักเรียนที่ส่ง (คน)': s.students, 'จำนวนชิ้น': s.pieces
      }))), 'รายวิชา');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=day-submissions.xlsx');
      res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    } catch (error) {
      console.error('Export day submissions error:', error);
      res.status(500).json({ error: 'ส่งออกข้อมูลไม่สำเร็จ' });
    }
  }
};
