// บันทึกหลังแผน: assessment templates (docs/LESSON-LOG.md). Tenant scoping comes from the prisma extension.
const prisma = require('../config/database');
const { BUILTINS, cleanTemplateInput, ensureBuiltins } = require('../services/assessmentCore');
const { canManage } = require('../services/assessmentRecords');

const canEditTemplate = (t, user) =>
  // Built-ins are the group's shared forms: every teacher may adjust them. Custom forms: creator or manager.
  canManage(user) || t.isBuiltIn || (t.createdById != null && !!user && t.createdById === user.teacherId);

const toTemplate = (t, user) => ({
  id: t.id, key: t.key, name: t.name, kind: t.kind, responseType: t.responseType, classFields: t.classFields, maxScore: t.maxScore, useAverage: t.useAverage,
  criteria: t.criteria, levels: t.levels, isBuiltIn: t.isBuiltIn, createdById: t.createdById,
  canEdit: canEditTemplate(t, user),
});

const fail = (res, err) => {
  console.error('assessment template error:', err.message);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดของระบบ' });
};

async function list(req, res) {
  try {
    await ensureBuiltins(prisma);
    const rows = await prisma.assessmentTemplate.findMany({ where: { status: 'ACTIVE' } });
    const order = new Map(BUILTINS.map((b, i) => [b.key, i]));
    const builtIns = rows.filter(t => t.isBuiltIn).sort((a, b) => (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99));
    const custom = rows.filter(t => !t.isBuiltIn).sort((a, b) => a.name.localeCompare(b.name, 'th') || a.id - b.id);
    res.json([...builtIns, ...custom].map(t => toTemplate(t, req.user)));
  } catch (err) { fail(res, err); }
}

async function create(req, res) {
  try {
    const { value, error } = cleanTemplateInput(req.body || {});
    if (error) return res.status(400).json({ error });
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      try {
        const row = await prisma.assessmentTemplate.create({
          data: { ...value, key: `c-${base + i}`, isBuiltIn: false, createdById: req.user.teacherId || null },
        });
        return res.status(201).json(toTemplate(row, req.user));
      } catch (e) {
        if (e.code !== 'P2002') throw e; // key taken in this group: try the next one
      }
    }
    throw new Error('could not allocate a template key');
  } catch (err) { fail(res, err); }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    const t = Number.isInteger(id) ? await prisma.assessmentTemplate.findFirst({ where: { id, status: 'ACTIVE' } }) : null;
    if (!t) return res.status(404).json({ error: 'ไม่พบแบบประเมิน' });
    if (!canEditTemplate(t, req.user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไขแบบประเมินนี้' });

    const body = { ...(req.body || {}) };
    if (t.isBuiltIn) { delete body.responseType; delete body.classFields; } // built-ins stay SCORE with no class questions
    const newKind = !t.isBuiltIn && body.kind !== undefined ? (['NOTE', 'CLASS'].includes(body.kind) ? body.kind : 'RUBRIC') : t.kind;
    const newResponse = body.responseType !== undefined ? body.responseType : t.responseType;
    let cleaned;
    if (newKind !== t.kind || newResponse !== t.responseType) {
      // Switching type or answer format changes what is required, so validate the whole template.
      cleaned = cleanTemplateInput({
        name: t.name, maxScore: t.maxScore, useAverage: t.useAverage, criteria: t.criteria, levels: t.levels,
        responseType: t.responseType, classFields: t.classFields,
        ...body, kind: newKind,
      });
    } else {
      cleaned = cleanTemplateInput({ ...body, kind: t.kind, responseType: t.responseType }, { partial: true });
    }
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });
    const data = cleaned.value;
    if (t.isBuiltIn) delete data.kind; // built-ins keep their type and key
    delete data.key;

    const row = await prisma.assessmentTemplate.update({ where: { id: t.id }, data });
    res.json(toTemplate(row, req.user));
  } catch (err) { fail(res, err); }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const t = Number.isInteger(id) ? await prisma.assessmentTemplate.findFirst({ where: { id } }) : null;
    if (!t) return res.status(404).json({ error: 'ไม่พบแบบประเมิน' });
    if (t.isBuiltIn) return res.status(400).json({ error: 'แบบสำเร็จรูปลบไม่ได้' });
    if (!canEditTemplate(t, req.user)) return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบแบบประเมินนี้' });

    const deactivate = async () => {
      await prisma.assessmentTemplate.update({ where: { id: t.id }, data: { status: 'INACTIVE' } });
      return res.json({ ok: true, deactivated: true });
    };
    if (await prisma.assessmentRecord.count({ where: { templateId: t.id } }) > 0) return await deactivate();
    try {
      await prisma.assessmentTemplate.delete({ where: { id: t.id } });
    } catch (e) {
      if (e.code === 'P2003') return await deactivate(); // a record appeared meanwhile
      throw e;
    }
    res.json({ ok: true, deactivated: false });
  } catch (err) { fail(res, err); }
}

module.exports = { list, create, update, remove };
