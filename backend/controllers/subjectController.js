const Joi = require('joi');
const prisma = require('../config/database');
const audit = require('../services/audit');

const bulkCreateSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    subjectCode: Joi.any(),
    subjectName: Joi.any(),
    gradeId: Joi.number().integer().allow(null, ''),
    teacherId: Joi.number().integer().allow(null, ''),
    academicYearId: Joi.number().integer().allow(null, '')
  }).unknown(true)).min(1).max(200).required()
});
const bulkDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer()).min(1).max(500).required()
});
const text = (v) => (v == null ? '' : String(v).trim());
const idOf = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

const subjectController = {
  // Get all subjects
  async getAll(req, res) {
    try {
      const { teacherId, academicYearId, gradeId, status } = req.query;

      const where = {};
      if (teacherId) where.teacherId = parseInt(teacherId);
      if (academicYearId) where.academicYearId = parseInt(academicYearId);
      if (gradeId) where.gradeId = parseInt(gradeId);
      if (status) where.status = status;

      const subjects = await prisma.subject.findMany({
        where,
        include: {
          teacher: true,
          academicYear: true,
          grade: true,
          _count: {
            select: { tasks: true, qrcodes: true }
          }
        },
        orderBy: { subjectName: 'asc' }
      });

      res.json(subjects);
    } catch (error) {
      console.error('Get subjects error:', error);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลวิชาได้' });
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
          academicYear: true,
          grade: true,
          tasks: {
            orderBy: { taskNumber: 'asc' }
          }
        }
      });

      if (!subject) {
        return res.status(404).json({ error: 'ไม่พบข้อมูลวิชา' });
      }

      res.json(subject);
    } catch (error) {
      console.error('Get subject error:', error);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลวิชาได้' });
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
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลงานได้' });
    }
  },

  // Create subject
  async create(req, res) {
    try {
      const { subjectCode, subjectName, teacherId, gradeId, academicYearId, description, status } = req.body;

      const existingSubject = await prisma.subject.findUnique({
        where: { subjectCode }
      });

      if (existingSubject) {
        return res.status(400).json({ error: 'รหัสวิชานี้มีอยู่แล้วในระบบ' });
      }

      const subject = await prisma.subject.create({
        data: { subjectCode, subjectName, teacherId, gradeId, academicYearId, description, status },
        include: { teacher: true, academicYear: true, grade: true }
      });

      res.status(201).json(subject);
    } catch (error) {
      console.error('Create subject error:', error);
      res.status(500).json({ error: 'ไม่สามารถเพิ่มวิชาได้' });
    }
  },

  // Bulk create: { items: [{ subjectCode, subjectName, gradeId?, teacherId?, academicYearId? }] }
  async bulkCreate(req, res) {
    try {
      const { error, value } = bulkCreateSchema.validate(req.body, { stripUnknown: true });
      if (error) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง: ต้องมีรายวิชา 1–200 รายการ' });
      const items = value.items;

      // Look up referenced rows once (queries are scoped to the current group).
      const ids = (key) => [...new Set(items.map(i => idOf(i[key])).filter(v => v !== null))];
      const [teachers, grades, years, currentYear, existing] = await Promise.all([
        prisma.teacher.findMany({ where: { id: { in: ids('teacherId') } }, select: { id: true } }),
        prisma.grade.findMany({ where: { id: { in: ids('gradeId') } }, select: { id: true } }),
        prisma.academicYear.findMany({ where: { id: { in: ids('academicYearId') } }, select: { id: true } }),
        prisma.academicYear.findFirst({ where: { isCurrent: true }, select: { id: true } }),
        prisma.subject.findMany({
          where: { subjectCode: { in: items.map(i => text(i.subjectCode)).filter(Boolean) } },
          select: { subjectCode: true }
        })
      ]);
      const okTeacher = new Set(teachers.map(t => t.id));
      const okGrade = new Set(grades.map(g => g.id));
      const okYear = new Set(years.map(y => y.id));
      const taken = new Set(existing.map(s => s.subjectCode));
      const seen = new Set();

      const created = [];
      const skipped = [];
      for (const item of items) {
        const subjectCode = text(item.subjectCode);
        const subjectName = text(item.subjectName);
        const skip = (reason) => skipped.push({ subjectCode, reason });
        if (!subjectCode || !subjectName) { skip('ต้องมีรหัสวิชาและชื่อวิชา'); continue; }
        if (subjectCode.length > 20 || subjectName.length > 100) { skip('รหัสหรือชื่อวิชายาวเกินไป'); continue; }
        if (seen.has(subjectCode)) { skip('ซ้ำในรายการ'); continue; }
        seen.add(subjectCode);
        if (taken.has(subjectCode)) { skip('มีอยู่แล้ว'); continue; }

        const teacherId = idOf(item.teacherId) ?? req.user.teacherId ?? null;
        if (teacherId === null) { skip('เลือกครูผู้สอน'); continue; }
        if (!okTeacher.has(teacherId) && teacherId !== req.user.teacherId) { skip('ไม่พบครูผู้สอน'); continue; }
        const gradeId = idOf(item.gradeId);
        if (gradeId !== null && !okGrade.has(gradeId)) { skip('ไม่พบระดับชั้น'); continue; }
        let academicYearId = idOf(item.academicYearId);
        if (academicYearId !== null && !okYear.has(academicYearId)) { skip('ไม่พบปีการศึกษา'); continue; }
        if (academicYearId === null) academicYearId = currentYear ? currentYear.id : null;

        try {
          created.push(await prisma.subject.create({
            data: { subjectCode, subjectName, teacherId, gradeId, academicYearId },
            include: { teacher: true, academicYear: true, grade: true }
          }));
        } catch (e) {
          if (e.code === 'P2002') skip('มีอยู่แล้ว');
          else if (e.code === 'P2003') skip('ไม่พบข้อมูลอ้างอิง');
          else throw e;
        }
      }
      if (created.length) await audit.log('subject.bulk_create', null, { count: created.length }, req);
      res.status(created.length ? 201 : 200).json({ created, skipped });
    } catch (error) {
      console.error('Bulk create subjects error:', error);
      res.status(500).json({ error: 'ไม่สามารถเพิ่มวิชาได้' });
    }
  },

  // Bulk delete: { ids }. Subjects that still have tasks or QR codes are kept.
  async bulkDelete(req, res) {
    try {
      const { error, value } = bulkDeleteSchema.validate(req.body, { stripUnknown: true });
      if (error) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง: ต้องเลือกวิชา 1–500 รายการ' });
      const ids = [...new Set(value.ids)];

      const rows = await prisma.subject.findMany({
        where: { id: { in: ids } },
        select: { id: true, subjectName: true, _count: { select: { tasks: true, qrcodes: true } } }
      });
      const byId = new Map(rows.map(r => [r.id, r]));

      let deleted = 0;
      const failed = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (!row) { failed.push({ id, name: null, reason: 'ไม่พบ' }); continue; }
        const fail = (reason) => failed.push({ id, name: row.subjectName, reason });
        if (row._count.tasks > 0 || row._count.qrcodes > 0) { fail('มีงานหรือ QR ของวิชานี้อยู่'); continue; }
        try {
          await prisma.subject.delete({ where: { id } });
          deleted++;
        } catch (e) {
          if (e.code === 'P2025') fail('ไม่พบ');
          else if (e.code === 'P2003') fail('มีงานหรือ QR ของวิชานี้อยู่');
          else { console.error('Bulk delete subject error:', e); fail('ลบไม่สำเร็จ'); }
        }
      }
      if (deleted) await audit.log('subject.bulk_delete', null, { deleted, failed: failed.length }, req);
      res.json({ deleted, failed });
    } catch (error) {
      console.error('Bulk delete subjects error:', error);
      res.status(500).json({ error: 'ไม่สามารถลบวิชาได้' });
    }
  },

  // Update subject
  async update(req, res) {
    try {
      const { id } = req.params;
      const { subjectCode, subjectName, teacherId, gradeId, academicYearId, description, status } = req.body;

      const existing = await prisma.subject.findFirst({
        where: {
          subjectCode,
          NOT: { id: parseInt(id) }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'รหัสวิชานี้มีอยู่แล้วในระบบ' });
      }

      const subject = await prisma.subject.update({
        where: { id: parseInt(id) },
        data: { subjectCode, subjectName, teacherId, gradeId, academicYearId, description, status },
        include: { teacher: true, academicYear: true, grade: true }
      });

      res.json(subject);
    } catch (error) {
      console.error('Update subject error:', error);
      res.status(500).json({ error: 'ไม่สามารถแก้ไขข้อมูลวิชาได้' });
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
          error: 'ไม่สามารถลบวิชาที่มีงานอยู่ได้'
        });
      }

      // Delete related QR codes
      await prisma.qRCode.deleteMany({
        where: { subjectId: parseInt(id) }
      });

      await prisma.subject.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'ลบวิชาเรียบร้อยแล้ว' });
    } catch (error) {
      console.error('Delete subject error:', error);
      res.status(500).json({ error: 'ไม่สามารถลบวิชาได้' });
    }
  }
};

module.exports = subjectController;
