const prisma = require('../config/database');

const FORBIDDEN_MSG = 'คุณไม่มีสิทธิ์จัดการข้อมูลของวิชานี้ (ไม่ใช่ครูผู้สอน)';

// Returns null when allowed, otherwise { status, error }. ADMIN and group managers (canManage) bypass.
async function assertTeacherOwnsSubject(req, subjectId) {
  if (req.user && (req.user.role === 'ADMIN' || req.user.canManage)) return null;
  const teacherId = req.user && (req.user.teacherId || (req.user.teacher && req.user.teacher.id));
  if (!teacherId) return { status: 403, error: FORBIDDEN_MSG };
  const subject = await prisma.subject.findUnique({
    where: { id: parseInt(subjectId) },
    select: { teacherId: true }
  });
  if (!subject) return { status: 404, error: 'ไม่พบข้อมูลวิชา' };
  if (subject.teacherId !== teacherId) return { status: 403, error: FORBIDDEN_MSG };
  return null;
}

async function assertTeacherOwnsTask(req, taskId) {
  if (req.user && (req.user.role === 'ADMIN' || req.user.canManage)) return null;
  const task = await prisma.task.findUnique({ where: { id: parseInt(taskId) }, select: { subjectId: true } });
  if (!task) return { status: 404, error: 'ไม่พบข้อมูลงาน' };
  return assertTeacherOwnsSubject(req, task.subjectId);
}

module.exports = { assertTeacherOwnsSubject, assertTeacherOwnsTask, FORBIDDEN_MSG };
