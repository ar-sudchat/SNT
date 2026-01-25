const csv = require('csv-parser');
const xlsx = require('xlsx');
const { Readable } = require('stream');
const prisma = require('../config/database');

const importController = {
  // Download template
  async downloadTemplate(req, res) {
    try {
      const { type } = req.params;

      const templates = {
        academicYear: 'Year,Name,StartDate,EndDate,IsCurrent,Status\n2567,ปีการศึกษา 2567,2024-05-16,2025-03-31,true,Active\n2568,ปีการศึกษา 2568,2025-05-16,2026-03-31,false,Active',
        grade: 'GradeName,Description,Status\nม.1,มัธยมศึกษาปีที่ 1,Active\nม.2,มัธยมศึกษาปีที่ 2,Active',
        class: 'ClassName,GradeName,TeacherCode,AcademicYear,Capacity,Status\nม.1/1,ม.1,T001,2567,40,Active',
        student: 'StudentCode,StudentNumber,Name,ClassName,Email,Status\n6001,1,นก ทองคำ,ม.1/1,nok@school.ac.th,Active\n6002,2,ก้อง มั่นคง,ม.1/1,kong@school.ac.th,Active',
        teacher: 'TeacherCode,Name,Email,Status\nT001,นาย ปรีชา สมใจ,preecha@school.ac.th,Active',
        subject: 'SubjectCode,SubjectName,GradeName,AcademicYear,TeacherCode,Description,Status\nMA101,คณิตศาสตร์ ม.1,ม.1,2567,T001,วิชาคณิตศาสตร์ ม.1,Active',
        task: 'SubjectCode,TaskName,TaskNumber,Description,Deadline,ScoringType,MaxScore,Status\nMA101,การบ้านเศษส่วน,1,แสดงวิธีทำโจทย์เศษส่วน,2025-02-10,PASS_FAIL,,Active'
      };

      if (!templates[type]) {
        return res.status(400).json({ error: 'Invalid template type' });
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_template.csv`);
      res.send('\uFEFF' + templates[type]); // Add BOM for Excel UTF-8
    } catch (error) {
      console.error('Download template error:', error);
      res.status(500).json({ error: 'Failed to download template' });
    }
  },

  // Parse file content
  async parseFile(file) {
    const buffer = file.buffer;
    const mimetype = file.mimetype;

    if (mimetype === 'application/json') {
      return JSON.parse(buffer.toString());
    }

    if (mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      return new Promise((resolve, reject) => {
        const results = [];
        const stream = Readable.from(buffer.toString());
        stream
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', () => resolve(results))
          .on('error', reject);
      });
    }

    // Excel file
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(sheet);
  },

  // Import academic years
  async importAcademicYears(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const data = await importController.parseFile(req.file);
      const results = { success: [], failed: [] };

      for (const row of data) {
        try {
          const year = row.Year || row.year;
          const name = row.Name || row.name || `ปีการศึกษา ${year}`;
          const startDate = row.StartDate || row.startDate;
          const endDate = row.EndDate || row.endDate;
          const isCurrent = (row.IsCurrent || row.isCurrent || 'false').toString().toLowerCase() === 'true';
          const status = (row.Status || row.status || 'Active').toUpperCase();

          if (!year) {
            results.failed.push({ row, reason: 'Year is required' });
            continue;
          }

          const existing = await prisma.academicYear.findUnique({
            where: { year: year.toString() }
          });

          if (existing) {
            results.failed.push({ row, reason: 'Academic year already exists' });
            continue;
          }

          // If setting as current, unset other current years
          if (isCurrent) {
            await prisma.academicYear.updateMany({
              where: { isCurrent: true },
              data: { isCurrent: false }
            });
          }

          const academicYear = await prisma.academicYear.create({
            data: {
              year: year.toString(),
              name,
              startDate: startDate ? new Date(startDate) : null,
              endDate: endDate ? new Date(endDate) : null,
              isCurrent,
              status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            }
          });

          results.success.push(academicYear);
        } catch (err) {
          results.failed.push({ row, reason: err.message });
        }
      }

      res.json({
        message: `Imported ${results.success.length} academic years, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Import academic years error:', error);
      res.status(500).json({ error: 'Failed to import academic years' });
    }
  },

  // Import grades
  async importGrades(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const data = await importController.parseFile(req.file);
      const results = { success: [], failed: [] };

      for (const row of data) {
        try {
          const gradeName = row.GradeName || row.gradeName;
          const description = row.Description || row.description || '';
          const status = (row.Status || row.status || 'Active').toUpperCase();

          if (!gradeName) {
            results.failed.push({ row, reason: 'GradeName is required' });
            continue;
          }

          const existing = await prisma.grade.findUnique({
            where: { gradeName }
          });

          if (existing) {
            results.failed.push({ row, reason: 'Grade already exists' });
            continue;
          }

          const grade = await prisma.grade.create({
            data: {
              gradeName,
              description,
              status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            }
          });

          results.success.push(grade);
        } catch (err) {
          results.failed.push({ row, reason: err.message });
        }
      }

      res.json({
        message: `Imported ${results.success.length} grades, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Import grades error:', error);
      res.status(500).json({ error: 'Failed to import grades' });
    }
  },

  // Import classes
  async importClasses(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const data = await importController.parseFile(req.file);
      const results = { success: [], failed: [] };

      for (const row of data) {
        try {
          const className = row.ClassName || row.className;
          const gradeName = row.GradeName || row.gradeName;
          const teacherCode = row.TeacherCode || row.teacherCode;
          const academicYear = row.AcademicYear || row.academicYear;
          const capacity = parseInt(row.Capacity || row.capacity || 40);
          const status = (row.Status || row.status || 'Active').toUpperCase();

          if (!className || !gradeName || !academicYear) {
            results.failed.push({ row, reason: 'ClassName, GradeName, and AcademicYear are required' });
            continue;
          }

          const grade = await prisma.grade.findUnique({
            where: { gradeName }
          });

          if (!grade) {
            results.failed.push({ row, reason: `Grade ${gradeName} not found` });
            continue;
          }

          // Find academic year
          const academicYearRecord = await prisma.academicYear.findUnique({
            where: { year: academicYear.toString() }
          });

          if (!academicYearRecord) {
            results.failed.push({ row, reason: `Academic year ${academicYear} not found` });
            continue;
          }

          let teacherId = null;
          if (teacherCode) {
            const teacher = await prisma.teacher.findUnique({
              where: { teacherCode }
            });
            if (teacher) teacherId = teacher.id;
          }

          const classData = await prisma.class.create({
            data: {
              className,
              gradeId: grade.id,
              teacherId,
              academicYearId: academicYearRecord.id,
              capacity,
              status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            }
          });

          results.success.push(classData);
        } catch (err) {
          results.failed.push({ row, reason: err.message });
        }
      }

      res.json({
        message: `Imported ${results.success.length} classes, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Import classes error:', error);
      res.status(500).json({ error: 'Failed to import classes' });
    }
  },

  // Import students
  async importStudents(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const data = await importController.parseFile(req.file);
      const results = { success: [], failed: [] };

      for (const row of data) {
        try {
          const studentCode = row.StudentCode || row.studentCode;
          const studentNumber = row.StudentNumber || row.studentNumber;
          const name = row.Name || row.name;
          const className = row.ClassName || row.className;
          const email = row.Email || row.email || null;
          const status = (row.Status || row.status || 'Active').toUpperCase();

          if (!studentCode || !name || !className) {
            results.failed.push({ row, reason: 'StudentCode, Name, and ClassName are required' });
            continue;
          }

          const classData = await prisma.class.findUnique({
            where: { className }
          });

          if (!classData) {
            results.failed.push({ row, reason: `Class ${className} not found` });
            continue;
          }

          const student = await prisma.student.create({
            data: {
              studentCode,
              studentNumber: studentNumber ? parseInt(studentNumber) : null,
              name,
              classId: classData.id,
              email,
              status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            }
          });

          results.success.push(student);
        } catch (err) {
          results.failed.push({ row, reason: err.message });
        }
      }

      res.json({
        message: `Imported ${results.success.length} students, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Import students error:', error);
      res.status(500).json({ error: 'Failed to import students' });
    }
  },

  // Import teachers
  async importTeachers(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const data = await importController.parseFile(req.file);
      const results = { success: [], failed: [] };

      for (const row of data) {
        try {
          const teacherCode = row.TeacherCode || row.teacherCode;
          const name = row.Name || row.name;
          const email = row.Email || row.email || null;
          const status = (row.Status || row.status || 'Active').toUpperCase();

          if (!teacherCode || !name) {
            results.failed.push({ row, reason: 'TeacherCode and Name are required' });
            continue;
          }

          const teacher = await prisma.teacher.create({
            data: {
              teacherCode,
              name,
              email,
              status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            }
          });

          results.success.push(teacher);
        } catch (err) {
          results.failed.push({ row, reason: err.message });
        }
      }

      res.json({
        message: `Imported ${results.success.length} teachers, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Import teachers error:', error);
      res.status(500).json({ error: 'Failed to import teachers' });
    }
  },

  // Import subjects
  async importSubjects(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const data = await importController.parseFile(req.file);
      const results = { success: [], failed: [] };

      for (const row of data) {
        try {
          const subjectCode = row.SubjectCode || row.subjectCode;
          const subjectName = row.SubjectName || row.subjectName;
          const gradeName = row.GradeName || row.gradeName;
          const academicYear = row.AcademicYear || row.academicYear;
          const teacherCode = row.TeacherCode || row.teacherCode;
          const description = row.Description || row.description || '';
          const status = (row.Status || row.status || 'Active').toUpperCase();

          if (!subjectCode || !subjectName || !teacherCode || !gradeName || !academicYear) {
            results.failed.push({ row, reason: 'SubjectCode, SubjectName, GradeName, AcademicYear, and TeacherCode are required' });
            continue;
          }

          const teacher = await prisma.teacher.findUnique({
            where: { teacherCode }
          });

          if (!teacher) {
            results.failed.push({ row, reason: `Teacher ${teacherCode} not found` });
            continue;
          }

          const grade = await prisma.grade.findUnique({
            where: { gradeName }
          });

          if (!grade) {
            results.failed.push({ row, reason: `Grade ${gradeName} not found` });
            continue;
          }

          const academicYearRecord = await prisma.academicYear.findUnique({
            where: { year: academicYear.toString() }
          });

          if (!academicYearRecord) {
            results.failed.push({ row, reason: `Academic year ${academicYear} not found` });
            continue;
          }

          const subject = await prisma.subject.create({
            data: {
              subjectCode,
              subjectName,
              gradeId: grade.id,
              academicYearId: academicYearRecord.id,
              teacherId: teacher.id,
              description,
              status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            }
          });

          results.success.push(subject);
        } catch (err) {
          results.failed.push({ row, reason: err.message });
        }
      }

      res.json({
        message: `Imported ${results.success.length} subjects, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Import subjects error:', error);
      res.status(500).json({ error: 'Failed to import subjects' });
    }
  },

  // Import tasks
  async importTasks(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const data = await importController.parseFile(req.file);
      const results = { success: [], failed: [] };

      for (const row of data) {
        try {
          const subjectCode = row.SubjectCode || row.subjectCode;
          const taskName = row.TaskName || row.taskName;
          const taskNumber = parseInt(row.TaskNumber || row.taskNumber);
          const description = row.Description || row.description || '';
          const deadline = row.Deadline || row.deadline;
          const scoringType = (row.ScoringType || row.scoringType || 'PASS_FAIL').toUpperCase();
          const maxScore = row.MaxScore || row.maxScore;
          const status = (row.Status || row.status || 'Active').toUpperCase();

          if (!subjectCode || !taskName || !taskNumber) {
            results.failed.push({ row, reason: 'SubjectCode, TaskName, and TaskNumber are required' });
            continue;
          }

          const subject = await prisma.subject.findUnique({
            where: { subjectCode },
            include: { teacher: true }
          });

          if (!subject) {
            results.failed.push({ row, reason: `Subject ${subjectCode} not found` });
            continue;
          }

          // Validate scoring type
          const validScoringTypes = ['SUBMISSION_ONLY', 'PASS_FAIL', 'SCORED'];
          const finalScoringType = validScoringTypes.includes(scoringType) ? scoringType : 'PASS_FAIL';

          const task = await prisma.task.create({
            data: {
              subjectId: subject.id,
              taskName,
              taskNumber,
              description,
              deadline: deadline ? new Date(deadline) : null,
              scoringType: finalScoringType,
              maxScore: maxScore ? parseInt(maxScore) : null,
              createdById: subject.teacherId,
              status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            }
          });

          results.success.push(task);
        } catch (err) {
          results.failed.push({ row, reason: err.message });
        }
      }

      res.json({
        message: `Imported ${results.success.length} tasks, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Import tasks error:', error);
      res.status(500).json({ error: 'Failed to import tasks' });
    }
  },

  // Validate file before import
  async validateFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { type } = req.query;
      const data = await importController.parseFile(req.file);

      const requiredFields = {
        academicYear: ['Year'],
        grade: ['GradeName'],
        class: ['ClassName', 'GradeName', 'AcademicYear'],
        student: ['StudentCode', 'Name', 'ClassName'],
        teacher: ['TeacherCode', 'Name'],
        subject: ['SubjectCode', 'SubjectName', 'GradeName', 'AcademicYear', 'TeacherCode'],
        task: ['SubjectCode', 'TaskName', 'TaskNumber']
      };

      const required = requiredFields[type] || [];
      const errors = [];

      data.forEach((row, index) => {
        required.forEach(field => {
          const value = row[field] || row[field.toLowerCase()];
          if (!value) {
            errors.push({
              row: index + 2, // +2 for header row and 1-based index
              field,
              message: `Missing required field: ${field}`
            });
          }
        });
      });

      res.json({
        valid: errors.length === 0,
        rowCount: data.length,
        errors
      });
    } catch (error) {
      console.error('Validate file error:', error);
      res.status(500).json({ error: 'Failed to validate file' });
    }
  }
};

module.exports = importController;
