const { PrismaClient } = require('@prisma/client');
const QRCode = require('qrcode');

const prisma = new PrismaClient();

async function main() {
  console.log('==========================================');
  console.log('Starting seed...');
  console.log('==========================================\n');

  // Clear existing data (in correct order due to foreign keys)
  console.log('Clearing existing data...');
  await prisma.submission.deleteMany();
  await prisma.qRCode.deleteMany();
  await prisma.task.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.student.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.academicYear.deleteMany();
  console.log('Cleared all existing data\n');

  // ========================================
  // 1. Academic Years (ปีการศึกษา)
  // ========================================
  console.log('Creating academic years...');
  const academicYears = await Promise.all([
    prisma.academicYear.create({
      data: {
        year: '2566',
        name: 'ปีการศึกษา 2566',
        startDate: new Date('2023-05-16'),
        endDate: new Date('2024-03-31'),
        isCurrent: false,
        status: 'INACTIVE'
      }
    }),
    prisma.academicYear.create({
      data: {
        year: '2567',
        name: 'ปีการศึกษา 2567',
        startDate: new Date('2024-05-16'),
        endDate: new Date('2025-03-31'),
        isCurrent: true,
        status: 'ACTIVE'
      }
    }),
    prisma.academicYear.create({
      data: {
        year: '2568',
        name: 'ปีการศึกษา 2568',
        startDate: new Date('2025-05-16'),
        endDate: new Date('2026-03-31'),
        isCurrent: false,
        status: 'ACTIVE'
      }
    })
  ]);
  const currentYear = academicYears[1]; // 2567
  console.log(`Created: ${academicYears.map(a => a.year).join(', ')} (current: ${currentYear.year})\n`);

  // ========================================
  // 2. Grades (ชั้นปี)
  // ========================================
  console.log('Creating grades...');
  const gradeData = [
    { gradeName: 'ม.1', description: 'มัธยมศึกษาปีที่ 1' },
    { gradeName: 'ม.2', description: 'มัธยมศึกษาปีที่ 2' },
    { gradeName: 'ม.3', description: 'มัธยมศึกษาปีที่ 3' },
    { gradeName: 'ม.4', description: 'มัธยมศึกษาปีที่ 4' },
    { gradeName: 'ม.5', description: 'มัธยมศึกษาปีที่ 5' },
    { gradeName: 'ม.6', description: 'มัธยมศึกษาปีที่ 6' }
  ];

  const grades = [];
  for (const g of gradeData) {
    const grade = await prisma.grade.create({ data: g });
    grades.push(grade);
  }
  console.log(`Created: ${grades.map(g => g.gradeName).join(', ')}\n`);

  // ========================================
  // 3. Teachers (ครู)
  // ========================================
  console.log('Creating teachers...');
  const teacherData = [
    { teacherCode: 'T001', name: 'นาย ปรีชา สมใจ', email: 'preecha@school.ac.th' },
    { teacherCode: 'T002', name: 'นาง สมศรี ดีงาม', email: 'somsri@school.ac.th' },
    { teacherCode: 'T003', name: 'นาย มานะ ตั้งใจ', email: 'mana@school.ac.th' },
    { teacherCode: 'T004', name: 'นางสาว วิภา รักเรียน', email: 'wipa@school.ac.th' },
    { teacherCode: 'T005', name: 'นาย สุรชัย เก่งดี', email: 'surachai@school.ac.th' },
    { teacherCode: 'T006', name: 'นาง อรทัย สว่างใจ', email: 'orathai@school.ac.th' }
  ];

  const teachers = [];
  for (const t of teacherData) {
    const teacher = await prisma.teacher.create({ data: t });
    teachers.push(teacher);
  }
  console.log(`Created ${teachers.length} teachers`);
  console.log(`Teachers: ${teachers.map(t => `${t.teacherCode} (${t.name})`).join(', ')}\n`);

  // ========================================
  // 4. Classes (ห้องเรียน)
  // ========================================
  console.log('Creating classes...');
  const classes = [];

  // Create 2 classes per grade level (ม.1 - ม.3 only for simplicity)
  for (let gradeIdx = 0; gradeIdx < 3; gradeIdx++) {
    const grade = grades[gradeIdx];
    for (let room = 1; room <= 2; room++) {
      const className = `${grade.gradeName}/${room}`;
      const teacherIdx = (gradeIdx * 2 + room - 1) % teachers.length;

      const classRecord = await prisma.class.create({
        data: {
          className,
          gradeId: grade.id,
          teacherId: teachers[teacherIdx].id,
          academicYearId: currentYear.id,
          capacity: 40
        }
      });
      classes.push(classRecord);
    }
  }
  console.log(`Created ${classes.length} classes: ${classes.map(c => c.className).join(', ')}\n`);

  // ========================================
  // 5. Students (นักเรียน)
  // ========================================
  console.log('Creating students...');
  const firstNames = [
    'สมชาย', 'สมหญิง', 'มานะ', 'วิไล', 'ประเสริฐ',
    'สุภาพร', 'อนุชา', 'ปิยะ', 'วรรณา', 'ธนกร',
    'กมลา', 'วิชัย', 'สุนทร', 'ปราณี', 'ชัยวัฒน์',
    'อรุณ', 'พิมพ์', 'สมบัติ', 'นงนุช', 'ศักดิ์ชัย'
  ];
  const lastNames = [
    'ใจดี', 'รักเรียน', 'พากเพียร', 'สดใส', 'ก้าวหน้า',
    'มีสุข', 'รุ่งเรือง', 'เจริญ', 'สว่าง', 'พัฒนา',
    'เก่งกาจ', 'ขยัน', 'สุขใจ', 'ดีเลิศ', 'มั่นคง',
    'สมใจ', 'แจ่มใส', 'ดีงาม', 'ตั้งใจ', 'สำเร็จ'
  ];

  const students = [];
  let studentNum = 1;

  for (const classRecord of classes) {
    // Extract grade number from class name (e.g., "ม.1/1" -> "1")
    const gradeNum = classRecord.className.charAt(2);
    const roomNum = classRecord.className.charAt(4);

    // Create 10 students per class
    for (let i = 1; i <= 10; i++) {
      const studentCode = `67${gradeNum}${roomNum}${String(i).padStart(2, '0')}`;
      const prefix = i % 2 === 1 ? 'นาย' : 'นางสาว';
      const firstName = firstNames[(studentNum - 1) % firstNames.length];
      const lastName = lastNames[(studentNum + 4) % lastNames.length];
      const name = `${prefix} ${firstName} ${lastName}`;

      const student = await prisma.student.create({
        data: {
          studentCode,
          studentNumber: i, // เลขที่ในห้อง
          name,
          classId: classRecord.id,
          email: `${studentCode}@student.school.ac.th`
        }
      });
      students.push(student);
      studentNum++;
    }
  }
  console.log(`Created ${students.length} students\n`);

  // ========================================
  // 6. Subjects (วิชา)
  // ========================================
  console.log('Creating subjects...');
  const subjectData = [
    // ม.1 subjects
    { code: 'MA101', name: 'คณิตศาสตร์ ม.1', teacherIdx: 0, gradeIdx: 0 },
    { code: 'EN101', name: 'ภาษาอังกฤษ ม.1', teacherIdx: 1, gradeIdx: 0 },
    { code: 'SC101', name: 'วิทยาศาสตร์ ม.1', teacherIdx: 2, gradeIdx: 0 },
    { code: 'TH101', name: 'ภาษาไทย ม.1', teacherIdx: 3, gradeIdx: 0 },
    // ม.2 subjects
    { code: 'MA201', name: 'คณิตศาสตร์ ม.2', teacherIdx: 0, gradeIdx: 1 },
    { code: 'EN201', name: 'ภาษาอังกฤษ ม.2', teacherIdx: 1, gradeIdx: 1 },
    { code: 'SC201', name: 'วิทยาศาสตร์ ม.2', teacherIdx: 2, gradeIdx: 1 },
    { code: 'TH201', name: 'ภาษาไทย ม.2', teacherIdx: 3, gradeIdx: 1 },
    // ม.3 subjects
    { code: 'MA301', name: 'คณิตศาสตร์ ม.3', teacherIdx: 0, gradeIdx: 2 },
    { code: 'EN301', name: 'ภาษาอังกฤษ ม.3', teacherIdx: 1, gradeIdx: 2 },
    { code: 'SC301', name: 'วิทยาศาสตร์ ม.3', teacherIdx: 2, gradeIdx: 2 },
    { code: 'TH301', name: 'ภาษาไทย ม.3', teacherIdx: 3, gradeIdx: 2 }
  ];

  const subjects = [];
  for (const s of subjectData) {
    const subject = await prisma.subject.create({
      data: {
        subjectCode: s.code,
        subjectName: s.name,
        teacherId: teachers[s.teacherIdx].id,
        gradeId: grades[s.gradeIdx].id,
        academicYearId: currentYear.id,
        description: `${s.name} ปีการศึกษา ${currentYear.year}`
      }
    });
    subjects.push(subject);
  }
  console.log(`Created ${subjects.length} subjects\n`);

  // ========================================
  // 7. Tasks (ใบงาน)
  // ========================================
  console.log('Creating tasks...');
  const scoringTypes = ['SUBMISSION_ONLY', 'PASS_FAIL', 'SCORED'];
  const tasks = [];

  for (const subject of subjects) {
    // Create 5 tasks per subject
    for (let i = 1; i <= 5; i++) {
      const scoringType = scoringTypes[(i - 1) % 3];
      const task = await prisma.task.create({
        data: {
          subjectId: subject.id,
          taskName: `ใบงานที่ ${i}`,
          taskNumber: i,
          description: `${subject.subjectName} - งานชิ้นที่ ${i}`,
          createdById: subject.teacherId,
          scoringType,
          maxScore: scoringType === 'SCORED' ? 10 : null,
          deadline: new Date(Date.now() + (i * 7 * 24 * 60 * 60 * 1000)) // i weeks from now
        }
      });
      tasks.push(task);
    }
  }
  console.log(`Created ${tasks.length} tasks (5 tasks per subject)\n`);

  // ========================================
  // 8. Sample Submissions (การส่งงาน)
  // ========================================
  console.log('Creating sample submissions...');
  let submissionCount = 0;

  // Create submissions for first class (ม.1/1) students with MA101 tasks
  const class11Students = students.filter(s => s.studentCode.startsWith('6711'));
  const ma101 = subjects.find(s => s.subjectCode === 'MA101');
  const ma101Tasks = tasks.filter(t => t.subjectId === ma101.id);

  for (const student of class11Students) {
    for (const task of ma101Tasks) {
      // Random status with weighted distribution
      const rand = Math.random();
      let status;
      if (rand < 0.4) status = 'APPROVED';
      else if (rand < 0.6) status = 'PENDING';
      else if (rand < 0.7) status = 'REJECTED';
      else status = 'NOT_SUBMITTED';

      await prisma.submission.create({
        data: {
          studentId: student.id,
          taskId: task.id,
          status,
          submitDate: status !== 'NOT_SUBMITTED' ? new Date() : null,
          reviewDate: ['APPROVED', 'REJECTED'].includes(status) ? new Date() : null,
          reviewedById: ['APPROVED', 'REJECTED'].includes(status) ? ma101.teacherId : null,
          score: status === 'APPROVED' && task.scoringType === 'SCORED' ? Math.floor(Math.random() * 4) + 7 : null,
          notes: status === 'APPROVED' ? 'ดีมาก' : status === 'REJECTED' ? 'ต้องแก้ไข' : null
        }
      });
      submissionCount++;
    }
  }

  // Create some submissions for other subjects too
  const en101 = subjects.find(s => s.subjectCode === 'EN101');
  const en101Tasks = tasks.filter(t => t.subjectId === en101.id);

  for (const student of class11Students.slice(0, 5)) {
    for (const task of en101Tasks.slice(0, 3)) {
      const rand = Math.random();
      const status = rand < 0.5 ? 'APPROVED' : rand < 0.8 ? 'PENDING' : 'NOT_SUBMITTED';

      await prisma.submission.create({
        data: {
          studentId: student.id,
          taskId: task.id,
          status,
          submitDate: status !== 'NOT_SUBMITTED' ? new Date() : null,
          reviewDate: status === 'APPROVED' ? new Date() : null,
          reviewedById: status === 'APPROVED' ? en101.teacherId : null
        }
      });
      submissionCount++;
    }
  }

  console.log(`Created ${submissionCount} sample submissions\n`);

  // ========================================
  // 9. Sample QR Codes (with actual images)
  // ========================================
  console.log('Creating sample QR codes with images...');
  let qrCount = 0;

  // Create QR codes for ม.1/1 students with MA101
  for (const student of class11Students) {
    const qrData = `SNT-${student.studentCode}-${ma101.subjectCode}-${currentYear.year}`;

    // Generate QR code image as base64
    const qrcodeImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    await prisma.qRCode.create({
      data: {
        studentId: student.id,
        subjectId: ma101.id,
        qrcodeData: qrData,
        qrcodeImage: qrcodeImage
      }
    });
    qrCount++;
  }
  console.log(`Created ${qrCount} sample QR codes with images\n`);

  // ========================================
  // Summary
  // ========================================
  console.log('==========================================');
  console.log('SEED COMPLETED SUCCESSFULLY!');
  console.log('==========================================\n');

  console.log('DATA SUMMARY:');
  console.log('─────────────────────────────────────────');
  console.log(`Academic Years: ${academicYears.length} (2566, 2567*, 2568)`);
  console.log(`Grades:         ${grades.length} (ม.1 - ม.6)`);
  console.log(`Teachers:       ${teachers.length}`);
  console.log(`Classes:        ${classes.length} (ม.1-ม.3, 2 rooms each)`);
  console.log(`Students:       ${students.length} (10 per class)`);
  console.log(`Subjects:       ${subjects.length} (4 subjects per grade)`);
  console.log(`Tasks:          ${tasks.length} (5 per subject)`);
  console.log(`Submissions:    ${submissionCount}`);
  console.log(`QR Codes:       ${qrCount}`);
  console.log('─────────────────────────────────────────\n');

  console.log('LOGIN CREDENTIALS:');
  console.log('─────────────────────────────────────────');
  console.log('Admin:');
  console.log('  username: admin');
  console.log('  password: root123');
  console.log('');
  console.log('Teachers (ใช้รหัสครูเป็นทั้ง username และ password ครั้งแรก):');
  for (const t of teachers) {
    console.log(`  ${t.teacherCode} - ${t.name}`);
  }
  console.log('');
  console.log('Students (ใช้รหัสนักเรียนเป็นทั้ง username และ password):');
  console.log('  Format: 67XXYY (67=ปี, XX=ชั้น+ห้อง, YY=เลขที่)');
  console.log('  Examples:');
  console.log('    671101 - ม.1/1 เลขที่ 1');
  console.log('    671201 - ม.1/2 เลขที่ 1');
  console.log('    672101 - ม.2/1 เลขที่ 1');
  console.log('─────────────────────────────────────────\n');

  console.log('TEACHER-SUBJECT ASSIGNMENTS:');
  console.log('─────────────────────────────────────────');
  console.log(`T001 (${teachers[0].name}): คณิตศาสตร์ ม.1-3`);
  console.log(`T002 (${teachers[1].name}): ภาษาอังกฤษ ม.1-3`);
  console.log(`T003 (${teachers[2].name}): วิทยาศาสตร์ ม.1-3`);
  console.log(`T004 (${teachers[3].name}): ภาษาไทย ม.1-3`);
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
