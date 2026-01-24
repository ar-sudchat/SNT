const prisma = require('../config/database');

const teacherController = {
  // Get all teachers
  async getAll(req, res) {
    try {
      const { status } = req.query;

      const where = {};
      if (status) where.status = status;

      const teachers = await prisma.teacher.findMany({
        where,
        include: {
          subjects: true,
          homeClass: true
        },
        orderBy: { name: 'asc' }
      });

      res.json(teachers);
    } catch (error) {
      console.error('Get teachers error:', error);
      res.status(500).json({ error: 'Failed to fetch teachers' });
    }
  },

  // Get teacher by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const teacher = await prisma.teacher.findUnique({
        where: { id: parseInt(id) },
        include: {
          subjects: true,
          homeClass: {
            include: { grade: true }
          }
        }
      });

      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }

      res.json(teacher);
    } catch (error) {
      console.error('Get teacher error:', error);
      res.status(500).json({ error: 'Failed to fetch teacher' });
    }
  },

  // Get teacher subjects
  async getSubjects(req, res) {
    try {
      const { id } = req.params;

      const subjects = await prisma.subject.findMany({
        where: { teacherId: parseInt(id) },
        include: {
          _count: {
            select: { tasks: true }
          }
        },
        orderBy: { subjectName: 'asc' }
      });

      res.json(subjects);
    } catch (error) {
      console.error('Get teacher subjects error:', error);
      res.status(500).json({ error: 'Failed to fetch subjects' });
    }
  },

  // Create teacher
  async create(req, res) {
    try {
      const { teacherCode, name, email, status } = req.body;

      const existingTeacher = await prisma.teacher.findUnique({
        where: { teacherCode }
      });

      if (existingTeacher) {
        return res.status(400).json({ error: 'Teacher code already exists' });
      }

      const teacher = await prisma.teacher.create({
        data: { teacherCode, name, email, status }
      });

      res.status(201).json(teacher);
    } catch (error) {
      console.error('Create teacher error:', error);
      res.status(500).json({ error: 'Failed to create teacher' });
    }
  },

  // Update teacher
  async update(req, res) {
    try {
      const { id } = req.params;
      const { teacherCode, name, email, status } = req.body;

      const existing = await prisma.teacher.findFirst({
        where: {
          teacherCode,
          NOT: { id: parseInt(id) }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Teacher code already exists' });
      }

      const teacher = await prisma.teacher.update({
        where: { id: parseInt(id) },
        data: { teacherCode, name, email, status }
      });

      res.json(teacher);
    } catch (error) {
      console.error('Update teacher error:', error);
      res.status(500).json({ error: 'Failed to update teacher' });
    }
  },

  // Delete teacher
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if teacher has subjects
      const subjectCount = await prisma.subject.count({
        where: { teacherId: parseInt(id) }
      });

      if (subjectCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete teacher with existing subjects'
        });
      }

      await prisma.teacher.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'Teacher deleted successfully' });
    } catch (error) {
      console.error('Delete teacher error:', error);
      res.status(500).json({ error: 'Failed to delete teacher' });
    }
  }
};

module.exports = teacherController;
