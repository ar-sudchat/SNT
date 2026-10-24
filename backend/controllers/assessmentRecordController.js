// บันทึกหลังแผน: records and per-student scores. Contract: docs/LESSON-LOG.md
const prisma = require('../config/database');
const { validValues, clip, responseOf, cleanClassAnswers } = require('../services/assessmentCore');
const { canEditRecord, listItem, recordDetail, RECORD_INCLUDE } = require('../services/assessmentRecords');
const { cleanDates, formatThaiDates, dateFields } = require('../services/thaiDates');

// วันที่ของบันทึก: dates (วันจริง) เป็นหลัก · ไม่ส่ง dates = แปลงจากข้อความ · ข้อความว่าง = สร้างจากวันจริง
function datePart(body) {
  let dates;
  if (body.dates !== undefined) {
    dates = cleanDates(body.dates);
    if (!dates) return { error: 'วันที่ไม่ถูกต้อง' };
  }
  let dateText = clip(body.dateText, 100);
  if (!dateText && dates && dates.length) dateText = formatThaiDates(dates);
  return { data: { dateText, ...dateFields(dates, dateText) } };
}
const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? new Date(`${v}T00:00:00Z`) : null);

const MAX_SCORE_ITEMS = 500;
const MAX_LIST_ITEMS = 20;

function fail(res, e, what) {
  if (e && e.code === 'P2003') return res.status(400).json({ error: 'ข้อมูลอ้างอิงไม่อยู่ในกลุ่มนี้' });
  console.error(`${what} error:`, e);
  return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการจัดการบันทึกหลังแผน' });
}

// Positive integer from a path/query/body value, or null.
function toId(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const cleanHeader = (h) => {
  const o = h && typeof h === 'object' && !Array.isArray(h) ? h : {};
  return { planNo: clip(o.planNo, 50), unitNo: clip(o.unitNo, 50), unitName: clip(o.unitName, 200) };
};

const cleanList = (v) => (Array.isArray(v) ? v : []).slice(0, MAX_LIST_ITEMS).map(x => clip(x, 500)).filter(Boolean);

// Merge a partial note onto the stored one; returns the normalized note or { error }.
function cleanNote(input, current) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'ข้อมูลบันทึกไม่ถูกต้อง' };
  const cur = current && typeof current === 'object' ? current : {};
  const out = {
    pct: Number.isInteger(cur.pct) ? cur.pct : 80,
    outcome: String(cur.outcome || ''),
    problems: Array.isArray(cur.problems) ? cur.problems : [],
    fixes: Array.isArray(cur.fixes) ? cur.fixes : [],
    extra: String(cur.extra || ''),
  };
  if (input.pct !== undefined) {
    const p = Number(input.pct);
    if (!Number.isInteger(p) || p < 0 || p > 100) return { error: 'เปอร์เซ็นต์ต้องเป็นจำนวนเต็ม 0–100' };
    out.pct = p;
  }
  if (input.outcome !== undefined) out.outcome = clip(input.outcome, 500);
  if (input.problems !== undefined) out.problems = cleanList(input.problems);
  if (input.fixes !== undefined) out.fixes = cleanList(input.fixes);
  if (input.extra !== undefined) out.extra = clip(input.extra, 1000);
  return { value: out };
}

// The record `id` in this group, or sends 404/403 and returns null.
async function loadEditable(req, res) {
  const id = toId(req.params.id);
  const r = id && await prisma.assessmentRecord.findFirst({ where: { id } });
  if (!r) { res.status(404).json({ error: 'ไม่พบบันทึกนี้' }); return null; }
  if (!canEditRecord(r, req.user)) { res.status(403).json({ error: 'แก้ไขได้เฉพาะเจ้าของบันทึกหรือผู้จัดการกลุ่ม' }); return null; }
  return r;
}

const list = async (req, res) => {
  try {
    const classId = toId(req.query.classId);
    if (!classId) return res.status(400).json({ error: 'เลือกห้องก่อน' });
    const where = { classId };
    const subjectId = toId(req.query.subjectId);
    if (subjectId) where.subjectId = subjectId;
    const templateId = toId(req.query.templateId);
    if (templateId) where.templateId = templateId;
    if (req.query.status === 'DRAFT' || req.query.status === 'DONE') where.status = req.query.status;
    // ช่วงวันที่ ?from=YYYY-MM-DD&to=YYYY-MM-DD : บันทึกที่มีวันสอนคาบเกี่ยวช่วงนี้
    const from = isoDate(req.query.from), to = isoDate(req.query.to);
    if (from) where.dateTo = { gte: from };
    if (to) where.dateFrom = { lte: to };
    const rows = await prisma.assessmentRecord.findMany({
      where, include: RECORD_INCLUDE, orderBy: [{ assessedOn: 'desc' }, { id: 'desc' }],
    });
    res.json(rows.map(r => listItem(r, req.user)));
  } catch (e) { fail(res, e, 'List records'); }
};

