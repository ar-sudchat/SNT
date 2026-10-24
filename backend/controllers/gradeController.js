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

  // Bulk create: { items: [{ gradeName, description? }] } (1-100)
  async bulkCreate(req, res) {
    try {
      const items = req.body && req.body.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
        return res.status(400).json({ error: 'ต้องส่งรายการระดับชั้น 1-100 รายการ' });
      }

      const existing = new Set((await prisma.grade.findMany({ select: { gradeName: true } })).map(g => g.gradeName));
      const seen = new Set();
      const created = [];
      const skipped = [];

      for (const item of items) {
        const gradeName = item && typeof item.gradeName === 'string' ? item.gradeName.trim() : '';
        if (!gradeName) { skipped.push({ gradeName: '', reason: 'ไม่มีชื่อระดับชั้น' }); continue; }
        if (gradeName.length > 50) { skipped.push({ gradeName, reason: 'ชื่อยาวเกิน 50 ตัวอักษร' }); continue; }
        if (seen.has(gradeName)) { skipped.push({ gradeName, reason: 'ซ้ำในรายการ' }); continue; }
        seen.add(gradeName);
        if (existing.has(gradeName)) { skipped.push({ gradeName, reason: 'มีอยู่แล้ว' }); continue; }

        const description = typeof item.description === 'string' && item.description.trim()
          ? item.description.trim().slice(0, 255) : undefined;
        try {
          created.push(await prisma.grade.create({ data: { gradeName, description } }));
        } catch (err) {
          if (err.code === 'P2002') skipped.push({ gradeName, reason: 'มีอยู่แล้ว' });
          else { console.error('Bulk create grade item error:', err); skipped.push({ gradeName, reason: 'สร้างไม่สำเร็จ' }); }
        }
      }

      res.json({ created, skipped });
    } catch (error) {
      console.error('Bulk create grades error:', error);
      res.status(500).json({ error: 'สร้างข้อมูลไม่สำเร็จ' });
    }
  },

  // Bulk delete: { ids: [int] } (1-500). Rows still referenced are reported in `failed`.
  async bulkDelete(req, res) {
    try {
      const ids = req.body && req.body.ids;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > 500 || !ids.every(Number.isInteger)) {
        return res.status(400).json({ error: 'ต้องส่งรายการ id 1-500 รายการ' });
      }
      const unique = [...new Set(ids)];

      const rows = await prisma.grade.findMany({
        where: { id: { in: unique } },
        include: { _count: { select: { classes: true, subjects: true } } }
      });
      const byId = new Map(rows.map(g => [g.id, g]));

      let deleted = 0;
      const failed = [];
      for (const id of unique) {
        const grade = byId.get(id);
        if (!grade) { failed.push({ id, name: null, reason: 'ไม่พบ' }); continue; }
        if (grade._count.classes > 0 || grade._count.subjects > 0) {
          failed.push({ id, name: grade.gradeName, reason: 'ยังมีห้องเรียนหรือวิชาในชั้นนี้' });
          continue;
        }
        try {
          await prisma.grade.delete({ where: { id } });
          deleted++;
        } catch (err) {
          if (err.code === 'P2025') failed.push({ id, name: grade.gradeName, reason: 'ไม่พบ' });
          else if (err.code === 'P2003' || err.code === 'P2014') failed.push({ id, name: grade.gradeName, reason: 'ยังมีห้องเรียนหรือวิชาในชั้นนี้' });
          else { console.error('Bulk delete grade item error:', err); failed.push({ id, name: grade.gradeName, reason: 'ลบไม่สำเร็จ' }); }
        }
      }

      res.json({ deleted, failed });
    } catch (error) {
      console.error('Bulk delete grades error:', error);
      res.status(500).json({ error: 'ลบข้อมูลไม่สำเร็จ' });
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
