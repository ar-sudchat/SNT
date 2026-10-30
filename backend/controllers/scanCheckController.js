// สแกนตรวจงานต่อเนื่อง: เลือกงานก่อน แล้วสแกน QR เล่มไหนของนักเรียนก็ได้ → งานนั้น "ผ่าน" ทันที
const prisma = require('../config/database');
const { assertTeacherOwnsTask } = require('../middleware/ownership');
const { ROOMS, appliesTo } = require('../services/taskRooms');
const { resolveStudent } = require('../services/scanStudent');

const STATUSES = new Set(['APPROVED', 'REJECTED', 'PENDING', 'NOT_SUBMITTED']);
// score ที่ส่งมา: ตัวเลข (หรือสตริงตัวเลข) หรือ null/'' = ล้างคะแนน · ปัดทศนิยม 2 ตำแหน่ง
function parseScore(v) {
  if (v === null || v === '') return { value: null };
  if (typeof v !== 'number' && typeof v !== 'string') return { error: 'คะแนนต้องเป็นตัวเลข' };
  const n = typeof v === 'number' ? v : Number(v.trim());
  if (!Number.isFinite(n) || (typeof v === 'string' && !v.trim())) return { error: 'คะแนนต้องเป็นตัวเลข' };
  return { value: Math.round(n * 100) / 100 };
}
const teacherIdOf = (req) => (req.user && (req.user.teacherId || (req.user.teacher && req.user.teacher.id))) || null;

async function loadTask(taskId) {
  return prisma.task.findUnique({
    where: { id: taskId },
    include: { subject: { select: { id: true, subjectName: true, subjectCode: true, gradeId: true, academicYearId: true } }, ...ROOMS }
  });
}

// นักเรียนที่ได้รับงานนี้ (ชั้นเดียวกับวิชา · ถ้างานลงเฉพาะห้อง = เฉพาะห้องนั้น)
async function rosterOfTask(task) {
  const subject = task.subject;
  const cls = {};
  if (subject.gradeId) {
    cls.gradeId = subject.gradeId;
    if (subject.academicYearId) cls.academicYearId = subject.academicYearId;
  }
  const students = await prisma.student.findMany({
    where: { status: 'ACTIVE', ...(Object.keys(cls).length ? { class: cls } : { qrcodes: { some: { subjectId: subject.id } } }) },
    select: { id: true, classId: true }
  });
  return students.filter(s => appliesTo(task, s.classId));
}

// รายชื่อนักเรียนของงาน (เลขที่ ห้อง สถานะ คะแนน) สำหรับดูว่าใครส่ง/ไม่ส่ง
async function sheetOf(task) {
  const subject = task.subject;
  const cls = {};
  if (subject.gradeId) {
    cls.gradeId = subject.gradeId;
    if (subject.academicYearId) cls.academicYearId = subject.academicYearId;
  }
  const students = await prisma.student.findMany({
    where: { status: 'ACTIVE', ...(Object.keys(cls).length ? { class: cls } : { qrcodes: { some: { subjectId: subject.id } } }) },
    select: { id: true, studentCode: true, studentNumber: true, name: true, classId: true, class: { select: { className: true } } },
    orderBy: [{ classId: 'asc' }, { studentNumber: 'asc' }, { studentCode: 'asc' }]
  });
  const roster = students.filter(s => appliesTo(task, s.classId));
  const subs = await prisma.submission.findMany({ where: { taskId: task.id, studentId: { in: roster.map(s => s.id) } }, select: { studentId: true, status: true, score: true } });
  const by = new Map(subs.map(x => [x.studentId, x]));
  return roster.map(s => {
    const sub = by.get(s.id);
    return { id: s.id, studentCode: s.studentCode, studentNumber: s.studentNumber, name: s.name, className: s.class.className, status: sub ? sub.status : 'NOT_SUBMITTED', score: sub && sub.score !== null ? sub.score : null };
  });
}

async function progressOf(task) {
  const roster = await rosterOfTask(task);
  const ids = roster.map(s => s.id);
  const rows = await prisma.submission.groupBy({ by: ['status'], where: { taskId: task.id, studentId: { in: ids } }, _count: { _all: true } });
  const n = (st) => (rows.find(r => r.status === st) || { _count: { _all: 0 } })._count._all;
  const approved = n('APPROVED'), rejected = n('REJECTED'), pending = n('PENDING');
  return { total: ids.length, checked: approved + rejected, approved, rejected, pending, notSubmitted: ids.length - approved - rejected - pending };
}