const create = async (req, res) => {
  try {
    const body = req.body || {};
    const name = clip(body.name, 200);
    if (!name) return res.status(400).json({ error: 'ตั้งชื่อบันทึกก่อน' });

    const templateId = toId(body.templateId);
    const template = templateId && await prisma.assessmentTemplate.findFirst({ where: { id: templateId, status: 'ACTIVE' } });
    if (!template) return res.status(404).json({ error: 'ไม่พบแบบประเมินนี้' });

    const classId = toId(body.classId);
    const cls = classId && await prisma.class.findFirst({ where: { id: classId }, select: { id: true } });
    if (!cls) return res.status(404).json({ error: 'ไม่พบห้องเรียนนี้' });

    let subjectId = null;
    if (body.subjectId !== undefined && body.subjectId !== null && body.subjectId !== '') {
      subjectId = toId(body.subjectId);
      const subj = subjectId && await prisma.subject.findFirst({ where: { id: subjectId }, select: { id: true } });
      if (!subj) return res.status(404).json({ error: 'ไม่พบวิชานี้' });
    }

    const dp = datePart(body);
    if (dp.error) return res.status(400).json({ error: dp.error });

    const isNote = template.kind === 'NOTE';
    const record = await prisma.assessmentRecord.create({
      data: {
        templateId: template.id, classId: cls.id, subjectId,
        teacherId: req.user.teacherId || null,
        name, ...dp.data,
        kind: template.kind, templateName: template.name,
        criteria: template.criteria, maxScore: template.maxScore, useAverage: template.useAverage, levels: template.levels,
        responseType: template.responseType, classFields: template.classFields,
        ...(isNote ? {
          header: cleanHeader(body.header),
          note: { pct: 80, outcome: '', problems: [], fixes: [], extra: '' },
        } : {}),
      },
      select: { id: true },
    });
    res.status(201).json(await recordDetail(record.id, req.user));
  } catch (e) { fail(res, e, 'Create record'); }
};

const get = async (req, res) => {
  try {
    const detail = await recordDetail(toId(req.params.id) || 0, req.user);
    if (!detail) return res.status(404).json({ error: 'ไม่พบบันทึกนี้' });
    res.json(detail);
  } catch (e) { fail(res, e, 'Get record'); }
};

const update = async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    const body = req.body || {};
    const data = {};
    if (body.name !== undefined) {
      data.name = clip(body.name, 200);
      if (!data.name) return res.status(400).json({ error: 'ตั้งชื่อบันทึกก่อน' });
    }
    if (body.dateText !== undefined || body.dates !== undefined) {
      const dp = datePart({ dateText: body.dateText !== undefined ? body.dateText : r.dateText, dates: body.dates });
      if (dp.error) return res.status(400).json({ error: dp.error });
      Object.assign(data, dp.data);
    }
    if (body.status !== undefined) {
      if (body.status !== 'DRAFT' && body.status !== 'DONE') return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
      data.status = body.status;
    }
    if (r.kind === 'NOTE') {
      if (body.header !== undefined) data.header = cleanHeader({ ...(r.header || {}), ...(body.header && typeof body.header === 'object' ? body.header : {}) });
      if (body.note !== undefined) {
        const n = cleanNote(body.note, r.note);
        if (n.error) return res.status(400).json({ error: n.error });
        data.note = n.value;
      }
    }
    // Class-level answers replace the whole stored object (unknown keys dropped, values cleaned by field type).
    if (body.classAnswers !== undefined && (r.kind === 'CLASS' || (r.kind === 'RUBRIC' && (r.classFields || []).length))) {
      data.classAnswers = cleanClassAnswers(r, body.classAnswers);
    }
    if (Object.keys(data).length) await prisma.assessmentRecord.update({ where: { id: r.id }, data });
    res.json(await recordDetail(r.id, req.user));
  } catch (e) { fail(res, e, 'Update record'); }
};

const saveScores = async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    if (r.kind !== 'RUBRIC') return res.status(400).json({ error: 'บันทึกชนิดนี้ไม่มีคะแนนรายคน' });
    const scores = req.body && req.body.scores;
    if (!Array.isArray(scores)) return res.status(400).json({ error: 'ข้อมูลคะแนนไม่ถูกต้อง' });
    if (scores.length > MAX_SCORE_ITEMS) return res.status(400).json({ error: `ส่งคะแนนได้ครั้งละไม่เกิน ${MAX_SCORE_ITEMS} คน` });

    // Last entry per student wins; all values are checked before anything is written.
    const isText = responseOf(r) === 'TEXT';
    const byStudent = new Map();
    for (const s of scores) {
      const studentId = toId(s && s.studentId);
      if (!studentId) return res.status(400).json({ error: 'ข้อมูลนักเรียนไม่ถูกต้อง' });
      const values = isText && Array.isArray(s.values) ? s.values.map(v => (typeof v === 'string' ? v.trim() : v)) : s.values;
      if (!validValues(r, values)) return res.status(400).json({ error: isText ? 'คำตอบไม่ถูกต้อง' : 'คะแนนไม่ถูกต้อง' });
      byStudent.set(studentId, values);
    }
    if (byStudent.size) {
      const ids = [...byStudent.keys()];
      const ok = await prisma.student.count({ where: { id: { in: ids }, classId: r.classId, status: 'ACTIVE' } });
      if (ok !== ids.length) return res.status(400).json({ error: 'มีนักเรียนที่ไม่อยู่ในห้องนี้' });
      const existing = await prisma.assessmentScore.findMany({ where: { recordId: r.id, studentId: { in: ids } }, select: { id: true, studentId: true } });
      const rowOf = new Map(existing.map(e => [e.studentId, e.id]));
      for (const [studentId, values] of byStudent) {
        if (rowOf.has(studentId)) await prisma.assessmentScore.update({ where: { id: rowOf.get(studentId) }, data: { values } });
        else await prisma.assessmentScore.create({ data: { recordId: r.id, studentId, values } });
      }
    }
    res.json(await recordDetail(r.id, req.user));
  } catch (e) { fail(res, e, 'Save scores'); }
};

const remove = async (req, res) => {
  try {
    const r = await loadEditable(req, res);
    if (!r) return;
    await prisma.assessmentRecord.delete({ where: { id: r.id } });
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'Delete record'); }
};

module.exports = { list, create, get, update, saveScores, remove };
