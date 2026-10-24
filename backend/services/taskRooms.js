// งานลงได้หลายห้องในชั้นเดียวกัน: ไม่มีแถว TaskRoom = ทุกห้องของชั้น (งานเดิมทั้งหมดเป็นแบบนี้)
const prisma = require('../config/database');

const ROOMS = { rooms: { select: { classId: true } } };

const roomIdsOf = (task) => (task && task.rooms && task.rooms.length ? task.rooms.map(r => r.classId) : null);
const appliesTo = (task, classId) => {
  const ids = roomIdsOf(task);
  return !ids || ids.includes(Number(classId));
};

// classIds ที่ส่งมา: ไม่ส่ง/ว่าง = ทุกห้อง · ต้องเป็นห้องของชั้นวิชานี้ · เลือกครบทุกห้อง = เก็บเป็น "ทุกห้อง"
async function cleanRoomIds(subjectId, classIds) {
  if (classIds === undefined || classIds === null) return { ids: [] };
  if (!Array.isArray(classIds) || classIds.some(id => !Number.isInteger(id))) return { error: 'ห้องที่เลือกไม่ถูกต้อง' };
  const ids = [...new Set(classIds)];
  if (!ids.length) return { ids: [] };
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { gradeId: true, academicYearId: true } });
  if (!subject || !subject.gradeId) return { error: 'วิชานี้ยังไม่ได้ระบุชั้น จึงเลือกห้องไม่ได้ (ตั้งชั้นของวิชาก่อน)' };
  const where = { gradeId: subject.gradeId, status: 'ACTIVE' };
  if (subject.academicYearId) where.academicYearId = subject.academicYearId;
  const rooms = await prisma.class.findMany({ where, select: { id: true } });
  const allowed = new Set(rooms.map(r => r.id));
  if (ids.some(id => !allowed.has(id))) return { error: 'เลือกได้เฉพาะห้องของชั้นเดียวกับวิชา' };
  return { ids: ids.length === allowed.size ? [] : ids };
}

async function setRooms(taskId, ids) {
  await prisma.taskRoom.deleteMany({ where: { taskId } });
  if (ids.length) await prisma.taskRoom.createMany({ data: ids.map(classId => ({ taskId, classId })) });
}

module.exports = { ROOMS, roomIdsOf, appliesTo, cleanRoomIds, setRooms };
