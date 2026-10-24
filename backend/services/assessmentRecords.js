// บันทึกหลังแผน: build RecordListItem / RecordDetail (docs/LESSON-LOG.md) and the edit rule.
// Runs inside a request, so the tenant-scoped prisma client keeps everything in the current group.
const prisma = require('../config/database');
const { fullValues, scoreOf, validValues, responseOf } = require('./assessmentCore');

const canManage = (user) => !!user && (user.role === 'ADMIN' || !!user.canManage);
const canEditRecord = (record, user) =>
  canManage(user) || (record.teacherId != null && user && record.teacherId === user.teacherId);

const RECORD_INCLUDE = {
  class: { select: { id: true, className: true } },
  subject: { select: { id: true, subjectName: true } },
  teacher: { select: { id: true, name: true } },
  template: { select: { key: true } },
};

function listItem(r, user) {
  return {
    id: r.id, name: r.name, dateText: r.dateText, assessedOn: r.assessedOn, kind: r.kind, responseType: responseOf(r),
    templateId: r.templateId, templateKey: r.template ? r.template.key : null, templateName: r.templateName,
    status: r.status, classId: r.classId, subjectId: r.subjectId, teacherId: r.teacherId,
    teacherName: r.teacher ? r.teacher.name : null, updatedAt: r.updatedAt, canEdit: canEditRecord(r, user),
  };
}

// Active students of the record's class with their values (full marks when never scored or the
// stored row no longer fits the snapshot), plus total/average/level and the per-level counts.
async function studentsWithScores(r) {
  if (r.kind !== 'RUBRIC') return { students: [], levelCounts: {} };
  const [roster, scores] = await Promise.all([
    prisma.student.findMany({
      where: { classId: r.classId, status: 'ACTIVE' },
      orderBy: [{ studentNumber: 'asc' }, { name: 'asc' }],
      select: { id: true, studentNumber: true, name: true, studentCode: true },
    }),
    prisma.assessmentScore.findMany({ where: { recordId: r.id }, select: { studentId: true, values: true } }),
  ]);
  const stored = new Map(scores.map(s => [s.studentId, s.values]));
  const levelCounts = {};
  const students = roster.map(st => {
    const v = stored.get(st.id);
    const values = validValues(r, v) ? v : fullValues(r);
    const sc = scoreOf(r, values);
    levelCounts[sc.level] = (levelCounts[sc.level] || 0) + 1;
    return { ...st, values, ...sc };
  });
  return { students, levelCounts };
}

// RecordDetail for `id` in the current group, or null.
async function recordDetail(id, user) {
  const r = await prisma.assessmentRecord.findFirst({ where: { id: Number(id) }, include: RECORD_INCLUDE });
  if (!r) return null;
  const { students, levelCounts } = await studentsWithScores(r);
  return {
    ...listItem(r, user),
    header: r.header, note: r.note, classFields: r.classFields || [], classAnswers: r.classAnswers || {}, criteria: r.criteria, maxScore: r.maxScore, useAverage: r.useAverage, levels: r.levels,
    class: r.class, subject: r.subject, students, levelCounts,
  };
}

module.exports = { canManage, canEditRecord, listItem, recordDetail, studentsWithScores, RECORD_INCLUDE };
