const express = require('express');
const { authenticate, isTeacher } = require('../middleware/auth');
const prisma = require('../config/database');
const { assertTeacherOwnsSubject } = require('../middleware/ownership');
const { notifyAbsent } = require('../services/absenceNotify');

const router = express.Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const teacherIdOf = (req) => (req.user && (req.user.teacherId || (req.user.teacher && req.user.teacher.id))) || null;

async function guard(req, res, subjectId, date) {
  const sid = parseInt(subjectId);
  if (!sid) { res.status(400).json({ error: 'กรุณาเลือกวิชา' }); return null; }
  if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(Date.parse(date))) { res.status(400).json({ error: 'วันที่ไม่ถูกต้อง' }); return null; }
  const denied = await assertTeacherOwnsSubject(req, sid);
  if (denied) { res.status(denied.status).json({ error: denied.error }); return null; }
  return sid;
}

// แจ้งผู้ปกครองของนักเรียนที่ไม่มาในวิชา/วันนั้น
router.post('/', authenticate, isTeacher, async (req, res) => {
  try {
    const subjectId = await guard(req, res, req.body && req.body.subjectId, req.body && req.body.date);
    if (!subjectId) return;
    res.json(await notifyAbsent({ subjectId, date: req.body.date, createdById: teacherIdOf(req) }));
  } catch (e) {
    console.error('absence notice error:', e);
    res.status(500).json({ error: 'แจ้งผู้ปกครองไม่สำเร็จ' });
  }
});

// จำนวนที่แจ้งไปแล้ว (ให้หน้าเช็คชื่อแสดงสถานะ)
router.get('/', authenticate, isTeacher, async (req, res) => {
  try {
    const subjectId = await guard(req, res, req.query.subjectId, req.query.date);
    if (!subjectId) return;
    res.json({ notified: await prisma.absenceNotice.count({ where: { subjectId, date: req.query.date } }) });
  } catch (e) {
    console.error('absence notice count error:', e);
    res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
  }
});

module.exports = router;
