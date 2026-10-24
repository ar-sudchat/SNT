const roster = require('../services/rosterImport');
const prisma = require('../config/database');
const ai = require('../services/aiProvider');
const { enforceAiQuota, enforceStudentQuota } = require('../middleware/planLimit');
const audit = require('../services/audit');
const fail = (res, message) => res.status(400).json({ error: message });
exports.preview = async (req, res) => {
  try {
    if (!req.file) return fail(res, 'กรุณาเลือกไฟล์ที่ต้องการนำเข้า');
    if (!/\.(csv|xlsx|xls)$/i.test(req.file.originalname)) return fail(res, 'รองรับไฟล์ Excel หรือ CSV');
    const { rows, sheetName } = roster.readTable(req.file);
    if (!rows.length) return fail(res, 'ไฟล์ไม่มีข้อมูล');
    let index = roster.findHeaderRow(rows);
    if (req.body.headerRow !== undefined) {
      const value = Number(req.body.headerRow);
      index = rows.findIndex((r, i) => (r.fileRow !== undefined ? r.fileRow - 1 : i) === value);
      if (!Number.isInteger(value) || index < 0) return fail(res, 'แถวหัวคอลัมน์ไม่ถูกต้อง');
    }
    const headers = rows[index], data = rows.slice(index + 1);
    if (data.length > 3000) return fail(res, 'นำเข้าได้ครั้งละไม่เกิน 3,000 คน');
    const defaultClass = roster.normalizeClassName(req.body.defaultClass !== undefined ? req.body.defaultClass : roster.classFromContext(rows.slice(0, index), sheetName));
    let { mapping } = roster.guessMapping(headers, data), mappingSource = 'rules';
    const notes = [];
    if (req.body.mapping !== undefined) {
      try { mapping = roster.validateMapping(JSON.parse(req.body.mapping), headers.length); } catch (_) { mapping = null; }
      if (!mapping) return fail(res, 'การเลือกคอลัมน์ไม่ถูกต้อง');
      mappingSource = 'user';
    } else if (roster.confidenceOf(mapping, defaultClass) === 'low' && ai.getConfig().apiKey) {
      try {
        const quietResponse = { status() { return this; }, json() { return this; } };
        if (await enforceAiQuota(req, quietResponse)) {
          const suggested = await roster.aiMapping(headers, roster.columnProfiles(headers, data));
          if (suggested) { mapping = suggested; mappingSource = 'ai'; }
          else notes.push('AI จับคอลัมน์ไม่ได้ ใช้การจับคอลัมน์ของระบบแทน');
        } else notes.push('โควตา AI เต็มแล้ว ใช้การจับคอลัมน์ของระบบแทน');
      } catch (_) { notes.push('AI ไม่พร้อม ใช้การจับคอลัมน์ของระบบแทน'); }
    }
    const { students, issues } = roster.buildStudents(data, mapping, { defaultClass });
    const plan = await roster.planImport(students);
    res.json({ fileName: req.file.originalname, sheetName, headerRow: headers.fileRow - 1, headers, mapping, mappingSource, confidence: roster.confidenceOf(mapping, defaultClass), defaultClass, students, issues, notes, plan, total: students.length });
  } catch (err) {
    console.error('smart import preview error:', err && err.message);
    fail(res, 'อ่านไฟล์ไม่สำเร็จ ตรวจสอบไฟล์แล้วลองใหม่');
  }
};
exports.commit = async (req, res) => {
  try {
    const input = req.body?.students;
    if (!Array.isArray(input) || !input.length || input.length > 3000) return fail(res, 'ต้องมีรายชื่อนักเรียน 1–3,000 คน');
    const students = [], seen = new Set();
    for (const s of input) {
      if (!s || ['name','studentCode','className'].some(f => typeof s[f] !== 'string' || !s[f].trim() || s[f].length > 100)) return fail(res, 'ชื่อ รหัส และห้องต้องไม่ว่าง และยาวไม่เกิน 100 ตัวอักษร');
      if (s.studentNumber != null && (!Number.isInteger(s.studentNumber) || s.studentNumber < 1 || s.studentNumber > 2147483647)) return fail(res, 'เลขที่ต้องเป็นจำนวนเต็มบวก');
      const student = { name: s.name.trim(), studentCode: s.studentCode.trim(), className: roster.normalizeClassName(s.className), studentNumber: s.studentNumber ?? null };
      if (seen.has(student.studentCode)) return fail(res, 'รหัสซ้ำในไฟล์');
      seen.add(student.studentCode); students.push(student);
    }
    const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
    if (!year) return fail(res, 'ยังไม่มีปีการศึกษาปัจจุบัน ตั้งค่าที่ ตั้งค่าระบบ → ปีการศึกษา ก่อน');
    const plan = await roster.planImport(students);
    if (!await enforceStudentQuota(req, res, plan.create)) return;
    if (plan.newClasses.some(n => !roster.gradeOf(n))) return fail(res, 'ระบุชั้นและห้องให้ชัดเจน เช่น ป.4/1 หรือ ม.1/2');
    let classesCreated = 0, gradesCreated = 0;
    // The scoped client's FK checks use the base connection and cannot see new
    // grades/classes in an interactive transaction. Keep scoped sequential writes.
    const classes = new Map();
    for (const className of new Set(students.map(s => s.className))) {
      let c = await prisma.class.findUnique({ where: { className } });
      if (!c) {
        const gradeName = roster.gradeOf(className);
        let grade = await prisma.grade.findUnique({ where: { gradeName } });
        if (!grade) { grade = await prisma.grade.upsert({ where: { gradeName }, create: { gradeName }, update: {} }); gradesCreated++; }
        c = await prisma.class.upsert({ where: { className }, create: { className, gradeId: grade.id, academicYearId: year.id }, update: {} }); classesCreated++;
      }
      classes.set(className, c.id);
    }
    for (const s of students) {
      const data = { name: s.name, studentNumber: s.studentNumber, classId: classes.get(s.className), status: 'ACTIVE' };
      await prisma.student.upsert({ where: { studentCode: s.studentCode }, create: { studentCode: s.studentCode, ...data }, update: data });
    }
    await audit.log('import.smart', null, { created: plan.create, updated: plan.update, classes: [...classes.keys()] }, req);
    res.json({ created: plan.create, updated: plan.update, classesCreated, gradesCreated });
  } catch (err) {
    console.error('smart import commit error:', err && err.message);
    res.status(500).json({ error: 'นำเข้าไม่สำเร็จ อาจมีบางรายการบันทึกแล้ว ตรวจสอบและลองใหม่ได้ด้วยรหัสเดิม' }); }
};
