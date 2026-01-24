const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create Admin User
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@school.ac.th' },
    update: {},
    create: {
      email: 'admin@school.ac.th',
      password: adminPassword,
      role: 'ADMIN'
    }
  });
  console.log('Created admin user:', admin.email);

  // Create Grades
  const grades = await Promise.all([
    prisma.grade.upsert({
      where: { gradeName: 'ม.1' },
      update: {},
      create: { gradeName: 'ม.1', description: 'มัธยมศึกษาปีที่ 1' }
    }),
    prisma.grade.upsert({
      where: { gradeName: 'ม.2' },
      update: {},
      create: { gradeName: 'ม.2', description: 'มัธยมศึกษาปีที่ 2' }
    }),
    prisma.grade.upsert({
      where: { gradeName: 'ม.3' },
      update: {},
      create: { gradeName: 'ม.3', description: 'มัธยมศึกษาปีที่ 3' }
    })
  ]);
  console.log('Created grades:', grades.map(g => g.gradeName).join(', '));

  // Create Teachers
  const teachers = await Promise.all([
    prisma.teacher.upsert({
      where: { teacherCode: 'T001' },
      update: {},
      create: {
        teacherCode: 'T001',
        name: 'นาย ปรีชา สมใจ',
        email: 'preecha@school.ac.th'
      }
    }),
    prisma.teacher.upsert({
      where: { teacherCode: 'T002' },
      update: {},
      create: {
        teacherCode: 'T002',
        name: 'นาง สมศรี ดีงาม',
        email: 'somsri@school.ac.th'
      }
    }),
    prisma.teacher.upsert({
      where: { teacherCode: 'T003' },
      update: {},
      create: {
        teacherCode: 'T003',
        name: 'นาย มานะ ตั้งใจ',
        email: 'mana@school.ac.th'
      }
    })
  ]);
  console.log('Created teachers:', teachers.map(t => t.name).join(', '));

  // Create Teacher Users
  const teacherPassword = await bcrypt.hash('teacher123', 10);
  for (const teacher of teachers) {
    await prisma.user.upsert({
      where: { email: teacher.email },
      update: {},
      create: {
        email: teacher.email,
        password: teacherPassword,
        role: 'TEACHER',
        teacherId: teacher.id
      }
    });
  }
  console.log('Created teacher users');

  // Create Classes
  const grade1 = grades.find(g => g.gradeName === 'ม.1');
  const classes = await Promise.all([
    prisma.class.upsert({
      where: { className: 'ม.1/1' },
      update: {},
      create: {
        className: 'ม.1/1',
        gradeId: grade1.id,
        teacherId: teachers[0].id,
        academicYear: '2567',
        capacity: 40
      }
    }),
    prisma.class.upsert({
      where: { className: 'ม.1/2' },
      update: {},
      create: {
        className: 'ม.1/2',
        gradeId: grade1.id,
        teacherId: teachers[1].id,
        academicYear: '2567',
        capacity: 40
      }
    })
  ]);
  console.log('Created classes:', classes.map(c => c.className).join(', '));

  // Create Students
  const studentPassword = await bcrypt.hash('student123', 10);
  const studentData = [
    { code: '67101', name: 'นาย สมชาย ใจดี', classId: classes[0].id },
    { code: '67102', name: 'นางสาว สมหญิง รักเรียน', classId: classes[0].id },
    { code: '67103', name: 'นาย มานะ พากเพียร', classId: classes[0].id },
    { code: '67104', name: 'นางสาว วิไล สดใส', classId: classes[1].id },
    { code: '67105', name: 'นาย ประเสริฐ ก้าวหน้า', classId: classes[1].id }
  ];

  for (const data of studentData) {
    const student = await prisma.student.upsert({
      where: { studentCode: data.code },
      update: {},
      create: {
        studentCode: data.code,
        name: data.name,
        classId: data.classId,
        email: `${data.code}@student.school.ac.th`
      }
    });

    await prisma.user.upsert({
      where: { email: student.email },
      update: {},
      create: {
        email: student.email,
        password: studentPassword,
        role: 'STUDENT',
        studentId: student.id
      }
    });
  }
  console.log('Created students and student users');

  // Create Subjects
  const subjects = await Promise.all([
    prisma.subject.upsert({
      where: { subjectCode: 'MA101' },
      update: {},
      create: {
        subjectCode: 'MA101',
        subjectName: 'คณิตศาสตร์ ม.1',
        teacherId: teachers[0].id,
        description: 'วิชาคณิตศาสตร์พื้นฐาน'
      }
    }),
    prisma.subject.upsert({
      where: { subjectCode: 'EN101' },
      update: {},
      create: {
        subjectCode: 'EN101',
        subjectName: 'ภาษาอังกฤษ ม.1',
        teacherId: teachers[1].id,
        description: 'วิชาภาษาอังกฤษพื้นฐาน'
      }
    }),
    prisma.subject.upsert({
      where: { subjectCode: 'SC101' },
      update: {},
      create: {
        subjectCode: 'SC101',
        subjectName: 'วิทยาศาสตร์ ม.1',
        teacherId: teachers[2].id,
        description: 'วิชาวิทยาศาสตร์พื้นฐาน'
      }
    })
  ]);
  console.log('Created subjects:', subjects.map(s => s.subjectName).join(', '));

  // Create Tasks
  const tasks = [];
  for (const subject of subjects) {
    for (let i = 1; i <= 4; i++) {
      const task = await prisma.task.upsert({
        where: {
          subjectId_taskNumber: {
            subjectId: subject.id,
            taskNumber: i
          }
        },
        update: {},
        create: {
          subjectId: subject.id,
          taskName: `ใบงานที่ ${i}`,
          taskNumber: i,
          description: `งานชิ้นที่ ${i} ของวิชา ${subject.subjectName}`,
          createdById: subject.teacherId
        }
      });
      tasks.push(task);
    }
  }
  console.log(`Created ${tasks.length} tasks`);

  console.log('\n========================================');
  console.log('Seed completed successfully!');
  console.log('========================================');
  console.log('\nLogin credentials:');
  console.log('------------------');
  console.log('Admin:');
  console.log('  Email: admin@school.ac.th');
  console.log('  Password: admin123');
  console.log('\nTeachers:');
  console.log('  Email: preecha@school.ac.th (or somsri@, mana@)');
  console.log('  Password: teacher123');
  console.log('\nStudents:');
  console.log('  Email: 67101@student.school.ac.th (67101-67105)');
  console.log('  Password: student123');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
