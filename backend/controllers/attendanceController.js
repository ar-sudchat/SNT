// เช็คการเข้าเรียนรายวิชา · สแกน QR เล่มไหนของนักเรียนก็ได้ · สรุปรายวัน/รายบุคคล/รายปีการศึกษา · export Excel
const XLSX = require('xlsx');
const prisma = require('../config/database');
const { assertTeacherOwnsSubject } = require('../middleware/ownership');
const { resolveStudent } = require('../services/scanStudent');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayTH = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
const isDate = (s) => typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

const teacherIdOf = (req) => req.user && (req.user.teacherId || (req.user.teacher && req.user.teacher.id)) || null;
const seesAll = (req) => !!(req.user && (req.user.role === 'ADMIN' || req.user.canManage));

// รายชื่อนักเรียนของวิชา: ชั้นเดียวกับวิชา (และปีการศึกษาเดียวกันถ้าระบุ) · วิชาที่ไม่ระบุชั้น = คนที่มี QR ของวิชานั้น
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

const studentView = (s) => ({ id: s.id, studentCode: s.studentCode, name: s.name, studentNumber: s.studentNumber, classId: s.classId, className: s.class && s.class.className });

async function loadSubject(req, res, subjectId) {
  const id = parseInt(subjectId);
  if (!id) { res.status(400).json({ error: 'กรุณาเลือกวิชา' }); return null; }
  const denied = await assertTeacherOwnsSubject(req, id);
  if (denied) { res.status(denied.status).json({ error: denied.error }); return null; }
  const subject = await prisma.subject.findUnique({ where: { id }, select: { id: true, subjectCode: true, subjectName: true, gradeId: true, academicYearId: true } });
  if (!subject) { res.status(404).json({ error: 'ไม่พบข้อมูลวิชา' }); return null; }
  return subject;
}

const readDate = (res, raw) => {
  const date = raw || todayTH();
  if (!isDate(date)) { res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' }); return null; }
  return date;
};

const countsOf = async (subjectId, date, roster) => {
  const ids = roster.map(s => s.id);
  const present = await prisma.attendance.count({ where: { subjectId, date, status: 'PRESENT', studentId: { in: ids } } });
  return { present, total: ids.length };
};

// วิชาที่ผู้ใช้เข้าถึงได้ (ครู = วิชาตัวเอง · แอดมิน/ผู้จัดการ = ทั้งหมด) ตามปีการศึกษาที่เลือก
async function visibleSubjects(req, { subjectId, academicYearId }) {
  const where = { status: 'ACTIVE' };
  if (subjectId) where.id = parseInt(subjectId);
  if (academicYearId) where.academicYearId = parseInt(academicYearId);
  if (!seesAll(req)) where.teacherId = teacherIdOf(req) || -1;
  return prisma.subject.findMany({ where, select: { id: true, subjectCode: true, subjectName: true, gradeId: true, academicYearId: true }, orderBy: { subjectCode: 'asc' } });
}

async function rangeOf(academicYearId, from, to) {
  let start = from, end = to;
  if (academicYearId && (!start || !end)) {
    const y = await prisma.academicYear.findUnique({ where: { id: parseInt(academicYearId) }, select: { startDate: true, endDate: true } });
    const iso = (d) => d && d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    if (y) { start = start || iso(y.startDate); end = end || iso(y.endDate); }
  }
  return { from: isDate(start) ? start : null, to: isDate(end) ? end : null };
}

// รวมข้อมูลสรุป: รายวัน (วิชา × วัน) + รายบุคคล (รวมทุกวิชาที่เลือก)
async function buildSummary(req, q) {
  const subjects = await visibleSubjects(req, q);
  const { from, to } = await rangeOf(q.academicYearId, q.from, q.to);
  const classId = q.classId ? parseInt(q.classId) : null;
  const dateWhere = {};
  if (from) dateWhere.gte = from;
  if (to) dateWhere.lte = to;

  const days = [];
  const perStudent = new Map();
  for (const subject of subjects) {
    const roster = await rosterOf(subject, classId);
    if (!roster.length) continue;
    const ids = roster.map(s => s.id);
    const rows = await prisma.attendance.findMany({
      where: { subjectId: subject.id, studentId: { in: ids }, ...(from || to ? { date: dateWhere } : {}) },
      select: { studentId: true, date: true, status: true }
    });
    const byDate = new Map();
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, new Set());
      if (r.status === 'PRESENT') byDate.get(r.date).add(r.studentId);
      else byDate.get(r.date);
    }
    const dates = [...byDate.keys()].sort();
    for (const date of dates) {
      const present = byDate.get(date).size;
      days.push({ date, subjectId: subject.id, subjectName: subject.subjectName, subjectCode: subject.subjectCode, present, absent: roster.length - present, total: roster.length });
    }
    for (const s of roster) {
      const cur = perStudent.get(s.id) || { ...studentView(s), present: 0, absent: 0, classDays: 0 };
      for (const date of dates) {
        cur.classDays += 1;
        if (byDate.get(date).has(s.id)) cur.present += 1; else cur.absent += 1;
      }
      perStudent.set(s.id, cur);
    }
  }
  days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.subjectCode.localeCompare(b.subjectCode)));
  const students = [...perStudent.values()].map(s => ({ ...s, percent: pct(s.present, s.classDays) }));
  students.sort((a, b) => (a.classId - b.classId) || ((a.studentNumber || 0) - (b.studentNumber || 0)) || a.studentCode.localeCompare(b.studentCode));
  return { from, to, subjects: subjects.map(s => ({ id: s.id, subjectName: s.subjectName })), days, students };
}

