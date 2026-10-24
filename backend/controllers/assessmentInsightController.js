// บันทึกหลังแผน: fill a criterion from KruScan submissions, and the per-student term summary.
// Contract: docs/LESSON-LOG.md
const prisma = require('../config/database');
const { fullValues, scoreOf, validValues, responseOf, points } = require('../services/assessmentCore');
const { canEditRecord, recordDetail } = require('../services/assessmentRecords');

const MAX_SUMMARY_RECORDS = 200;
const intOrNull = (v) => (v !== undefined && v !== null && v !== '' && Number.isInteger(Number(v)) ? Number(v) : null);

// Answer for one submission against a task. SCORE: on time -> max, late -> max-1 (min 1), otherwise 1.
// PASSFAIL: on time or late -> 2 (ผ่าน), otherwise 1. CHECK: on time or late -> 1 (✓), otherwise 0.
function scoreFromSubmission(sub, task, record) {
  const type = responseOf(record);
  const handed = !!sub && (sub.status === 'APPROVED' || sub.status === 'PENDING');
  if (type === 'PASSFAIL') return handed ? 2 : 1;
  if (type === 'CHECK') return handed ? 1 : 0;
  if (!handed) return 1;
  const late = task.deadline && sub.submitDate && new Date(sub.submitDate) > new Date(task.deadline);
  return late ? Math.max(1, record.maxScore - 1) : record.maxScore;
}

async function fillFromTask(req, res, next) {
  try {
    const id = intOrNull(req.params.id);
    const record = id === null ? null : await prisma.assessmentRecord.findFirst({ where: { id } });
    if (!record) return res.status(404).json({ error: 'ไม่พบบันทึกนี้' });
    if (!canEditRecord(record, req.user)) return res.status(403).json({ error: 'แก้ไขได้เฉพาะเจ้าของบันทึกหรือผู้จัดการกลุ่ม' });
    if (record.kind !== 'RUBRIC') return res.status(400).json({ error: 'บันทึกชนิดนี้ไม่มีคะแนนรายคน' });
    if (responseOf(record) === 'TEXT') return res.status(400).json({ error: 'แบบเขียนข้อความดึงจากการส่งงานไม่ได้' });

    const taskId = intOrNull(req.body && req.body.taskId);
    const idx = req.body ? req.body.criterionIndex : undefined;
    const criteria = Array.isArray(record.criteria) ? record.criteria : [];
    if (taskId === null) return res.status(400).json({ error: 'เลือกงานก่อน' });
    if (!Number.isInteger(idx) || idx < 0 || idx >= criteria.length) return res.status(400).json({ error: 'เลือกรายการประเมินที่จะเติมให้ถูกต้อง' });
    const task = await prisma.task.findFirst({ where: { id: taskId }, select: { id: true, deadline: true } });
    if (!task) return res.status(404).json({ error: 'ไม่พบงาน' });

    const detail = await recordDetail(record.id, req.user);
    const subs = await prisma.submission.findMany({
      where: { taskId: task.id, studentId: { in: detail.students.map(s => s.id) } },
      select: { studentId: true, status: true, submitDate: true },
    });
    const byStudent = new Map(subs.map(s => [s.studentId, s]));

    let filled = 0;
    for (const st of detail.students) {
      const values = st.values.slice();
      values[idx] = scoreFromSubmission(byStudent.get(st.id), task, record);
      const row = await prisma.assessmentScore.findFirst({ where: { recordId: record.id, studentId: st.id }, select: { id: true } });
      if (row) await prisma.assessmentScore.update({ where: { id: row.id }, data: { values } });
      else await prisma.assessmentScore.create({ data: { recordId: record.id, studentId: st.id, values } });
      filled++;
    }
    res.json({ ...(await recordDetail(record.id, req.user)), filled });
  } catch (e) { next(e); }
}

async function summary(req, res, next) {
  try {
    const classId = intOrNull(req.query.classId);
    if (classId === null) return res.status(400).json({ error: 'เลือกห้องเรียนก่อน' });
    const where = { classId, kind: 'RUBRIC', responseType: { not: 'TEXT' } }; // text answers have no score to summarise
    if (req.query.subjectId !== undefined && req.query.subjectId !== '') {
      const subjectId = intOrNull(req.query.subjectId);
      if (subjectId === null) return res.status(400).json({ error: 'วิชาไม่ถูกต้อง' });
      where.subjectId = subjectId;
    }
    const [records, roster] = await Promise.all([
      prisma.assessmentRecord.findMany({
        where, orderBy: [{ assessedOn: 'asc' }, { id: 'asc' }], take: MAX_SUMMARY_RECORDS,
        select: { id: true, name: true, templateName: true, dateText: true, criteria: true, maxScore: true, levels: true, responseType: true },
      }),
      prisma.student.findMany({
        where: { classId, status: 'ACTIVE' }, orderBy: [{ studentNumber: 'asc' }, { name: 'asc' }],
        select: { id: true, studentNumber: true, name: true },
      }),
    ]);
    const scores = records.length
      ? await prisma.assessmentScore.findMany({
        where: { recordId: { in: records.map(r => r.id) }, studentId: { in: roster.map(s => s.id) } },
        select: { recordId: true, studentId: true, values: true },
      })
      : [];
    const stored = new Map(scores.map(s => [`${s.recordId}:${s.studentId}`, s.values]));
    const students = roster.map(st => {
      const results = {};
      for (const r of records) {
        const v = stored.get(`${r.id}:${st.id}`);
        results[r.id] = scoreOf(r, validValues(r, v) ? v : fullValues(r));
      }
      return { ...st, results };
    });
    res.json({
      records: records.map(r => ({
        id: r.id, name: r.name, templateName: r.templateName, dateText: r.dateText,
        maxScore: r.maxScore, criteriaCount: (r.criteria || []).length, maxPoints: points(r, []).max,
        responseType: responseOf(r), levels: r.levels,
      })),
      students,
    });
  } catch (e) { next(e); }
}

module.exports = { fillFromTask, summary };
