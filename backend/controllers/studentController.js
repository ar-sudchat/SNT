const Joi = require('joi');
const prisma = require('../config/database');
const { getTenantId } = require('../services/tenantContext');
const audit = require('../services/audit');

const bulkDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer()).min(1).max(500).required()
});

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
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลนักเรียนได้' });
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
        return res.status(404).json({ error: 'ไม่พบข้อมูลนักเรียน' });
      }

      res.json(student);
    } catch (error) {
      console.error('Get student error:', error);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลนักเรียนได้' });
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
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลการส่งงานได้' });
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
        return res.status(400).json({ error: 'รหัสนักเรียนนี้มีอยู่แล้วในระบบ' });
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
      res.status(500).json({ error: 'ไม่สามารถเพิ่มนักเรียนได้' });
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
        return res.status(400).json({ error: 'รหัสนักเรียนนี้มีอยู่แล้วในระบบ' });
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
      res.status(500).json({ error: 'ไม่สามารถแก้ไขข้อมูลนักเรียนได้' });
    }
  },

  // Bulk delete: { ids }. Removes each student's QR codes and submissions, unlinks any
  // student login, then the student (AssessmentScore cascades) in one transaction per student.
  async bulkDelete(req, res) {
    try {
      const { error, value } = bulkDeleteSchema.validate(req.body, { stripUnknown: true });
      if (error) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง: ต้องเลือกนักเรียน 1–500 คน' });
      const ids = [...new Set(value.ids)];
      const tid = getTenantId();

      // Only students in this group are visible here; the rest are reported as not found.
      const rows = await prisma.student.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
      const byId = new Map(rows.map(r => [r.id, r]));

      // A batch transaction on the base client with explicit tenantId filters (the scoped client
      // cannot take part in one transaction with RLS on; mirror its GUC when RLS is enabled).
      const base = prisma.basePrisma;
      const guc = prisma.RLS_ENABLED ? [base.$executeRaw`SELECT set_config('app.tenant_id', ${tid}, true)`] : [];

      let deleted = 0;
      const failed = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (!row) { failed.push({ id, name: null, reason: 'ไม่พบ' }); continue; }
        try {
          await base.$transaction([
            ...guc,
            base.submission.deleteMany({ where: { studentId: id, tenantId: tid } }),
            base.qRCode.deleteMany({ where: { studentId: id, tenantId: tid } }),
            base.user.updateMany({ where: { studentId: id }, data: { studentId: null } }),
            base.student.deleteMany({ where: { id, tenantId: tid } })
          ]);
          deleted++;
        } catch (e) {
          console.error('Bulk delete student error:', e);
          failed.push({ id, name: row.name, reason: 'ลบไม่สำเร็จ' });
        }
      }
      if (deleted) await audit.log('student.bulk_delete', null, { deleted, failed: failed.length }, req);
      res.json({ deleted, failed });
    } catch (error) {
      console.error('Bulk delete students error:', error);
      res.status(500).json({ error: 'ไม่สามารถลบนักเรียนได้' });
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

      res.json({ message: 'ลบนักเรียนเรียบร้อยแล้ว' });
    } catch (error) {
      console.error('Delete student error:', error);
      res.status(500).json({ error: 'ไม่สามารถลบนักเรียนได้' });
    }
  }
};

module.exports = studentController;
