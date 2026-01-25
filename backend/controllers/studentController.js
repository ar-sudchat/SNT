const prisma = require('../config/database');

const studentController = {
  // Get all students
  async getAll(req, res) {
    try {
      const { classId, gradeId, status } = req.query;

      const where = {};
      if (classId) where.classId = parseInt(classId);
      if (gradeId) where.class = { gradeId: parseInt(gradeId) };
      if (status) where.status = status;

      const students = await prisma.student.findMany({
        where,
        include: {
          class: {
            include: { grade: true }
          }
        },
        orderBy: [
          { class: { className: 'asc' } },
          { studentNumber: 'asc' },
          { studentCode: 'asc' }
        ]
      });

      res.json(students);
    } catch (error) {
      console.error('Get students error:', error);
      res.status(500).json({ error: 'Failed to fetch students' });
    }
  },

  // Get student by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const student = await prisma.student.findUnique({
        where: { id: parseInt(id) },
        include: {
          class: {
            include: { grade: true }
          },
          qrcodes: {
            include: { subject: true }
          }
        }
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json(student);
    } catch (error) {
      console.error('Get student error:', error);
      res.status(500).json({ error: 'Failed to fetch student' });
    }
  },

  // Get student submissions
  async getSubmissions(req, res) {
    try {
      const { id } = req.params;
      const { subjectId } = req.query;

      const where = { studentId: parseInt(id) };

      if (subjectId) {
        where.task = { subjectId: parseInt(subjectId) };
      }

      const submissions = await prisma.submission.findMany({
        where,
        include: {
          task: {
            include: { subject: true }
          },
          reviewedBy: true
        },
        orderBy: [
          { task: { subject: { subjectName: 'asc' } } },
          { task: { taskNumber: 'asc' } }
        ]
      });

      res.json(submissions);
    } catch (error) {
      console.error('Get student submissions error:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  },

  // Create student
  async create(req, res) {
    try {
      const { studentCode, studentNumber, name, classId, email, status } = req.body;

      const existingStudent = await prisma.student.findUnique({
        where: { studentCode }
      });

      if (existingStudent) {
        return res.status(400).json({ error: 'Student code already exists' });
      }

      const student = await prisma.student.create({
        data: { studentCode, studentNumber, name, classId, email, status },
        include: {
          class: {
            include: { grade: true }
          }
        }
      });

      res.status(201).json(student);
    } catch (error) {
      console.error('Create student error:', error);
      res.status(500).json({ error: 'Failed to create student' });
    }
  },

  // Update student
  async update(req, res) {
    try {
      const { id } = req.params;
      const { studentCode, studentNumber, name, classId, email, status } = req.body;

      const existing = await prisma.student.findFirst({
        where: {
          studentCode,
          NOT: { id: parseInt(id) }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Student code already exists' });
      }

      const student = await prisma.student.update({
        where: { id: parseInt(id) },
        data: { studentCode, studentNumber, name, classId, email, status },
        include: {
          class: {
            include: { grade: true }
          }
        }
      });

      res.json(student);
    } catch (error) {
      console.error('Update student error:', error);
      res.status(500).json({ error: 'Failed to update student' });
    }
  },

  // Delete student
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Delete related submissions and qrcodes first
      await prisma.submission.deleteMany({
        where: { studentId: parseInt(id) }
      });

      await prisma.qRCode.deleteMany({
        where: { studentId: parseInt(id) }
      });

      await prisma.student.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'Student deleted successfully' });
    } catch (error) {
      console.error('Delete student error:', error);
      res.status(500).json({ error: 'Failed to delete student' });
    }
  }
};

module.exports = studentController;