module.exports = {
  async scanCheck(req, res) {
    try {
      const taskId = parseInt(req.body.taskId);
      const status = req.body.status || 'APPROVED';
      if (!taskId) return res.status(400).json({ error: 'กรุณาเลือกงานก่อนสแกน' });
      if (!STATUSES.has(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });

      const denied = await assertTeacherOwnsTask(req, taskId);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      const task = await loadTask(taskId);
      if (!task) return res.status(404).json({ error: 'ไม่พบข้อมูลงาน' });

      const found = await resolveStudent(req.body);
      if (found.error) return res.status(found.status).json({ error: found.error });
      const student = found.student;

      if ((task.subject.gradeId && student.class.gradeId !== task.subject.gradeId) || !appliesTo(task, student.classId)) {
        return res.status(400).json({ error: `${student.name} (${student.class.className}) ไม่ได้อยู่ในงานนี้` });
      }

      const existing = await prisma.submission.findFirst({ where: { studentId: student.id, taskId } });
      const previousStatus = existing ? existing.status : 'NOT_SUBMITTED';
      const previousScore = existing && existing.score !== null && existing.score !== undefined ? existing.score : null;

      // preview: แค่ดูว่าสแกนเจอใคร (ยังไม่บันทึก) ให้ครูเลือกผ่าน/ไม่ผ่านเอง
      if (req.body.preview) {
        const sc = task.scoringType === 'SCORED';
        return res.json({
          student: { id: student.id, studentCode: student.studentCode, studentNumber: student.studentNumber, name: student.name, className: student.class.className },
          taskId, previousStatus, status: previousStatus, preview: true, progress: await progressOf(task),
          scoringType: task.scoringType, maxScore: task.maxScore ?? null, score: sc ? previousScore : null
        });
      }

      // คะแนน: เฉพาะงานแบบ SCORED · ส่ง score มาเอง (ตัวเลข/null) = ตั้งตามนั้น · ไม่ส่ง = ไม่ทับคะแนนเดิม ถ้ายังไม่มีให้คะแนนเต็ม
      const scored = task.scoringType === 'SCORED';
      const maxScore = task.maxScore === null || task.maxScore === undefined ? null : task.maxScore;
      let score = previousScore;
      let scoreChanged = false;
      if (scored) {
        const explicit = Object.prototype.hasOwnProperty.call(req.body, 'score');
        if (explicit) {
          const parsed = parseScore(req.body.score);
          if (parsed.error) return res.status(400).json({ error: parsed.error });
          if (parsed.value !== null && (parsed.value < 0 || (maxScore !== null && parsed.value > maxScore))) {
            return res.status(400).json({ error: maxScore !== null ? `คะแนนต้องอยู่ระหว่าง 0 ถึง ${maxScore}` : 'คะแนนต้องไม่ติดลบ' });
          }
          score = parsed.value;
        } else if (status === 'APPROVED' && previousScore === null && maxScore !== null) {
          score = maxScore;
        }
        scoreChanged = score !== previousScore;
      }

      const alreadyChecked = previousStatus === status && !scoreChanged;
      if (!alreadyChecked) {
        const data = {
          status, reviewedById: teacherIdOf(req), reviewDate: new Date(),
          submitDate: status !== 'NOT_SUBMITTED' ? ((existing && existing.submitDate) || new Date()) : null
        };
        if (scored) data.score = score;
        if (existing) await prisma.submission.update({ where: { id: existing.id }, data });
        else await prisma.submission.create({ data: { studentId: student.id, taskId, ...data } });
      }
      res.json({
        student: { id: student.id, studentCode: student.studentCode, studentNumber: student.studentNumber, name: student.name, className: student.class.className },
        taskId, previousStatus, status, alreadyChecked, progress: await progressOf(task),
        scoringType: task.scoringType, maxScore, score: scored ? score : null, previousScore: scored ? previousScore : null,
        noMaxScore: scored && maxScore === null
      });
    } catch (error) {
      console.error('Scan check error:', error);
      res.status(500).json({ error: 'บันทึกการตรวจไม่สำเร็จ' });
    }
  },

  async taskSheet(req, res) {
    try {
      const taskId = parseInt(req.query.taskId);
      if (!taskId) return res.status(400).json({ error: 'กรุณาเลือกงาน' });
      const denied = await assertTeacherOwnsTask(req, taskId);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      const task = await loadTask(taskId);
      if (!task) return res.status(404).json({ error: 'ไม่พบข้อมูลงาน' });
      res.json({
        task: { id: task.id, taskName: task.taskName, scoringType: task.scoringType, maxScore: task.maxScore },
        students: await sheetOf(task)
      });
    } catch (error) {
      console.error('Task sheet error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  async taskProgress(req, res) {
    try {
      const taskId = parseInt(req.query.taskId);
      if (!taskId) return res.status(400).json({ error: 'กรุณาเลือกงาน' });
      const denied = await assertTeacherOwnsTask(req, taskId);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      const task = await loadTask(taskId);
      if (!task) return res.status(404).json({ error: 'ไม่พบข้อมูลงาน' });
      res.json({ taskId, progress: await progressOf(task) });
    } catch (error) {
      console.error('Task progress error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  }
};
