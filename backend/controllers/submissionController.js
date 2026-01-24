const prisma = require('../config/database');

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
      res.status(500).json({ error: 'Failed to fetch submissions' });
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
        return res.status(404).json({ error: 'Submission not found' });
      }

      res.json(submission);
    } catch (error) {
      console.error('Get submission error:', error);
      res.status(500).json({ error: 'Failed to fetch submission' });
    }
  },

  // Create or update submission
  async createOrUpdate(req, res) {
    try {
      const { studentId, taskId, status, notes } = req.body;

      // Get teacher ID from user
      const reviewedById = req.user.teacherId || req.user.teacher?.id;

      // Check if submission exists
      const existing = await prisma.submission.findFirst({
        where: { studentId, taskId }
      });

      let submission;

      if (existing) {
        // Update existing submission
        submission = await prisma.submission.update({
          where: { id: existing.id },
          data: {
            status,
            notes,
            reviewedById,
            reviewDate: new Date(),
            submitDate: status !== 'NOT_SUBMITTED' ? (existing.submitDate || new Date()) : null
          },
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
            status,
            notes,
            reviewedById,
            reviewDate: new Date(),
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
      res.status(500).json({ error: 'Failed to save submission' });
    }
  },

  // Bulk update submissions
  async bulkUpdate(req, res) {
    try {
      const { submissions } = req.body; // Array of { studentId, taskId, status, notes }

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

          if (existing) {
            submission = await prisma.submission.update({
              where: { id: existing.id },
              data: {
                status: sub.status,
                notes: sub.notes,
                reviewedById,
                reviewDate: new Date(),
                submitDate: sub.status !== 'NOT_SUBMITTED' ? (existing.submitDate || new Date()) : null
              }
            });
          } else {
            submission = await prisma.submission.create({
              data: {
                studentId: sub.studentId,
                taskId: sub.taskId,
                status: sub.status,
                notes: sub.notes,
                reviewedById,
                reviewDate: new Date(),
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
        message: `Updated ${results.success.length} submissions, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Bulk update submissions error:', error);
      res.status(500).json({ error: 'Failed to update submissions' });
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
        return res.status(404).json({ error: 'Submission not found' });
      }

      res.json({
        current: submission,
        history: [] // Placeholder for future audit log
      });
    } catch (error) {
      console.error('Get submission history error:', error);
      res.status(500).json({ error: 'Failed to fetch history' });
    }
  }
};

module.exports = submissionController;
