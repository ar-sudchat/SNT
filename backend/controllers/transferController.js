const prisma = require('../config/database');

const transferController = {
  // Transfer single student to a new class
  async transferStudent(req, res) {
    try {
      const { studentId, newClassId } = req.body;

      // Verify student exists
      const student = await prisma.student.findUnique({
        where: { id: parseInt(studentId) },
        include: { class: true }
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Verify new class exists
      const newClass = await prisma.class.findUnique({
        where: { id: parseInt(newClassId) },
        include: { _count: { select: { students: true } } }
      });

      if (!newClass) {
        return res.status(404).json({ error: 'Class not found' });
      }

      // Check capacity
      if (newClass._count.students >= newClass.capacity) {
        return res.status(400).json({ error: 'Class is at full capacity' });
      }

      // Transfer student
      const updatedStudent = await prisma.student.update({
        where: { id: parseInt(studentId) },
        data: { classId: parseInt(newClassId) },
        include: { class: { include: { grade: true } } }
      });

      res.json({
        message: 'Student transferred successfully',
        student: updatedStudent,
        fromClass: student.class.className,
        toClass: newClass.className
      });
    } catch (error) {
      console.error('Transfer student error:', error);
      res.status(500).json({ error: 'Failed to transfer student' });
    }
  },

  // Transfer all students from one class to another
  async transferBulk(req, res) {
    try {
      const { fromClassId, toClassId, studentIds } = req.body;

      // Get students to transfer
      const students = studentIds
        ? await prisma.student.findMany({
            where: { id: { in: studentIds.map(id => parseInt(id)) } }
          })
        : await prisma.student.findMany({
            where: { classId: parseInt(fromClassId) }
          });

      if (students.length === 0) {
        return res.status(400).json({ error: 'No students to transfer' });
      }

      // Verify target class
      const toClass = await prisma.class.findUnique({
        where: { id: parseInt(toClassId) },
        include: { _count: { select: { students: true } } }
      });

      if (!toClass) {
        return res.status(404).json({ error: 'Target class not found' });
      }

      // Check capacity
      const availableSlots = toClass.capacity - toClass._count.students;
      if (students.length > availableSlots) {
        return res.status(400).json({
          error: `Not enough capacity. Available: ${availableSlots}, Requested: ${students.length}`
        });
      }

      // Transfer all students
      const result = await prisma.student.updateMany({
        where: { id: { in: students.map(s => s.id) } },
        data: { classId: parseInt(toClassId) }
      });

      res.json({
        message: `${result.count} students transferred successfully`,
        count: result.count
      });
    } catch (error) {
      console.error('Bulk transfer error:', error);
      res.status(500).json({ error: 'Failed to transfer students' });
    }
  },

  // Promote students to next grade/class for new academic year
  async promoteStudents(req, res) {
    try {
      const { promotions, newAcademicYearId } = req.body;
      // promotions = [{ fromClassId, toClassId }]

      if (!promotions || promotions.length === 0) {
        return res.status(400).json({ error: 'No promotion mappings provided' });
      }

      const results = [];
      let totalTransferred = 0;

      for (const mapping of promotions) {
        const { fromClassId, toClassId } = mapping;

        // Get students in the source class
        const students = await prisma.student.findMany({
          where: { classId: parseInt(fromClassId) }
        });

        if (students.length === 0) continue;

        // Transfer students
        const result = await prisma.student.updateMany({
          where: { classId: parseInt(fromClassId) },
          data: { classId: parseInt(toClassId) }
        });

        totalTransferred += result.count;
        results.push({
          fromClassId,
          toClassId,
          count: result.count
        });
      }

      res.json({
        message: `Promoted ${totalTransferred} students successfully`,
        totalTransferred,
        details: results
      });
    } catch (error) {
      console.error('Promote students error:', error);
      res.status(500).json({ error: 'Failed to promote students' });
    }
  },

  // Get promotion preview - suggest class mappings based on grade order
  async getPromotionPreview(req, res) {
    try {
      const { fromAcademicYearId, toAcademicYearId } = req.query;

      // Get all grades ordered
      const grades = await prisma.grade.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { gradeName: 'asc' }
      });

      // Get classes from source academic year
      const sourceClasses = await prisma.class.findMany({
        where: { academicYearId: parseInt(fromAcademicYearId) },
        include: {
          grade: true,
          _count: { select: { students: true } }
        },
        orderBy: [{ gradeId: 'asc' }, { className: 'asc' }]
      });

      // Get classes from target academic year
      const targetClasses = await prisma.class.findMany({
        where: { academicYearId: parseInt(toAcademicYearId) },
        include: { grade: true },
        orderBy: [{ gradeId: 'asc' }, { className: 'asc' }]
      });

      // Create grade index map for ordering
      const gradeOrder = {};
      grades.forEach((g, index) => {
        gradeOrder[g.id] = index;
      });

      // Suggest mappings: each class maps to next grade's equivalent class
      const suggestions = sourceClasses.map(sourceClass => {
        const currentGradeIndex = gradeOrder[sourceClass.gradeId];
        const nextGradeIndex = currentGradeIndex + 1;

        // Find next grade
        const nextGrade = grades.find(g => gradeOrder[g.id] === nextGradeIndex);

        // Find matching class in next grade (same suffix if possible)
        let suggestedTarget = null;
        if (nextGrade) {
          // Try to find class with similar name pattern
          const classNumber = sourceClass.className.match(/\d+$/)?.[0] || '1';
          suggestedTarget = targetClasses.find(
            tc => tc.gradeId === nextGrade.id && tc.className.includes(classNumber)
          );
          // If no exact match, use first class of next grade
          if (!suggestedTarget) {
            suggestedTarget = targetClasses.find(tc => tc.gradeId === nextGrade.id);
          }
        }

        return {
          sourceClass: {
            id: sourceClass.id,
            className: sourceClass.className,
            gradeName: sourceClass.grade.gradeName,
            studentCount: sourceClass._count.students
          },
          suggestedTargetClass: suggestedTarget ? {
            id: suggestedTarget.id,
            className: suggestedTarget.className,
            gradeName: suggestedTarget.grade.gradeName
          } : null,
          isGraduating: !nextGrade // Last grade, students graduate
        };
      });

      res.json({
        suggestions,
        targetClasses: targetClasses.map(c => ({
          id: c.id,
          className: c.className,
          gradeName: c.grade.gradeName
        }))
      });
    } catch (error) {
      console.error('Get promotion preview error:', error);
      res.status(500).json({ error: 'Failed to get promotion preview' });
    }
  }
};

module.exports = transferController;
