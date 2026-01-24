const prisma = require('../config/database');

const subjectController = {
  // Get all subjects
  async getAll(req, res) {
    try {
      const { teacherId, status } = req.query;

      const where = {};
      if (teacherId) where.teacherId = parseInt(teacherId);
      if (status) where.status = status;

      const subjects = await prisma.subject.findMany({
        where,
        include: {
          teacher: true,
          _count: {
            select: { tasks: true, qrcodes: true }
          }
        },
        orderBy: { subjectName: 'asc' }
      });

      res.json(subjects);
    } catch (error) {
      console.error('Get subjects error:', error);
      res.status(500).json({ error: 'Failed to fetch subjects' });
    }
  },

  // Get subject by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const subject = await prisma.subject.findUnique({
        where: { id: parseInt(id) },
        include: {
          teacher: true,
          tasks: {
            orderBy: { taskNumber: 'asc' }
          }
        }
      });

      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      res.json(subject);
    } catch (error) {
      console.error('Get subject error:', error);
      res.status(500).json({ error: 'Failed to fetch subject' });
    }
  },

  // Get tasks for subject
  async getTasks(req, res) {
    try {
      const { id } = req.params;

      const tasks = await prisma.task.findMany({
        where: { subjectId: parseInt(id) },
        include: {
          createdBy: true,
          _count: {
            select: { submissions: true }
          }
        },
        orderBy: { taskNumber: 'asc' }
      });

      res.json(tasks);
    } catch (error) {
      console.error('Get subject tasks error:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  },

  // Create subject
  async create(req, res) {
    try {
      const { subjectCode, subjectName, teacherId, description, status } = req.body;

      const existingSubject = await prisma.subject.findUnique({
        where: { subjectCode }
      });

      if (existingSubject) {
        return res.status(400).json({ error: 'Subject code already exists' });
      }

      const subject = await prisma.subject.create({
        data: { subjectCode, subjectName, teacherId, description, status },
        include: { teacher: true }
      });

      res.status(201).json(subject);
    } catch (error) {
      console.error('Create subject error:', error);
      res.status(500).json({ error: 'Failed to create subject' });
    }
  },

  // Update subject
  async update(req, res) {
    try {
      const { id } = req.params;
      const { subjectCode, subjectName, teacherId, description, status } = req.body;

      const existing = await prisma.subject.findFirst({
        where: {
          subjectCode,
          NOT: { id: parseInt(id) }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Subject code already exists' });
      }

      const subject = await prisma.subject.update({
        where: { id: parseInt(id) },
        data: { subjectCode, subjectName, teacherId, description, status },
        include: { teacher: true }
      });

      res.json(subject);
    } catch (error) {
      console.error('Update subject error:', error);
      res.status(500).json({ error: 'Failed to update subject' });
    }
  },

  // Delete subject
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if subject has tasks
      const taskCount = await prisma.task.count({
        where: { subjectId: parseInt(id) }
      });

      if (taskCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete subject with existing tasks'
        });
      }

      // Delete related QR codes
      await prisma.qRCode.deleteMany({
        where: { subjectId: parseInt(id) }
      });

      await prisma.subject.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
      console.error('Delete subject error:', error);
      res.status(500).json({ error: 'Failed to delete subject' });
    }
  }
};

module.exports = subjectController;
