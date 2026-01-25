const prisma = require('../config/database');

const reportController = {
  // Admin overview
  async adminOverview(req, res) {
    try {
      const [studentCount, teacherCount, subjectCount, taskCount] = await Promise.all([
        prisma.student.count({ where: { status: 'ACTIVE' } }),
        prisma.teacher.count({ where: { status: 'ACTIVE' } }),
        prisma.subject.count({ where: { status: 'ACTIVE' } }),
        prisma.task.count({ where: { status: 'ACTIVE' } })
      ]);

      const submissions = await prisma.submission.groupBy({
        by: ['status'],
        _count: true
      });

      const submissionStats = {
        total: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
        notSubmitted: 0
      };

      submissions.forEach(s => {
        submissionStats.total += s._count;
        switch (s.status) {
          case 'APPROVED': submissionStats.approved = s._count; break;
          case 'REJECTED': submissionStats.rejected = s._count; break;
          case 'PENDING': submissionStats.pending = s._count; break;
          case 'NOT_SUBMITTED': submissionStats.notSubmitted = s._count; break;
        }
      });

      // Calculate expected submissions (students * tasks)
      const expectedSubmissions = studentCount * taskCount;

      res.json({
        counts: {
          students: studentCount,
          teachers: teacherCount,
          subjects: subjectCount,
          tasks: taskCount
        },
        submissions: submissionStats,
        expectedSubmissions,
        submissionRate: expectedSubmissions > 0
          ? ((submissionStats.approved / expectedSubmissions) * 100).toFixed(1)
          : 0
      });
    } catch (error) {
      console.error('Admin overview error:', error);
      res.status(500).json({ error: 'Failed to fetch overview' });
    }
  },

  // Admin statistics
  async adminStatistics(req, res) {
    try {
      const tasks = await prisma.task.findMany({
        where: { status: 'ACTIVE' },
        include: {
          subject: true,
          submissions: true,
          _count: {
            select: { submissions: true }
          }
        },
        orderBy: [
          { subject: { subjectName: 'asc' } },
          { taskNumber: 'asc' }
        ]
      });

      const totalStudents = await prisma.student.count({
        where: { status: 'ACTIVE' }
      });

      const taskStats = tasks.map(task => {
        const approved = task.submissions.filter(s => s.status === 'APPROVED').length;
        const rejected = task.submissions.filter(s => s.status === 'REJECTED').length;
        const pending = task.submissions.filter(s => s.status === 'PENDING').length;
        const notSubmitted = totalStudents - approved - rejected - pending;

        return {
          taskId: task.id,
          taskName: task.taskName,
          taskNumber: task.taskNumber,
          subjectName: task.subject.subjectName,
          approved,
          rejected,
          pending,
          notSubmitted,
          total: totalStudents,
          approvalRate: totalStudents > 0
            ? ((approved / totalStudents) * 100).toFixed(1)
            : 0
        };
      });

      res.json(taskStats);
    } catch (error) {
      console.error('Admin statistics error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  },

  // Teacher overview (like admin but only for teacher's subjects)
  async teacherOverview(req, res) {
    try {
      const teacherId = req.user.teacherId || req.user.teacher?.id;

      if (!teacherId) {
        return res.status(400).json({ error: 'Teacher ID not found' });
      }

      // Get teacher's subjects
      const subjects = await prisma.subject.findMany({
        where: { teacherId, status: 'ACTIVE' },
        include: {
          tasks: { where: { status: 'ACTIVE' } },
          _count: { select: { qrcodes: true } }
        }
      });

      const subjectIds = subjects.map(s => s.id);
      const taskIds = subjects.flatMap(s => s.tasks.map(t => t.id));

      // Count unique students from QRCodes
      const qrcodes = await prisma.qRCode.findMany({
        where: { subjectId: { in: subjectIds } },
        select: { studentId: true }
      });
      const uniqueStudentIds = [...new Set(qrcodes.map(q => q.studentId))];
      const studentCount = uniqueStudentIds.length;

      // Get submission stats for teacher's tasks
      const submissions = await prisma.submission.findMany({
        where: { taskId: { in: taskIds } }
      });

      const submissionStats = {
        total: submissions.length,
        approved: submissions.filter(s => s.status === 'APPROVED').length,
        rejected: submissions.filter(s => s.status === 'REJECTED').length,
        pending: submissions.filter(s => s.status === 'PENDING').length,
        notSubmitted: 0
      };

      // Calculate expected submissions
      const expectedSubmissions = studentCount * taskIds.length;
      submissionStats.notSubmitted = expectedSubmissions - submissionStats.approved - submissionStats.rejected - submissionStats.pending;
      if (submissionStats.notSubmitted < 0) submissionStats.notSubmitted = 0;

      res.json({
        counts: {
          students: studentCount,
          subjects: subjects.length,
          tasks: taskIds.length
        },
        submissions: submissionStats,
        expectedSubmissions,
        submissionRate: expectedSubmissions > 0
          ? ((submissionStats.approved / expectedSubmissions) * 100).toFixed(1)
          : 0
      });
    } catch (error) {
      console.error('Teacher overview error:', error);
      res.status(500).json({ error: 'Failed to fetch overview' });
    }
  },

  // Teacher statistics (tasks with stats for teacher's subjects only)
  async teacherStatistics(req, res) {
    try {
      const teacherId = req.user.teacherId || req.user.teacher?.id;

      if (!teacherId) {
        return res.status(400).json({ error: 'Teacher ID not found' });
      }

      // Get tasks for teacher's subjects
      const tasks = await prisma.task.findMany({
        where: {
          status: 'ACTIVE',
          subject: { teacherId }
        },
        include: {
          subject: true,
          submissions: true
        },
        orderBy: [
          { subject: { subjectName: 'asc' } },
          { taskNumber: 'asc' }
        ]
      });

      // Get student count per subject
      const subjectStudentCounts = {};
      for (const task of tasks) {
        if (!subjectStudentCounts[task.subjectId]) {
          const qrcodeCount = await prisma.qRCode.count({
            where: { subjectId: task.subjectId }
          });
          subjectStudentCounts[task.subjectId] = qrcodeCount;
        }
      }

      const taskStats = tasks.map(task => {
        const totalStudents = subjectStudentCounts[task.subjectId] || 0;
        const approved = task.submissions.filter(s => s.status === 'APPROVED').length;
        const rejected = task.submissions.filter(s => s.status === 'REJECTED').length;
        const pending = task.submissions.filter(s => s.status === 'PENDING').length;
        const notSubmitted = Math.max(0, totalStudents - approved - rejected - pending);

        return {
          taskId: task.id,
          taskName: task.taskName,
          taskNumber: task.taskNumber,
          subjectId: task.subject.id,
          subjectName: task.subject.subjectName,
          approved,
          rejected,
          pending,
          notSubmitted,
          total: totalStudents,
          approvalRate: totalStudents > 0
            ? ((approved / totalStudents) * 100).toFixed(1)
            : 0
        };
      });

      res.json(taskStats);
    } catch (error) {
      console.error('Teacher statistics error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  },

  // Teacher subjects
  async teacherSubjects(req, res) {
    try {
      const teacherId = req.user.teacherId || req.user.teacher?.id;

      if (!teacherId) {
        return res.status(400).json({ error: 'Teacher ID not found' });
      }

      const subjects = await prisma.subject.findMany({
        where: {
          teacherId,
          status: 'ACTIVE'
        },
        include: {
          tasks: {
            where: { status: 'ACTIVE' },
            include: {
              _count: {
                select: { submissions: true }
              }
            }
          },
          _count: {
            select: { qrcodes: true }
          }
        }
      });

      res.json(subjects);
    } catch (error) {
      console.error('Teacher subjects error:', error);
      res.status(500).json({ error: 'Failed to fetch subjects' });
    }
  },

  // Subject summary
  async subjectSummary(req, res) {
    try {
      const { subjectId } = req.params;

      const subject = await prisma.subject.findUnique({
        where: { id: parseInt(subjectId) },
        include: {
          tasks: {
            where: { status: 'ACTIVE' },
            orderBy: { taskNumber: 'asc' }
          }
        }
      });

      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      // Get all students who have QR codes for this subject
      const qrcodes = await prisma.qRCode.findMany({
        where: { subjectId: parseInt(subjectId) },
        include: { student: true }
      });

      const studentIds = qrcodes.map(q => q.studentId);
      const totalStudents = studentIds.length;

      // Get submissions for each task
      const taskSummaries = await Promise.all(
        subject.tasks.map(async (task) => {
          const submissions = await prisma.submission.findMany({
            where: {
              taskId: task.id,
              studentId: { in: studentIds }
            }
          });

          const approved = submissions.filter(s => s.status === 'APPROVED').length;
          const rejected = submissions.filter(s => s.status === 'REJECTED').length;
          const pending = submissions.filter(s => s.status === 'PENDING').length;
          const notSubmitted = totalStudents - approved - rejected - pending;

          return {
            taskId: task.id,
            taskName: task.taskName,
            taskNumber: task.taskNumber,
            approved,
            rejected,
            pending,
            notSubmitted,
            total: totalStudents
          };
        })
      );

      res.json({
        subject: {
          id: subject.id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName
        },
        totalStudents,
        tasks: taskSummaries
      });
    } catch (error) {
      console.error('Subject summary error:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  },

  // Student summary (for teacher view)
  async studentSummary(req, res) {
    try {
      const { studentId } = req.params;

      const student = await prisma.student.findUnique({
        where: { id: parseInt(studentId) },
        include: {
          class: {
            include: { grade: true }
          }
        }
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get all QR codes for this student
      const qrcodes = await prisma.qRCode.findMany({
        where: { studentId: parseInt(studentId) },
        include: {
          subject: {
            include: {
              tasks: {
                where: { status: 'ACTIVE' },
                orderBy: { taskNumber: 'asc' }
              }
            }
          }
        }
      });

      // Get all submissions for this student
      const submissions = await prisma.submission.findMany({
        where: { studentId: parseInt(studentId) },
        include: {
          task: true,
          reviewedBy: true
        }
      });

      const submissionMap = {};
      submissions.forEach(s => {
        submissionMap[s.taskId] = s;
      });

      // Build summary by subject
      const subjectSummaries = qrcodes.map(qr => ({
        subject: {
          id: qr.subject.id,
          subjectCode: qr.subject.subjectCode,
          subjectName: qr.subject.subjectName
        },
        tasks: qr.subject.tasks.map(task => ({
          taskId: task.id,
          taskName: task.taskName,
          taskNumber: task.taskNumber,
          submission: submissionMap[task.id] || null
        }))
      }));

      res.json({
        student: {
          id: student.id,
          studentCode: student.studentCode,
          name: student.name,
          class: student.class
        },
        subjects: subjectSummaries
      });
    } catch (error) {
      console.error('Student summary error:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  },

  // Student's own submissions
  async studentSubmissions(req, res) {
    try {
      const studentId = req.user.studentId || req.user.student?.id;

      if (!studentId) {
        return res.status(400).json({ error: 'Student ID not found' });
      }

      // Get all QR codes for this student
      const qrcodes = await prisma.qRCode.findMany({
        where: { studentId },
        include: {
          subject: {
            include: {
              tasks: {
                where: { status: 'ACTIVE' },
                orderBy: { taskNumber: 'asc' }
              }
            }
          }
        }
      });

      // Get all submissions
      const submissions = await prisma.submission.findMany({
        where: { studentId },
        include: {
          task: true,
          reviewedBy: true
        }
      });

      const submissionMap = {};
      submissions.forEach(s => {
        submissionMap[s.taskId] = s;
      });

      // Build summary by subject
      const subjectSummaries = qrcodes.map(qr => ({
        subject: {
          id: qr.subject.id,
          subjectCode: qr.subject.subjectCode,
          subjectName: qr.subject.subjectName
        },
        tasks: qr.subject.tasks.map(task => ({
          taskId: task.id,
          taskName: task.taskName,
          taskNumber: task.taskNumber,
          deadline: task.deadline,
          submission: submissionMap[task.id] || null
        }))
      }));

      res.json(subjectSummaries);
    } catch (error) {
      console.error('Student submissions error:', error);
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  },

  // Export report
  async exportReport(req, res) {
    try {
      const { type } = req.params;
      const { subjectId, classId } = req.query;

      let data = [];
      let filename = 'report';

      if (type === 'submissions') {
        const where = {};
        if (subjectId) {
          where.task = { subjectId: parseInt(subjectId) };
        }
        if (classId) {
          where.student = { classId: parseInt(classId) };
        }

        const submissions = await prisma.submission.findMany({
          where,
          include: {
            student: {
              include: { class: true }
            },
            task: {
              include: { subject: true }
            },
            reviewedBy: true
          }
        });

        data = submissions.map(s => ({
          'Student Code': s.student.studentCode,
          'Student Name': s.student.name,
          'Class': s.student.class.className,
          'Subject': s.task.subject.subjectName,
          'Task': s.task.taskName,
          'Task Number': s.task.taskNumber,
          'Status': s.status,
          'Submit Date': s.submitDate?.toISOString() || '',
          'Review Date': s.reviewDate?.toISOString() || '',
          'Reviewed By': s.reviewedBy?.name || '',
          'Notes': s.notes || ''
        }));

        filename = 'submissions_report';
      }

      // Convert to CSV
      if (data.length === 0) {
        return res.status(404).json({ error: 'No data to export' });
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}.csv`);
      res.send('\uFEFF' + csvContent); // Add BOM for Excel UTF-8
    } catch (error) {
      console.error('Export report error:', error);
      res.status(500).json({ error: 'Failed to export report' });
    }
  }
};

module.exports = reportController;
