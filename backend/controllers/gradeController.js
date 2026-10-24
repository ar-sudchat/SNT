const prisma = require('../config/database');

const gradeController = {
  // Get all grades
  async getAll(req, res) {
    try {
      const grades = await prisma.grade.findMany({
        include: {
          _count: {
            select: { classes: true }
          }
        },
        orderBy: { gradeName: 'asc' }
      });

      res.json(grades);
    } catch (error) {
      console.error('Get grades error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // Get grade by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const grade = await prisma.grade.findUnique({
        where: { id: parseInt(id) },
        include: {
          classes: {
            include: {
              homeTeacher: true,
              _count: {
                select: { students: true }
              }
            }
          }
        }
      });

      if (!grade) {
        return res.status(404).json({ error: 'ไม่พบข้อมูลระดับชั้น' });
      }

      res.json(grade);
    } catch (error) {
      console.error('Get grade error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // Create grade
  async create(req, res) {
    try {
      const { gradeName, description, status } = req.body;

      const existingGrade = await prisma.grade.findUnique({
        where: { gradeName }
      });

      if (existingGrade) {
        return res.status(400).json({ error: 'มีชื่อระดับชั้นนี้แล้ว' });
      }

      const grade = await prisma.grade.create({
        data: { gradeName, description, status }
      });

      res.status(201).json(grade);
    } catch (error) {
      console.error('Create grade error:', error);
      res.status(500).json({ error: 'สร้างข้อมูลไม่สำเร็จ' });
    }
  },

  // Update grade
  async update(req, res) {
    try {
      const { id } = req.params;
      const { gradeName, description, status } = req.body;

      const existing = await prisma.grade.findFirst({
        where: {
          gradeName,
          NOT: { id: parseInt(id) }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'มีชื่อระดับชั้นนี้แล้ว' });
      }

      const grade = await prisma.grade.update({
        where: { id: parseInt(id) },
        data: { gradeName, description, status }
      });

      res.json(grade);
    } catch (error) {
      console.error('Update grade error:', error);
      res.status(500).json({ error: 'แก้ไขข้อมูลไม่สำเร็จ' });
    }
  },

  // Delete grade
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if grade has classes
      const classCount = await prisma.class.count({
        where: { gradeId: parseInt(id) }
      });

      if (classCount > 0) {
        return res.status(400).json({
          error: 'ลบไม่ได้ เพราะยังมีห้องเรียนในระดับชั้นนี้'
        });
      }

      await prisma.grade.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'ลบระดับชั้นเรียบร้อยแล้ว' });
    } catch (error) {
      console.error('Delete grade error:', error);
      res.status(500).json({ error: 'ลบข้อมูลไม่สำเร็จ' });
    }
  }
};

module.exports = gradeController;
