const prisma = require('../config/database');

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
      const { subjectId, taskName, taskNumber, description, deadline, status, scoringType, maxScore } = req.body;

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
        return res.status(400).json({
          error: `งานที่ ${taskNumber} มีอยู่แล้วในวิชานี้`
        });
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
        },
        include: {
          subject: true,
          createdBy: true
        }
      });

      res.status(201).json(task);
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'ไม่สามารถเพิ่มงานได้' });
    }
  },

  // Update task
  async update(req, res) {
    try {
      const { id } = req.params;
      const { subjectId, taskName, taskNumber, description, deadline, status, scoringType, maxScore } = req.body;

      // Check for duplicate task number in subject
      const existingTask = await prisma.task.findFirst({
        where: {
          subjectId,
          taskNumber,
          NOT: { id: parseInt(id) }
        }
      });

      if (existingTask) {
        return res.status(400).json({
          error: `งานที่ ${taskNumber} มีอยู่แล้วในวิชานี้`
        });
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
        },
        include: {
          subject: true,
          createdBy: true
        }
      });

      res.json(task);
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'ไม่สามารถแก้ไขข้อมูลงานได้' });
    }
  },

  // Delete task
  async delete(req, res) {
    try {
      const { id } = req.params;

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
