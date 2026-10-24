const prisma = require('../config/database');
const { assertTeacherOwnsSubject, assertTeacherOwnsTask } = require('../middleware/ownership');
const { cleanRoomIds, setRooms } = require('../services/taskRooms');

// ห้องของงานพร้อมชื่อห้อง (ว่าง = ทุกห้องของชั้น)
const ROOMS_WITH_NAME = { rooms: { select: { classId: true, class: { select: { className: true } } } } };

const taskController = {
  // Get all tasks
  async getAll(req, res) {
    try {
      const { subjectId, academicYearId, gradeId, status } = req.query;

      const where = {};
      if (subjectId) where.subjectId = parseInt(subjectId);

      // Build subject filter for academicYearId and gradeId
      const subjectFilter = {};
      if (academicYearId) subjectFilter.academicYearId = parseInt(academicYearId);
      if (gradeId) subjectFilter.gradeId = parseInt(gradeId);
      if (Object.keys(subjectFilter).length > 0) {
        where.subject = subjectFilter;
      }

      if (status) where.status = status;

      const tasks = await prisma.task.findMany({
        where,
        include: {
          subject: {
            include: {
              teacher: true,
              academicYear: true,
              grade: true
            }
          },
          createdBy: true,
          ...ROOMS_WITH_NAME,
          _count: {
            select: { submissions: true }
          }
        },
        orderBy: [
          { subject: { subjectName: 'asc' } },
          { taskNumber: 'asc' }
        ]
      });

      res.json(tasks);
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลงานได้' });
    }
  },

  // Get task by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const task = await prisma.task.findUnique({
        where: { id: parseInt(id) },
        include: {
          subject: {
            include: { teacher: true }
          },
          createdBy: true
        }
      });

      if (!task) {
        return res.status(404).json({ error: 'ไม่พบข้อมูลงาน' });
      }

      res.json(task);
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลงานได้' });
    }
  },

  // Get task submissions
  async getSubmissions(req, res) {
    try {
      const { id } = req.params;

      const submissions = await prisma.submission.findMany({
        where: { taskId: parseInt(id) },
        include: {
          student: {
            include: {
              class: true
            }
          },
          reviewedBy: true
        },
        orderBy: { student: { studentCode: 'asc' } }
      });

      res.json(submissions);
    } catch (error) {
      console.error('Get task submissions error:', error);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการส่งงานได้' });
    }
  },

  // Create task
  async create(req, res) {
    try {
      const { subjectId, taskName, taskNumber, description, deadline, status, scoringType, maxScore, classIds } = req.body;

      const denied = await assertTeacherOwnsSubject(req, subjectId);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      const rooms = await cleanRoomIds(subjectId, classIds);
      if (rooms.error) return res.status(400).json({ error: rooms.error });

      // Get subject to find the responsible teacher
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        select: { teacherId: true }
      });

      if (!subject) {
        return res.status(400).json({ error: 'ไม่พบข้อมูลวิชา' });
      }

      // Check for duplicate task number in subject
      const existingTask = await prisma.task.findFirst({
        where: {
          subjectId,
          taskNumber
        }
      });

      if (existingTask) {
        return res.status(409).json({ error: 'มีงานลำดับนี้ในวิชานี้แล้ว' });
      }

      // Use the subject's teacher as the task owner
      const createdById = subject.teacherId;

      const task = await prisma.task.create({
        data: {
          subjectId,
          taskName,
          taskNumber,
          description,
          deadline: deadline ? new Date(deadline) : null,
          status,
          scoringType: scoringType || 'SUBMISSION_ONLY',
          maxScore: maxScore || null,
          createdById
        }
      });
      await setRooms(task.id, rooms.ids);

      res.status(201).json(await prisma.task.findUnique({ where: { id: task.id }, include: { subject: true, createdBy: true, ...ROOMS_WITH_NAME } }));
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'มีงานลำดับนี้ในวิชานี้แล้ว' });
      }
      console.error('Create task error:', error);
      res.status(500).json({ error: 'ไม่สามารถเพิ่มงานได้' });
    }
  },

  // Update task
  async update(req, res) {
    try {
      const { id } = req.params;
      const { subjectId, taskName, taskNumber, description, deadline, status, scoringType, maxScore, classIds } = req.body;

      // Must own the task's current subject AND the target subject
      const deniedTask = await assertTeacherOwnsTask(req, id);
      if (deniedTask) return res.status(deniedTask.status).json({ error: deniedTask.error });
      const denied = await assertTeacherOwnsSubject(req, subjectId);
      if (denied) return res.status(denied.status).json({ error: denied.error });
      // ไม่ส่ง classIds มา = คงห้องเดิม (เว้นแต่ย้ายวิชา ห้องเดิมอาจไม่ใช่ชั้นเดียวกัน → ล้างเป็นทุกห้อง)
      const current = await prisma.task.findUnique({ where: { id: parseInt(id) }, select: { subjectId: true } });
      const rooms = classIds !== undefined ? await cleanRoomIds(subjectId, classIds)
        : current && current.subjectId !== subjectId ? { ids: [] } : null;
      if (rooms && rooms.error) return res.status(400).json({ error: rooms.error });

      // Check for duplicate task number in subject
      const existingTask = await prisma.task.findFirst({
        where: {
          subjectId,
          taskNumber,
          NOT: { id: parseInt(id) }
        }
      });

      if (existingTask) {
        return res.status(409).json({ error: 'มีงานลำดับนี้ในวิชานี้แล้ว' });
      }

      const task = await prisma.task.update({
        where: { id: parseInt(id) },
        data: {
          subjectId,
          taskName,
          taskNumber,
          description,
          deadline: deadline ? new Date(deadline) : null,
          status,
          scoringType: scoringType || 'SUBMISSION_ONLY',
          maxScore: maxScore || null
        }
      });
      if (rooms) await setRooms(task.id, rooms.ids);

      res.json(await prisma.task.findUnique({ where: { id: task.id }, include: { subject: true, createdBy: true, ...ROOMS_WITH_NAME } }));
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({ error: 'มีงานลำดับนี้ในวิชานี้แล้ว' });
      }
      console.error('Update task error:', error);
      res.status(500).json({ error: 'ไม่สามารถแก้ไขข้อมูลงานได้' });
    }
  },

  // Delete task
  async delete(req, res) {
    try {
      const { id } = req.params;

      const denied = await assertTeacherOwnsTask(req, id);
      if (denied) return res.status(denied.status).json({ error: denied.error });

      // Delete related submissions first
      await prisma.submission.deleteMany({
        where: { taskId: parseInt(id) }
      });

      await prisma.task.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'ลบงานเรียบร้อยแล้ว' });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({ error: 'ไม่สามารถลบงานได้' });
    }
  }
};

module.exports = taskController;