const attendanceController = {
  // สแกน QR (หรือพิมพ์รหัสนักเรียน) → บันทึก "มา"
  // แบบเลือกวิชาเอง: ส่ง subjectId มา = สแกน QR เล่มไหนของนักเรียนก็ได้ นับเข้าวิชาที่เลือก
  // แบบสแกนเล่มวิชา: ไม่ส่ง subjectId = ใช้วิชาของ QR ที่สแกน (แบบมาเรียนรายวันอยู่ใน dayAttendanceController)
  async scan(req, res) {
    try {
      const { qrcodeData, studentCode } = req.body;
      const date = readDate(res, req.body.date);
      if (!date) return;

      const found = await resolveStudent({ qrcodeData, studentCode });
      if (found.error) return res.status(found.status).json({ error: found.error });
      const student = found.student;
      let subjectId = req.body.subjectId ? parseInt(req.body.subjectId) : null;
      if (!subjectId && found.qr) subjectId = found.qr.subjectId;
      if (!subjectId) return res.status(400).json({ error: 'กรุณาเลือกวิชาก่อนสแกน' });

      const subject = await loadSubject(req, res, subjectId);
      if (!subject) return;
      if (subject.gradeId && student.class.gradeId !== subject.gradeId) {
        return res.status(400).json({ error: `${student.name} ไม่ได้อยู่ในชั้นของวิชา ${subject.subjectName}` });
      }

      const existing = await prisma.attendance.findUnique({ where: { studentId_subjectId_date: { studentId: student.id, subjectId: subject.id, date } } });
      const alreadyMarked = !!existing && existing.status === 'PRESENT';
      if (!alreadyMarked) {
        await prisma.attendance.upsert({
          where: { studentId_subjectId_date: { studentId: student.id, subjectId: subject.id, date } },
          create: { studentId: student.id, subjectId: subject.id, date, status: 'PRESENT', markedById: teacherIdOf(req) },
          update: { status: 'PRESENT', markedById: teacherIdOf(req) }
        });
      }
      const roster = await rosterOf(subject, null);
      res.json({
        student: studentView(student),
        subject: { id: subject.id, subjectName: subject.subjectName, subjectCode: subject.subjectCode },
        date, status: 'PRESENT', alreadyMarked,
        counts: await countsOf(subject.id, date, roster)
      });
    } catch (error) {
      console.error('Attendance scan error:', error);
      res.status(500).json({ error: 'บันทึกการเข้าเรียนไม่สำเร็จ' });
    }
  },

  // กระดานเช็คชื่อของวิชา+วัน: นักเรียนทุกคน พร้อมสถานะ (null = ยังไม่ได้เช็ค)
  async sheet(req, res) {
    try {
      const date = readDate(res, req.query.date);
      if (!date) return;
      const subject = await loadSubject(req, res, req.query.subjectId);
      if (!subject) return;
      const classId = req.query.classId ? parseInt(req.query.classId) : null;
      const roster = await rosterOf(subject, classId);
      const rows = await prisma.attendance.findMany({ where: { subjectId: subject.id, date, studentId: { in: roster.map(s => s.id) } }, select: { studentId: true, status: true } });
      const status = new Map(rows.map(r => [r.studentId, r.status]));
      const students = roster.map(s => ({ ...studentView(s), status: status.get(s.id) || null }));
      const present = students.filter(s => s.status === 'PRESENT').length;
      const absent = students.filter(s => s.status === 'ABSENT').length;
      res.json({ subject, date, students, counts: { present, absent, unchecked: students.length - present - absent, total: students.length } });
    } catch (error) {
      console.error('Attendance sheet error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // ติ๊กทีละคน: status = PRESENT | ABSENT | null (ล้างสถานะ)
  async mark(req, res) {
    try {
      const date = readDate(res, req.body.date);
      if (!date) return;
      const subject = await loadSubject(req, res, req.body.subjectId);
      if (!subject) return;
      const studentId = parseInt(req.body.studentId);
      const { status } = req.body;
      if (!studentId) return res.status(400).json({ error: 'กรุณาเลือกนักเรียน' });
      if (status !== null && status !== 'PRESENT' && status !== 'ABSENT') return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      const roster = await rosterOf(subject, null);
      if (!roster.some(s => s.id === studentId)) return res.status(400).json({ error: 'นักเรียนคนนี้ไม่ได้อยู่ในวิชานี้' });
      const key = { studentId_subjectId_date: { studentId, subjectId: subject.id, date } };
      if (status === null) {
        await prisma.attendance.deleteMany({ where: { studentId, subjectId: subject.id, date } });
      } else {
        await prisma.attendance.upsert({
          where: key,
          create: { studentId, subjectId: subject.id, date, status, markedById: teacherIdOf(req) },
          update: { status, markedById: teacherIdOf(req) }
        });
      }
      res.json({ studentId, status, counts: await countsOf(subject.id, date, roster) });
    } catch (error) {
      console.error('Attendance mark error:', error);
      res.status(500).json({ error: 'บันทึกไม่สำเร็จ' });
    }
  },

  // ปิดคาบ: คนที่ยังไม่ได้เช็คทั้งหมด = ไม่มา
  async close(req, res) {
    try {
      const date = readDate(res, req.body.date);
      if (!date) return;
      const subject = await loadSubject(req, res, req.body.subjectId);
      if (!subject) return;
      const classId = req.body.classId ? parseInt(req.body.classId) : null;
      const roster = await rosterOf(subject, classId);
      const done = await prisma.attendance.findMany({ where: { subjectId: subject.id, date, studentId: { in: roster.map(s => s.id) } }, select: { studentId: true } });
      const have = new Set(done.map(r => r.studentId));
      const todo = roster.filter(s => !have.has(s.id));
      if (todo.length) {
        await prisma.attendance.createMany({ data: todo.map(s => ({ studentId: s.id, subjectId: subject.id, date, status: 'ABSENT', markedById: teacherIdOf(req) })), skipDuplicates: true });
      }
      res.json({ absentMarked: todo.length, counts: await countsOf(subject.id, date, await rosterOf(subject, null)) });
    } catch (error) {
      console.error('Attendance close error:', error);
      res.status(500).json({ error: 'ปิดคาบไม่สำเร็จ' });
    }
  },

  async summary(req, res) {
    try {
      res.json(await buildSummary(req, req.query));
    } catch (error) {
      console.error('Attendance summary error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  async exportXlsx(req, res) {
    try {
      const s = await buildSummary(req, req.query);
      if (!s.days.length) return res.status(404).json({ error: 'ไม่มีข้อมูลการเข้าเรียนให้ส่งออก' });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.days.map(d => ({
        'วันที่': d.date, 'รหัสวิชา': d.subjectCode, 'วิชา': d.subjectName, 'มา': d.present, 'ไม่มา': d.absent, 'ทั้งหมด': d.total
      }))), 'รายวัน');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.students.map(x => ({
        'รหัส': x.studentCode, 'เลขที่': x.studentNumber || '', 'ชื่อ': x.name, 'ห้อง': x.className, 'มา': x.present, 'ไม่มา': x.absent, 'จำนวนคาบ': x.classDays, '% มา': x.percent
      }))), 'รายบุคคล');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');
      res.send(buf);
    } catch (error) {
      console.error('Attendance export error:', error);
      res.status(500).json({ error: 'ส่งออกข้อมูลไม่สำเร็จ' });
    }
  }
};

module.exports = attendanceController;
