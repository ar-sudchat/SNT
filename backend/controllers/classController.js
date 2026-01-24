const prisma = require('../config/database');

const classController = {
  // Get all classes
  async getAll(req, res) {
    try {
      const { gradeId, academicYear } = req.query;

      const where = {};
      if (gradeId) where.gradeId = parseInt(gradeId);
      if (academicYear) where.academicYear = academicYear;

      const classes = await prisma.class.findMany({
        where,
        include: {
          grade: true,
          homeTeacher: true,
          _count: {
            select: { students: true }
          }
        },
        orderBy: { className: 'asc' }
      });

      res.json(classes);
    } catch (error) {
      console.error('Get classes error:', error);
      res.status(500).json({ error: 'Failed to fetch classes' });
    }
  },

  // Get class by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const classData = await prisma.class.findUnique({
        where: { id: parseInt(id) },
        include: {
          grade: true,
          homeTeacher: true,
          students: {
            orderBy: { studentCode: 'asc' }
          }
        }
      });

      if (!classData) {
        return res.status(404).json({ error: 'Class not found' });
      }

      res.json(classData);
    } catch (error) {
      console.error('Get class error:', error);
      res.status(500).json({ error: 'Failed to fetch class' });
    }
  },

  // Get students in class
  async getStudents(req, res) {
    try {
      const { id } = req.params;

      const students = await prisma.student.findMany({
        where: { classId: parseInt(id) },
        orderBy: { studentCode: 'asc' }
      });

      res.json(students);
    } catch (error) {
      console.error('Get class students error:', error);
      res.status(500).json({ error: 'Failed to fetch students' });
    }
  },

  // Create class
  async create(req, res) {
    try {
      const { className, gradeId, teacherId, academicYear, capacity, description, status } = req.body;

      const existingClass = await prisma.class.findUnique({
        where: { className }
      });

      if (existingClass) {
        return res.status(400).json({ error: 'Class name already exists' });
      }

      const classData = await prisma.class.create({
        data: {
          className,
          gradeId,
          teacherId,
          academicYear,
          capacity,
          description,
          status
        },
        include: {
          grade: true,
          homeTeacher: true
        }
      });

      res.status(201).json(classData);
    } catch (error) {
      console.error('Create class error:', error);
      res.status(500).json({ error: 'Failed to create class' });
    }
  },

  // Update class
  async update(req, res) {
    try {
      const { id } = req.params;
      const { className, gradeId, teacherId, academicYear, capacity, description, status } = req.body;

      const existing = await prisma.class.findFirst({
        where: {
          className,
          NOT: { id: parseInt(id) }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Class name already exists' });
      }

      const classData = await prisma.class.update({
        where: { id: parseInt(id) },
        data: {
          className,
          gradeId,
          teacherId,
          academicYear,
          capacity,
          description,
          status
        },
        include: {
          grade: true,
          homeTeacher: true
        }
      });

      res.json(classData);
    } catch (error) {
      console.error('Update class error:', error);
      res.status(500).json({ error: 'Failed to update class' });
    }
  },

  // Delete class
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if class has students
      const studentCount = await prisma.student.count({
        where: { classId: parseInt(id) }
      });

      if (studentCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete class with existing students'
        });
      }

      await prisma.class.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'Class deleted successfully' });
    } catch (error) {
      console.error('Delete class error:', error);
      res.status(500).json({ error: 'Failed to delete class' });
    }
  }
};

module.exports = classController;
