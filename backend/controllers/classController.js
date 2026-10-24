const prisma = require('../config/database');

const classController = {
  // Get all classes
  async getAll(req, res) {
    try {
      const { gradeId, academicYearId } = req.query;

      const where = {};
      if (gradeId) where.gradeId = parseInt(gradeId);
      if (academicYearId) where.academicYearId = parseInt(academicYearId);

      const classes = await prisma.class.findMany({
        where,
        include: {
          grade: true,
          homeTeacher: true,
          academicYear: true,
          _count: {
            select: { students: true }
          }
        },
        orderBy: { className: 'asc' }
      });

      res.json(classes);
    } catch (error) {
      console.error('Get classes error:', error);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลห้องเรียนได้' });
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
        return res.status(404).json({ error: 'ไม่พบข้อมูลห้องเรียน' });
      }

      res.json(classData);
    } catch (error) {
      console.error('Get class error:', error);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลห้องเรียนได้' });
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
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลนักเรียนได้' });
    }
  },

  // Create class
  async create(req, res) {
    try {
      const { className, gradeId, teacherId, academicYearId, capacity, description, status } = req.body;

      const existingClass = await prisma.class.findUnique({
        where: { className }
      });

      if (existingClass) {
        return res.status(400).json({ error: 'ชื่อห้องเรียนนี้มีอยู่แล้วในระบบ' });
      }

      const classData = await prisma.class.create({
        data: {
          className,
          gradeId,
          teacherId,
          academicYearId,
          capacity,
          description,
          status
        },
        include: {
          grade: true,
          homeTeacher: true,
          academicYear: true
        }
      });

      res.status(201).json(classData);
    } catch (error) {
      console.error('Create class error:', error);
      res.status(500).json({ error: 'ไม่สามารถเพิ่มห้องเรียนได้' });
    }
  },

  // Bulk create: { items: [{ className, gradeId, academicYearId?, teacherId?, capacity? }] } (1-200)
  async bulkCreate(req, res) {
    try {
      const items = req.body && req.body.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > 200) {
        return res.status(400).json({ error: 'ต้องส่งรายการห้องเรียน 1-200 รายการ' });
      }

      const isId = (v) => Number.isInteger(v) && v > 0;
      const wanted = (key) => [...new Set(items.map(i => i && i[key]).filter(isId))];

      const [existingClasses, grades, teachers, years, currentYear] = await Promise.all([
        prisma.class.findMany({ select: { className: true } }),
        prisma.grade.findMany({ where: { id: { in: wanted('gradeId') } }, select: { id: true } }),
        prisma.teacher.findMany({ where: { id: { in: wanted('teacherId') } }, select: { id: true } }),
        prisma.academicYear.findMany({ where: { id: { in: wanted('academicYearId') } }, select: { id: true } }),
        prisma.academicYear.findFirst({ where: { isCurrent: true }, orderBy: { id: 'desc' } })
      ]);
      const existing = new Set(existingClasses.map(c => c.className));
      const gradeIds = new Set(grades.map(g => g.id));
      const teacherIds = new Set(teachers.map(t => t.id));
      const yearIds = new Set(years.map(y => y.id));
      const seen = new Set();
      const created = [];
      const skipped = [];

      for (const item of items) {
        const className = item && typeof item.className === 'string' ? item.className.trim() : '';
        if (!className) { skipped.push({ className: '', reason: 'ไม่มีชื่อห้องเรียน' }); continue; }
        if (className.length > 50) { skipped.push({ className, reason: 'ชื่อยาวเกิน 50 ตัวอักษร' }); continue; }
        if (seen.has(className)) { skipped.push({ className, reason: 'ซ้ำในรายการ' }); continue; }
        seen.add(className);
        if (existing.has(className)) { skipped.push({ className, reason: 'มีอยู่แล้ว' }); continue; }
        if (!gradeIds.has(item.gradeId)) { skipped.push({ className, reason: 'ไม่พบชั้นปี' }); continue; }

        const hasTeacher = item.teacherId !== undefined && item.teacherId !== null;
        if (hasTeacher && !teacherIds.has(item.teacherId)) { skipped.push({ className, reason: 'ไม่พบครู' }); continue; }
        const hasYear = item.academicYearId !== undefined && item.academicYearId !== null;
        if (hasYear && !yearIds.has(item.academicYearId)) { skipped.push({ className, reason: 'ไม่พบปีการศึกษา' }); continue; }
        const hasCapacity = item.capacity !== undefined && item.capacity !== null;
        if (hasCapacity && !isId(item.capacity)) { skipped.push({ className, reason: 'ความจุไม่ถูกต้อง' }); continue; }

        try {
          created.push(await prisma.class.create({
            data: {
              className,
              gradeId: item.gradeId,
              teacherId: hasTeacher ? item.teacherId : undefined,
              academicYearId: hasYear ? item.academicYearId : (currentYear ? currentYear.id : undefined),
              capacity: hasCapacity ? item.capacity : undefined
            },
            include: { grade: true, homeTeacher: true, academicYear: true }
          }));
        } catch (err) {
          if (err.code === 'P2002') skipped.push({ className, reason: 'มีอยู่แล้ว' });
          else { console.error('Bulk create class item error:', err); skipped.push({ className, reason: 'สร้างไม่สำเร็จ' }); }
        }
      }

      res.json({ created, skipped });
    } catch (error) {
      console.error('Bulk create classes error:', error);
      res.status(500).json({ error: 'ไม่สามารถเพิ่มห้องเรียนได้' });
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

      const rows = await prisma.class.findMany({
        where: { id: { in: unique } },
        include: { _count: { select: { students: true, assessmentRecords: true } } }
      });
      const byId = new Map(rows.map(c => [c.id, c]));

      let deleted = 0;
      const failed = [];
      for (const id of unique) {
        const cls = byId.get(id);
        if (!cls) { failed.push({ id, name: null, reason: 'ไม่พบ' }); continue; }
        if (cls._count.students > 0) {
          failed.push({ id, name: cls.className, reason: 'ยังมีนักเรียนอยู่ในห้องนี้' });
          continue;
        }
        if (cls._count.assessmentRecords > 0) {
          failed.push({ id, name: cls.className, reason: 'ยังมีบันทึกการประเมินของห้องนี้' });
          continue;
        }
        try {
          await prisma.class.delete({ where: { id } });
          deleted++;
        } catch (err) {
          if (err.code === 'P2025') failed.push({ id, name: cls.className, reason: 'ไม่พบ' });
          else if (err.code === 'P2003' || err.code === 'P2014') failed.push({ id, name: cls.className, reason: 'ยังมีข้อมูลที่อ้างถึงห้องนี้อยู่' });
          else { console.error('Bulk delete class item error:', err); failed.push({ id, name: cls.className, reason: 'ลบไม่สำเร็จ' }); }
        }
      }

      res.json({ deleted, failed });
    } catch (error) {
      console.error('Bulk delete classes error:', error);
      res.status(500).json({ error: 'ไม่สามารถลบห้องเรียนได้' });
    }
  },

  // Update class
  async update(req, res) {
    try {
      const { id } = req.params;
      const { className, gradeId, teacherId, academicYearId, capacity, description, status } = req.body;

      const existing = await prisma.class.findFirst({
        where: {
          className,
          NOT: { id: parseInt(id) }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'ชื่อห้องเรียนนี้มีอยู่แล้วในระบบ' });
      }

      const classData = await prisma.class.update({
        where: { id: parseInt(id) },
        data: {
          className,
          gradeId,
          teacherId,
          academicYearId,
          capacity,
          description,
          status
        },
        include: {
          grade: true,
          homeTeacher: true,
          academicYear: true
        }
      });

      res.json(classData);
    } catch (error) {
      console.error('Update class error:', error);
      res.status(500).json({ error: 'ไม่สามารถแก้ไขข้อมูลห้องเรียนได้' });
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
          error: 'ไม่สามารถลบห้องเรียนที่มีนักเรียนอยู่ได้'
        });
      }

      await prisma.class.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'ลบห้องเรียนเรียบร้อยแล้ว' });
    } catch (error) {
      console.error('Delete class error:', error);
      res.status(500).json({ error: 'ไม่สามารถลบห้องเรียนได้' });
    }
  }
};

module.exports = classController;
