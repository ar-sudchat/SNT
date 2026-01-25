const prisma = require('../config/database');

const monitorController = {
  // Get student monitoring data with all subjects and progress
  async getStudentMonitor(req, res) {
    try {
      const { id } = req.params;
      const { academicYearId } = req.query;

      // Get student with class and grade info
      const student = await prisma.student.findUnique({
        where: { id: parseInt(id) },
        include: {
          class: {
            include: {
              grade: true,
              academicYear: true
            }
          }
        }
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Determine which academic year to use
      const yearId = academicYearId
        ? parseInt(academicYearId)
        : student.class.academicYearId;

      // Get all subjects for the student's grade and academic year
      const subjects = await prisma.subject.findMany({
        where: {
          gradeId: student.class.gradeId,
          academicYearId: yearId,
          status: 'ACTIVE'
        },
        include: {
          teacher: true,
          tasks: {
            where: { status: 'ACTIVE' },
            orderBy: { taskNumber: 'asc' }
          }
        },
        orderBy: { subjectName: 'asc' }
      });

      // Get all submissions for this student
      const submissions = await prisma.submission.findMany({
        where: {
          studentId: parseInt(id),
          task: {
            subject: {
              gradeId: student.class.gradeId,
              academicYearId: yearId
            }
          }
        },
        include: {
          task: true,
          reviewedBy: true
        }
      });

      // Create a map of submissions by taskId
      const submissionMap = {};
      submissions.forEach(sub => {
        submissionMap[sub.taskId] = sub;
      });

      // Build subject progress data
      const subjectProgress = subjects.map(subject => {
        const tasks = subject.tasks.map(task => {
          const submission = submissionMap[task.id];
          return {
            id: task.id,
            taskName: task.taskName,
            taskNumber: task.taskNumber,
            description: task.description,
            deadline: task.deadline,
            submission: submission ? {
              id: submission.id,
              status: submission.status,
              submitDate: submission.submitDate,
              reviewDate: submission.reviewDate,
              reviewedBy: submission.reviewedBy,
              notes: submission.notes
            } : null
          };
        });

        // Calculate progress stats
        const totalTasks = tasks.length;
        const submitted = tasks.filter(t => t.submission && t.submission.status !== 'NOT_SUBMITTED').length;
        const approved = tasks.filter(t => t.submission?.status === 'APPROVED').length;
        const pending = tasks.filter(t => t.submission?.status === 'PENDING').length;
        const rejected = tasks.filter(t => t.submission?.status === 'REJECTED').length;
        const notSubmitted = totalTasks - submitted;

        return {
          id: subject.id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          teacher: subject.teacher,
          progress: {
            totalTasks,
            submitted,
            approved,
            pending,
            rejected,
            notSubmitted,
            percentage: totalTasks > 0 ? Math.round((submitted / totalTasks) * 100) : 0,
            approvedPercentage: totalTasks > 0 ? Math.round((approved / totalTasks) * 100) : 0
          },
          tasks
        };
      });

      // Calculate overall progress
      const totalTasks = subjectProgress.reduce((sum, s) => sum + s.progress.totalTasks, 0);
      const totalSubmitted = subjectProgress.reduce((sum, s) => sum + s.progress.submitted, 0);
      const totalApproved = subjectProgress.reduce((sum, s) => sum + s.progress.approved, 0);

      res.json({
        student: {
          id: student.id,
          studentCode: student.studentCode,
          studentNumber: student.studentNumber,
          name: student.name,
          email: student.email,
          class: student.class
        },
        overallProgress: {
          totalSubjects: subjects.length,
          totalTasks,
          totalSubmitted,
          totalApproved,
          percentage: totalTasks > 0 ? Math.round((totalSubmitted / totalTasks) * 100) : 0,
          approvedPercentage: totalTasks > 0 ? Math.round((totalApproved / totalTasks) * 100) : 0
        },
        subjects: subjectProgress
      });
    } catch (error) {
      console.error('Get student monitor error:', error);
      res.status(500).json({ error: 'Failed to fetch student monitor data' });
    }
  },

  // Get class monitoring data with all students progress
  async getClassMonitor(req, res) {
    try {
      const { id } = req.params;
      const { subjectId } = req.query;

      // Get class with students
      const classData = await prisma.class.findUnique({
        where: { id: parseInt(id) },
        include: {
          grade: true,
          academicYear: true,
          homeTeacher: true,
          students: {
            where: { status: 'ACTIVE' },
            orderBy: { studentCode: 'asc' }
          }
        }
      });

      if (!classData) {
        return res.status(404).json({ error: 'Class not found' });
      }

      // Get subjects for this class's grade
      const subjectWhere = {
        gradeId: classData.gradeId,
        academicYearId: classData.academicYearId,
        status: 'ACTIVE'
      };
      if (subjectId) {
        subjectWhere.id = parseInt(subjectId);
      }

      const subjects = await prisma.subject.findMany({
        where: subjectWhere,
        include: {
          teacher: true,
          tasks: {
            where: { status: 'ACTIVE' },
            orderBy: { taskNumber: 'asc' }
          }
        },
        orderBy: { subjectName: 'asc' }
      });

      // Get all submissions for students in this class
      const studentIds = classData.students.map(s => s.id);
      const taskIds = subjects.flatMap(s => s.tasks.map(t => t.id));

      const submissions = await prisma.submission.findMany({
        where: {
          studentId: { in: studentIds },
          taskId: { in: taskIds }
        }
      });

      // Create submission map: studentId -> taskId -> submission
      const submissionMap = {};
      submissions.forEach(sub => {
        if (!submissionMap[sub.studentId]) {
          submissionMap[sub.studentId] = {};
        }
        submissionMap[sub.studentId][sub.taskId] = sub;
      });

      // Build student progress data
      const studentsProgress = classData.students.map(student => {
        const studentSubs = submissionMap[student.id] || {};

        const subjectStats = subjects.map(subject => {
          const tasks = subject.tasks;
          const submitted = tasks.filter(t => studentSubs[t.id] && studentSubs[t.id].status !== 'NOT_SUBMITTED').length;
          const approved = tasks.filter(t => studentSubs[t.id]?.status === 'APPROVED').length;
          const pending = tasks.filter(t => studentSubs[t.id]?.status === 'PENDING').length;
          const rejected = tasks.filter(t => studentSubs[t.id]?.status === 'REJECTED').length;

          return {
            subjectId: subject.id,
            subjectName: subject.subjectName,
            totalTasks: tasks.length,
            submitted,
            approved,
            pending,
            rejected,
            percentage: tasks.length > 0 ? Math.round((submitted / tasks.length) * 100) : 0
          };
        });

        const totalTasks = subjectStats.reduce((sum, s) => sum + s.totalTasks, 0);
        const totalSubmitted = subjectStats.reduce((sum, s) => sum + s.submitted, 0);
        const totalApproved = subjectStats.reduce((sum, s) => sum + s.approved, 0);

        return {
          id: student.id,
          studentCode: student.studentCode,
          studentNumber: student.studentNumber,
          name: student.name,
          overallProgress: {
            totalTasks,
            totalSubmitted,
            totalApproved,
            percentage: totalTasks > 0 ? Math.round((totalSubmitted / totalTasks) * 100) : 0,
            approvedPercentage: totalTasks > 0 ? Math.round((totalApproved / totalTasks) * 100) : 0
          },
          subjects: subjectStats
        };
      });

      // Calculate class summary
      const totalStudents = studentsProgress.length;
      const avgProgress = totalStudents > 0
        ? Math.round(studentsProgress.reduce((sum, s) => sum + s.overallProgress.percentage, 0) / totalStudents)
        : 0;
      const avgApproved = totalStudents > 0
        ? Math.round(studentsProgress.reduce((sum, s) => sum + s.overallProgress.approvedPercentage, 0) / totalStudents)
        : 0;

      res.json({
        class: {
          id: classData.id,
          className: classData.className,
          grade: classData.grade,
          academicYear: classData.academicYear,
          homeTeacher: classData.homeTeacher,
          totalStudents
        },
        summary: {
          avgProgress,
          avgApproved,
          subjects: subjects.map(s => ({
            id: s.id,
            subjectCode: s.subjectCode,
            subjectName: s.subjectName,
            teacher: s.teacher,
            totalTasks: s.tasks.length
          }))
        },
        students: studentsProgress
      });
    } catch (error) {
      console.error('Get class monitor error:', error);
      res.status(500).json({ error: 'Failed to fetch class monitor data' });
    }
  },

  // Get subject monitoring data - all students and their submissions for this subject
  async getSubjectMonitor(req, res) {
    try {
      const { id } = req.params;
      const { classId } = req.query;

      // Get subject with tasks
      const subject = await prisma.subject.findUnique({
        where: { id: parseInt(id) },
        include: {
          teacher: true,
          grade: true,
          academicYear: true,
          tasks: {
            where: { status: 'ACTIVE' },
            orderBy: { taskNumber: 'asc' }
          }
        }
      });

      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      // Build student filter - match subject's grade and academic year, optionally filter by class
      const studentWhere = {
        status: 'ACTIVE',
        class: {
          gradeId: subject.gradeId,
          academicYearId: subject.academicYearId,
          status: 'ACTIVE'
        }
      };

      // If classId is provided, filter by specific class
      if (classId) {
        studentWhere.classId = parseInt(classId);
      }

      // Get students based on filters
      const students = await prisma.student.findMany({
        where: studentWhere,
        include: {
          class: true
        },
        orderBy: [
          { class: { className: 'asc' } },
          { studentNumber: 'asc' },
          { studentCode: 'asc' }
        ]
      });

      // Get all submissions for these students and this subject's tasks
      const studentIds = students.map(s => s.id);
      const taskIds = subject.tasks.map(t => t.id);

      const submissions = await prisma.submission.findMany({
        where: {
          studentId: { in: studentIds },
          taskId: { in: taskIds }
        }
      });

      // Create submission map: studentId -> taskId -> submission
      const submissionMap = {};
      submissions.forEach(sub => {
        if (!submissionMap[sub.studentId]) {
          submissionMap[sub.studentId] = {};
        }
        submissionMap[sub.studentId][sub.taskId] = sub;
      });

      // Build student data with submissions
      const studentsData = students.map(student => {
        const studentSubs = submissionMap[student.id] || {};

        const submissionsData = subject.tasks.map(task => ({
          taskId: task.id,
          taskNumber: task.taskNumber,
          status: studentSubs[task.id]?.status || 'NOT_SUBMITTED',
          score: studentSubs[task.id]?.score
        }));

        // Calculate progress
        const totalTasks = subject.tasks.length;
        const submitted = submissionsData.filter(s => s.status !== 'NOT_SUBMITTED').length;
        const approved = submissionsData.filter(s => s.status === 'APPROVED').length;

        return {
          id: student.id,
          studentCode: student.studentCode,
          studentNumber: student.studentNumber,
          name: student.name,
          classId: student.classId,
          className: student.class.className,
          progress: {
            totalTasks,
            submitted,
            approved,
            percentage: totalTasks > 0 ? Math.round((submitted / totalTasks) * 100) : 0,
            approvedPercentage: totalTasks > 0 ? Math.round((approved / totalTasks) * 100) : 0
          },
          submissions: submissionsData
        };
      });

      // Calculate summary
      const totalStudents = studentsData.length;
      const totalTasks = subject.tasks.length;
      const avgProgress = totalStudents > 0
        ? Math.round(studentsData.reduce((sum, s) => sum + s.progress.percentage, 0) / totalStudents)
        : 0;

      res.json({
        subject: {
          id: subject.id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          teacher: subject.teacher,
          grade: subject.grade,
          academicYear: subject.academicYear
        },
        summary: {
          totalStudents,
          totalTasks,
          avgProgress
        },
        tasks: subject.tasks.map(t => ({
          id: t.id,
          taskName: t.taskName,
          taskNumber: t.taskNumber,
          deadline: t.deadline,
          scoringType: t.scoringType,
          maxScore: t.maxScore
        })),
        students: studentsData
      });
    } catch (error) {
      console.error('Get subject monitor error:', error);
      res.status(500).json({ error: 'Failed to fetch subject monitor data' });
    }
  },

  // Parse QR code and return student/subject info
  async parseQRCode(req, res) {
    try {
      const { qrData } = req.body;

      if (!qrData) {
        return res.status(400).json({ error: 'QR data is required' });
      }

      // QR format: SNT-{studentCode}-{subjectCode}-{academicYear}
      // Example: SNT-671101-MA101-2567
      const parts = qrData.split('-');

      if (parts.length < 4 || parts[0] !== 'SNT') {
        return res.status(400).json({ error: 'Invalid QR code format' });
      }

      const studentCode = parts[1];
      const subjectCode = parts[2];
      const academicYear = parts[3];

      // Find student
      const student = await prisma.student.findUnique({
        where: { studentCode },
        include: {
          class: {
            include: {
              grade: true,
              academicYear: true
            }
          }
        }
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Find subject
      const subject = await prisma.subject.findUnique({
        where: { subjectCode },
        include: {
          teacher: true,
          academicYear: true
        }
      });

      // Find academic year
      const year = await prisma.academicYear.findUnique({
        where: { year: academicYear }
      });

      res.json({
        valid: true,
        studentId: student.id,
        student: {
          id: student.id,
          studentCode: student.studentCode,
          name: student.name,
          class: student.class
        },
        subject: subject ? {
          id: subject.id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          teacher: subject.teacher
        } : null,
        academicYear: year,
        redirectUrl: `/monitor/student/${student.id}${subject ? `?subjectId=${subject.id}` : ''}`
      });
    } catch (error) {
      console.error('Parse QR code error:', error);
      res.status(500).json({ error: 'Failed to parse QR code' });
    }
  },

  // Get subject tasks with student submission status (for quick recording)
  async getSubjectTasks(req, res) {
    try {
      const { studentId, subjectId } = req.params;

      // Get subject with tasks
      const subject = await prisma.subject.findUnique({
        where: { id: parseInt(subjectId) },
        include: {
          teacher: true,
          tasks: {
            where: { status: 'ACTIVE' },
            orderBy: { taskNumber: 'asc' }
          }
        }
      });

      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      // Get student
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

      // Get submissions
      const submissions = await prisma.submission.findMany({
        where: {
          studentId: parseInt(studentId),
          task: { subjectId: parseInt(subjectId) }
        },
        include: {
          reviewedBy: true
        }
      });

      const submissionMap = {};
      submissions.forEach(sub => {
        submissionMap[sub.taskId] = sub;
      });

      const tasks = subject.tasks.map(task => ({
        id: task.id,
        taskName: task.taskName,
        taskNumber: task.taskNumber,
        description: task.description,
        deadline: task.deadline,
        submission: submissionMap[task.id] || null
      }));

      res.json({
        student,
        subject: {
          id: subject.id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          teacher: subject.teacher
        },
        tasks
      });
    } catch (error) {
      console.error('Get subject tasks error:', error);
      res.status(500).json({ error: 'Failed to fetch subject tasks' });
    }
  }
};

module.exports = monitorController;
