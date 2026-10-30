// แจ้งผู้ปกครองเมื่อนักเรียนไม่มาเรียน · เก็บเป็นรายการ AbsenceNotice แล้วโชว์ในลิงก์ผู้ปกครอง (/p/:token)
const prisma = require('../config/database');

const SHOW_DAYS = 30;

// สร้างรายการแจ้งของนักเรียนที่ "ไม่มา" ในวิชา/วันนั้น (ซ้ำได้ ไม่สร้างซ้ำ) · คืนจำนวนที่แจ้งทั้งหมดของวิชา/วัน
async function notifyAbsent({ subjectId, date, createdById = null, studentIds = null }) {
  const where = { subjectId, date, status: 'ABSENT' };
  if (Array.isArray(studentIds)) where.studentId = { in: studentIds };
  const absent = await prisma.attendance.findMany({ where, select: { studentId: true } });
  let created = 0;
  if (absent.length) {
    const r = await prisma.absenceNotice.createMany({
      data: absent.map(a => ({ studentId: a.studentId, subjectId, date, createdById })),
      skipDuplicates: true
    });
    created = r.count;
  }
  const notified = await prisma.absenceNotice.count({ where: { subjectId, date } });
  return { absent: absent.length, created, notified };
}

// รายการที่ผู้ปกครองเห็น: ย้อนหลัง SHOW_DAYS วัน และต้องยังเป็น "ไม่มา" อยู่ (ครูแก้เป็นมาแล้ว = ไม่แสดง)
async function noticesForStudent(studentId, now = new Date()) {
  const since = new Date(now.getTime() - SHOW_DAYS * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const rows = await prisma.absenceNotice.findMany({
    where: { studentId, date: { gte: since } },
    select: { date: true, subjectId: true, subject: { select: { subjectName: true } } },
    orderBy: [{ date: 'desc' }, { id: 'desc' }]
  });
  if (!rows.length) return [];
  const att = await prisma.attendance.findMany({
    where: { studentId, status: 'ABSENT', subjectId: { in: [...new Set(rows.map(r => r.subjectId))] }, date: { in: [...new Set(rows.map(r => r.date))] } },
    select: { subjectId: true, date: true }
  });
  const still = new Set(att.map(a => `${a.subjectId}|${a.date}`));
  return rows.filter(r => still.has(`${r.subjectId}|${r.date}`)).map(r => ({ date: r.date, subjectName: r.subject && r.subject.subjectName }));
}

module.exports = { notifyAbsent, noticesForStudent, SHOW_DAYS };
