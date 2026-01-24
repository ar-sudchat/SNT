const prisma = require('../config/database');

const taskController = {
  // Get all tasks
  async getAll(req, res) {
    try {
      const { subjectId, status } = req.query;

      const where = {};
      if (subjectId) where.subjectId = parseInt(subjectId);
      if (status) where.status = status;

      const tasks = await prisma.task.findMany({
        where,
        include: {
          subject: {
            include: { teacher: true }
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
      res.status(500).json({ error: 'Failed to fetch tasks' });
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
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(task);
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({ error: 'Failed to fetch task' });
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
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  },

  // Create task
  async create(req, res) {
    try {
      const { subjectId, taskName, taskNumber, description, deadline, status } = req.body;

      // Check for duplicate task number in subject
      const existingTask = await prisma.task.findFirst({
        where: {
          subjectId,
          taskNumber
        }
      });

      if (existingTask) {
        return res.status(400).json({
          error: `Task number ${taskNumber} already exists for this subject`
        });
      }

      // Get teacher ID from user
      const createdById = req.user.teacherId || req.user.teacher?.id;

      if (!createdById) {
        return res.status(400).json({ error: 'Teacher ID not found for current user' });
      }

      const task = await prisma.task.create({
        data: {
          subjectId,
          taskName,
          taskNumber,
          description,
          deadline: deadline ? new Date(deadline) : null,
          status,
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
      res.status(500).json({ error: 'Failed to create task' });
    }
  },

  // Update task
  async update(req, res) {
    try {
      const { id } = req.params;
      const { subjectId, taskName, taskNumber, description, deadline, status } = req.body;

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
          error: `Task number ${taskNumber} already exists for this subject`
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
          status
        },
        include: {
          subject: true,
          createdBy: true
        }
      });

      res.json(task);
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Failed to update task' });
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

      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  }
};

module.exports = taskController;
