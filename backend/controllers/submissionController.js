const prisma = require('../config/database');
const { assertTeacherOwnsTask } = require('../middleware/ownership');

const submissionController = {
  // Get all submissions
  async getAll(req, res) {
    try {
      const { studentId, taskId, subjectId, status } = req.query;

      const where = {};
      if (studentId) where.studentId = parseInt(studentId);
      if (taskId) where.taskId = parseInt(taskId);
      if (status) where.status = status;
      if (subjectId) {
        where.task = { subjectId: parseInt(subjectId) };
      }

      const submissions = await prisma.submission.findMany({
        where,
        include: {
          student: {
            include: { class: true }
          },
          task: {
            include: { subject: true }
          },
          reviewedBy: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      res.json(submissions);
    } catch (error) {
      console.error('Get submissions error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // Get submission by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const submission = await prisma.submission.findUnique({
        where: { id: parseInt(id) },
        include: {
          student: {
            include: { class: true }
          },
          task: {
            include: { subject: true }
          },
          reviewedBy: true
        }
      });

      if (!submission) {
        return res.status(404).json({ error: 'ไม่พบข้อมูลการส่งงาน' });
      }

      res.json(submission);
    } catch (error) {
      console.error('Get submission error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // Create or update submission
  async createOrUpdate(req, res) {
    try {
      const { studentId, taskId, status, notes, score } = req.body;

      const denied = await assertTeacherOwnsTask(req, taskId);
      if (denied) return res.status(denied.status).json({ error: denied.error });

      // Get teacher ID from user
      const reviewedById = req.user.teacherId || req.user.teacher?.id;

      // Check if submission exists
      const existing = await prisma.submission.findFirst({
        where: { studentId, taskId }
      });

      let submission;

      const updateData = {
        status,
        notes,
        score: score !== undefined ? parseFloat(score) : undefined,
        reviewedById,
        reviewDate: new Date(),
        submitDate: status !== 'NOT_SUBMITTED' ? (existing?.submitDate || new Date()) : null
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key =>
        updateData[key] === undefined && delete updateData[key]
      );

      if (existing) {
        // Update existing submission
        submission = await prisma.submission.update({
          where: { id: existing.id },
          data: updateData,
          include: {
            student: true,
            task: true,
            reviewedBy: true
          }
        });
      } else {
        // Create new submission
        submission = await prisma.submission.create({
          data: {
            studentId,
            taskId,
            ...updateData,
            submitDate: status !== 'NOT_SUBMITTED' ? new Date() : null
          },
          include: {
            student: true,
            task: true,
            reviewedBy: true
          }
        });
      }

      res.json(submission);
    } catch (error) {
      console.error('Create/update submission error:', error);
      res.status(500).json({ error: 'บันทึกข้อมูลไม่สำเร็จ' });
    }
  },

  // Bulk update submissions
  async bulkUpdate(req, res) {
    try {
      const { submissions } = req.body; // Array of { studentId, taskId, status, notes, score }

      if (!Array.isArray(submissions)) {
        return res.status(400).json({ error: 'submissions ต้องเป็นอาร์เรย์' });
      }
      // Ownership: every distinct task in the batch must belong to this teacher's subjects
      const taskIds = [...new Set(submissions.map(s => s.taskId))];
      for (const tid of taskIds) {
        const denied = await assertTeacherOwnsTask(req, tid);
        if (denied) return res.status(denied.status).json({ error: denied.error });
      }

      const reviewedById = req.user.teacherId || req.user.teacher?.id;
      const results = {
        success: [],
        failed: []
      };

      for (const sub of submissions) {
        try {
          const existing = await prisma.submission.findFirst({
            where: {
              studentId: sub.studentId,
              taskId: sub.taskId
            }
          });

          let submission;

          const updateData = {
            status: sub.status,
            notes: sub.notes,
            score: sub.score !== undefined ? parseFloat(sub.score) : undefined,
            reviewedById,
            reviewDate: new Date(),
            submitDate: sub.status !== 'NOT_SUBMITTED' ? (existing?.submitDate || new Date()) : null
          };

          // Remove undefined values
          Object.keys(updateData).forEach(key =>
            updateData[key] === undefined && delete updateData[key]
          );

          if (existing) {
            submission = await prisma.submission.update({
              where: { id: existing.id },
              data: updateData
            });
          } else {
            submission = await prisma.submission.create({
              data: {
                studentId: sub.studentId,
                taskId: sub.taskId,
                ...updateData,
                submitDate: sub.status !== 'NOT_SUBMITTED' ? new Date() : null
              }
            });
          }

          results.success.push(submission);
        } catch (err) {
          results.failed.push({
            studentId: sub.studentId,
            taskId: sub.taskId,
            reason: err.message
          });
        }
      }

      res.json({
        message: `à¸­à¸±à¸à¹à¸à¸ ${results.success.length} à¸£à¸²à¸¢à¸à¸²à¸£, à¹à¸¡à¹à¸ªà¸³à¹à¸£à¹à¸ ${results.failed.length} à¸£à¸²à¸¢à¸à¸²à¸£`,
        results
      });
    } catch (error) {
      console.error('Bulk update submissions error:', error);
      res.status(500).json({ error: 'แก้ไขข้อมูลไม่สำเร็จ' });
    }
  },

  // Get submission history (for future audit feature)
  async getHistory(req, res) {
    try {
      const { id } = req.params;

      // For now, just return the current submission
      // In the future, this could return audit log
      const submission = await prisma.submission.findUnique({
        where: { id: parseInt(id) },
        include: {
          student: true,
          task: true,
          reviewedBy: true
        }
      });

      if (!submission) {
        return res.status(404).json({ error: 'ไม่พบข้อมูลการส่งงาน' });
      }

      res.json({
        current: submission,
        history: [] // Placeholder for future audit log
      });
    } catch (error) {
      console.error('Get submission history error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  }
};

module.exports = submissionController;
