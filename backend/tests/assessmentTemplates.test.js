const test = require('node:test');
const assert = require('node:assert');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
const T = require('../controllers/assessmentTemplateController');

// Fixture writes on RLS tables must set app.bypass_rls.
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

// Call a controller handler inside a tenant with a fake req/res.
const call = (tenantId, fn, user, { body, params } = {}) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  runWithTenant(tenantId, () => fn({ user, body: body || {}, params: params || {} }, res)).catch(reject);
});

const rubric = (over = {}) => ({
  name: 'แบบทดสอบ', kind: 'RUBRIC', maxScore: 3, useAverage: false,
  criteria: [{ label: 'ข้อหนึ่ง', short: 'หนึ่ง' }, { label: 'ข้อสอง' }],
  levels: [{ min: 0.5, label: 'ผ่าน' }, { min: 0, label: 'ไม่ผ่าน' }], ...over,
});

test('assessment templates API', async (t) => {
  const sfx = Date.now();
  const A = await base.tenant.create({ data: { slug: `tpl-a-${sfx}`, name: `A${sfx}` } });
  const B = await base.tenant.create({ data: { slug: `tpl-b-${sfx}`, name: `B${sfx}` } });
  const mkTeacher = (tenantId, n) => asBypass(base.teacher.create({ data: { tenantId, teacherCode: `T${n}-${sfx}`, name: `ครู${n}` } }));
  const t1 = await mkTeacher(A.id, 1), t2 = await mkTeacher(A.id, 2), tb = await mkTeacher(B.id, 3);
  const grade = await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: `G${sfx}` } }));
  const cls = await asBypass(base.class.create({ data: { tenantId: A.id, className: `C${sfx}`, gradeId: grade.id } }));

  t.after(async () => {
    const ids = [A.id, B.id];
    await asBypass(base.assessmentRecord.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.assessmentTemplate.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.class.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.grade.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.teacher.deleteMany({ where: { tenantId: { in: ids } } }));
    await base.tenant.deleteMany({ where: { id: { in: ids } } });
    await base.$disconnect();
  });

  const teacher1 = { id: 1, role: 'TEACHER', teacherId: t1.id };
  const teacher2 = { id: 2, role: 'TEACHER', teacherId: t2.id };
  const manager = { id: 3, role: 'TEACHER', teacherId: t2.id, canManage: true };
  const admin = { id: 4, role: 'ADMIN', teacherId: null };
  const teacherB = { id: 5, role: 'TEACHER', teacherId: tb.id };

  await t.test('built-ins are seeded once, in order, with canEdit by role', async () => {
    const r1 = await call(A.id, T.list, teacher1);
    const r2 = await call(A.id, T.list, teacher1);
    assert.strictEqual(r1.status, 200);
    assert.deepStrictEqual(r1.body.map(x => x.key), ['note', 'behav', 'act', 'work', 'trait', 'comp']);
    assert.strictEqual(r2.body.length, 6);
    assert.strictEqual(await asBypass(base.assessmentTemplate.count({ where: { tenantId: A.id, isBuiltIn: true } })), 6);
    assert.ok(r1.body.every(x => x.isBuiltIn && x.canEdit === false));
    assert.ok((await call(A.id, T.list, manager)).body.every(x => x.canEdit === true));
    assert.deepStrictEqual(Object.keys(r1.body[1]).sort(),
      ['canEdit', 'classFields', 'createdById', 'criteria', 'id', 'isBuiltIn', 'key', 'kind', 'levels', 'maxScore', 'name', 'responseType', 'useAverage']);
    assert.ok(r1.body.every(x => x.responseType === 'SCORE' && Array.isArray(x.classFields) && x.classFields.length === 0));
  });

  let mine, noteId, behavId;
  await t.test('create validates and stores a custom template', async () => {
    const bad = await call(A.id, T.create, teacher1, { body: rubric({ name: '  ' }) });
    assert.strictEqual(bad.status, 400);
    assert.ok(bad.body.error);
    assert.strictEqual((await call(A.id, T.create, teacher1, { body: rubric({ maxScore: 99 }) })).status, 400);
    assert.strictEqual((await call(A.id, T.create, teacher1, { body: rubric({ criteria: [] }) })).status, 400);

    const ok = await call(A.id, T.create, teacher1, { body: rubric() });
    assert.strictEqual(ok.status, 201);
    mine = ok.body;
    assert.match(mine.key, /^c-\d+$/);
    assert.strictEqual(mine.isBuiltIn, false);
    assert.strictEqual(mine.createdById, t1.id);
    assert.strictEqual(mine.canEdit, true);
    assert.deepStrictEqual(mine.criteria.map(c => c.short), ['หนึ่ง', 'ข้อสอง']);

    const second = await call(A.id, T.create, teacher2, { body: rubric({ name: 'ก แบบแรก' }) });
    assert.strictEqual(second.status, 201);
    assert.notStrictEqual(second.body.key, mine.key);

    const adminMade = await call(A.id, T.create, admin, { body: rubric({ name: 'โดยแอดมิน' }) });
    assert.strictEqual(adminMade.body.createdById, null);

    const listed = (await call(A.id, T.list, teacher1)).body;
    assert.deepStrictEqual(listed.slice(0, 6).map(x => x.key), ['note', 'behav', 'act', 'work', 'trait', 'comp']);
    assert.ok(listed.slice(6).every(x => !x.isBuiltIn));
    assert.strictEqual(listed[6].name, 'ก แบบแรก');
    assert.strictEqual(listed.find(x => x.id === mine.id).canEdit, true);
    assert.strictEqual(listed.find(x => x.id === second.body.id).canEdit, false);
    noteId = listed.find(x => x.key === 'note').id;
    behavId = listed.find(x => x.key === 'behav').id;
  });

  await t.test('update: owner, other teacher, manager, validation', async () => {
    const up = await call(A.id, T.update, teacher1, { params: { id: String(mine.id) }, body: { name: 'ชื่อใหม่', useAverage: true } });
    assert.strictEqual(up.status, 200);
    assert.strictEqual(up.body.name, 'ชื่อใหม่');
    assert.strictEqual(up.body.useAverage, true);
    assert.strictEqual(up.body.maxScore, 3); // untouched by a partial update
    assert.strictEqual(up.body.criteria.length, 2);

    assert.strictEqual((await call(A.id, T.update, teacher2, { params: { id: String(mine.id) }, body: { name: 'x' } })).status, 403);
    assert.strictEqual((await call(A.id, T.update, manager, { params: { id: String(mine.id) }, body: { name: 'โดยผู้จัดการ' } })).body.name, 'โดยผู้จัดการ');
    assert.strictEqual((await call(A.id, T.update, teacher1, { params: { id: String(mine.id) }, body: { name: '' } })).status, 400);
    assert.strictEqual((await call(A.id, T.update, teacher1, { params: { id: String(mine.id) }, body: { maxScore: 1 } })).status, 400);
    assert.strictEqual((await call(A.id, T.update, teacher1, { params: { id: '999999999' }, body: { name: 'x' } })).status, 404);
    assert.strictEqual((await call(A.id, T.update, teacher1, { params: { id: 'abc' }, body: { name: 'x' } })).status, 404);

    // custom template may switch type (validated as a whole)
    const toNote = await call(A.id, T.update, teacher1, { params: { id: String(mine.id) }, body: { kind: 'NOTE' } });
    assert.strictEqual(toNote.body.kind, 'NOTE');
    assert.strictEqual(toNote.body.maxScore, 0);
    const back = await call(A.id, T.update, teacher1, { params: { id: String(mine.id) }, body: { kind: 'RUBRIC', maxScore: 4 } });
    assert.strictEqual(back.body.kind, 'RUBRIC');
    assert.strictEqual(back.body.maxScore, 4);
  });

  await t.test('teacher cannot edit a built-in; manager can but kind/key stay', async () => {
    assert.strictEqual((await call(A.id, T.update, teacher1, { params: { id: String(behavId) }, body: { name: 'x' } })).status, 403);
    const up = await call(A.id, T.update, manager, { params: { id: String(behavId) }, body: { name: 'พฤติกรรมของเรา', kind: 'NOTE', key: 'hack' } });
    assert.strictEqual(up.status, 200);
    assert.strictEqual(up.body.name, 'พฤติกรรมของเรา');
    assert.strictEqual(up.body.kind, 'RUBRIC');
    assert.strictEqual(up.body.key, 'behav');
    assert.strictEqual(up.body.maxScore, 3);
    // a NOTE built-in stays a NOTE and accepts a rename without criteria
    const note = await call(A.id, T.update, admin, { params: { id: String(noteId) }, body: { name: 'บันทึกหลังสอน' } });
    assert.strictEqual(note.status, 200);
    assert.strictEqual(note.body.kind, 'NOTE');
    assert.strictEqual(note.body.maxScore, 0);
  });

  await t.test('response types and class questions', async () => {
    const fields = [
      { key: 'f1', label: 'สรุปผล', type: 'longtext' },
      { label: 'ระดับความพร้อม', type: 'choice', options: ['ต่ำ', 'กลาง', 'สูง', 'กลาง', ''] },
      { key: 'f1', label: 'อุปกรณ์', type: 'checklist', options: ['สี', 'กรรไกร'] },
      { label: '   ', type: 'text' },
    ];
    // class-only form: needs at least one question, no criteria needed
    assert.strictEqual((await call(A.id, T.create, teacher1, { body: { name: 'ห้อง', kind: 'CLASS', classFields: [] } })).status, 400);
    assert.strictEqual((await call(A.id, T.create, teacher1, { body: { name: 'ห้อง', kind: 'CLASS', classFields: [{ label: 'ก', type: 'choice', options: [] }] } })).status, 400);
    const cls1T = await call(A.id, T.create, teacher1, { body: { name: 'แบบระดับห้อง', kind: 'CLASS', classFields: fields } });
    assert.strictEqual(cls1T.status, 201);
    assert.strictEqual(cls1T.body.kind, 'CLASS');
    assert.strictEqual(cls1T.body.maxScore, 0);
    assert.strictEqual(cls1T.body.responseType, 'SCORE');
    assert.deepStrictEqual(cls1T.body.classFields.map(f => f.key), ['f1', 'f2', 'f1_3']);
    assert.deepStrictEqual(cls1T.body.classFields[1].options, ['ต่ำ', 'กลาง', 'สูง']);

    // per-student formats set their own scale; levels are optional outside SCORE
    const pf = await call(A.id, T.create, teacher1, { body: rubric({ name: 'ผ่าน/ไม่ผ่าน', responseType: 'PASSFAIL', maxScore: 9, levels: [] }) });
    assert.strictEqual(pf.status, 201);
    assert.strictEqual(pf.body.responseType, 'PASSFAIL'); assert.strictEqual(pf.body.maxScore, 2); assert.deepStrictEqual(pf.body.levels, []);
    const ck = await call(A.id, T.create, teacher1, { body: rubric({ name: 'ติ๊ก', responseType: 'CHECK', classFields: [{ label: 'หมายเหตุ', type: 'text' }] }) });
    assert.strictEqual(ck.body.maxScore, 1); assert.strictEqual(ck.body.responseType, 'CHECK'); assert.strictEqual(ck.body.classFields.length, 1);
    const tx = await call(A.id, T.create, teacher1, { body: rubric({ name: 'ข้อความ', responseType: 'TEXT' }) });
    assert.strictEqual(tx.body.maxScore, 0);
    const bogus = await call(A.id, T.create, teacher1, { body: rubric({ name: 'เพี้ยน', responseType: 'NOPE' }) });
    assert.strictEqual(bogus.body.responseType, 'SCORE'); assert.strictEqual(bogus.body.maxScore, 3);
    assert.strictEqual((await call(A.id, T.create, teacher1, { body: rubric({ levels: [] }) })).status, 400, 'SCORE still needs levels');

    // changing the response type re-validates the whole template; classFields update alone leaves the rest
    const toCheck = await call(A.id, T.update, teacher1, { params: { id: String(pf.body.id) }, body: { responseType: 'CHECK' } });
    assert.strictEqual(toCheck.body.responseType, 'CHECK'); assert.strictEqual(toCheck.body.maxScore, 1); assert.strictEqual(toCheck.body.criteria.length, 2);
    const toScore = await call(A.id, T.update, teacher1, { params: { id: String(pf.body.id) }, body: { responseType: 'SCORE', maxScore: 5, levels: [{ min: 0, label: 'ทั่วไป' }] } });
    assert.strictEqual(toScore.body.maxScore, 5);
    assert.strictEqual((await call(A.id, T.update, teacher1, { params: { id: String(pf.body.id) }, body: { responseType: 'SCORE', maxScore: 1 } })).status, 400);
    const withFields = await call(A.id, T.update, teacher1, { params: { id: String(ck.body.id) }, body: { classFields: [{ label: 'ใหม่', type: 'number' }, { label: 'อีก', type: 'text' }] } });
    assert.deepStrictEqual(withFields.body.classFields.map(f => f.type), ['number', 'text']);
    assert.strictEqual(withFields.body.responseType, 'CHECK'); assert.strictEqual(withFields.body.maxScore, 1);
    assert.strictEqual((await call(A.id, T.update, teacher1, { params: { id: String(ck.body.id) }, body: { classFields: 'x' } })).status, 400);
    // a rubric may become class-only (kind CLASS) when it keeps its questions
    const toClass = await call(A.id, T.update, teacher1, { params: { id: String(ck.body.id) }, body: { kind: 'CLASS' } });
    assert.strictEqual(toClass.body.kind, 'CLASS'); assert.strictEqual(toClass.body.maxScore, 0);
    // built-ins keep SCORE and no class questions
    const bi = await call(A.id, T.update, manager, { params: { id: String(behavId) }, body: { responseType: 'TEXT', classFields: [{ label: 'x', type: 'text' }] } });
    assert.strictEqual(bi.status, 200); assert.strictEqual(bi.body.responseType, 'SCORE'); assert.deepStrictEqual(bi.body.classFields, []); assert.strictEqual(bi.body.maxScore, 3);
  });

  await t.test('remove: built-in refused, permissions, delete vs deactivate', async () => {
    const r = await call(A.id, T.remove, admin, { params: { id: String(behavId) } });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.error, 'แบบสำเร็จรูปลบไม่ได้');
    assert.strictEqual((await call(A.id, T.remove, teacher2, { params: { id: String(mine.id) } })).status, 403);
    assert.strictEqual((await call(A.id, T.remove, teacher1, { params: { id: '999999999' } })).status, 404);

    const plain = (await call(A.id, T.create, teacher1, { body: rubric({ name: 'ไม่มีบันทึก' }) })).body;
    const del = await call(A.id, T.remove, teacher1, { params: { id: String(plain.id) } });
    assert.deepStrictEqual(del.body, { ok: true, deactivated: false });
    assert.strictEqual(await asBypass(base.assessmentTemplate.count({ where: { id: plain.id } })), 0);

    await asBypass(base.assessmentRecord.create({ data: {
      tenantId: A.id, templateId: mine.id, classId: cls.id, name: 'บันทึก', kind: 'RUBRIC', templateName: mine.name,
    } }));
    const soft = await call(A.id, T.remove, teacher1, { params: { id: String(mine.id) } });
    assert.deepStrictEqual(soft.body, { ok: true, deactivated: true });
    const row = await asBypass(base.assessmentTemplate.findFirst({ where: { id: mine.id } }));
    assert.strictEqual(row.status, 'INACTIVE');
    assert.ok(!(await call(A.id, T.list, teacher1)).body.some(x => x.id === mine.id));
    assert.strictEqual((await call(A.id, T.update, teacher1, { params: { id: String(mine.id) }, body: { name: 'x' } })).status, 404);
  });

  await t.test('tenant isolation', async () => {
    const own = (await call(A.id, T.create, teacher1, { body: rubric({ name: 'ของกลุ่ม A' }) })).body;
    const listB = (await call(B.id, T.list, teacherB)).body;
    assert.strictEqual(listB.length, 6, 'group B gets its own six built-ins only');
    assert.ok(listB.every(x => x.isBuiltIn && x.id !== own.id));
    assert.ok(!listB.some(x => x.id === own.id));
    assert.strictEqual((await call(B.id, T.update, { ...teacherB, canManage: true }, { params: { id: String(own.id) }, body: { name: 'x' } })).status, 404);
    assert.strictEqual((await call(B.id, T.remove, { ...teacherB, canManage: true }, { params: { id: String(own.id) } })).status, 404);
    assert.strictEqual((await asBypass(base.assessmentTemplate.findFirst({ where: { id: own.id } }))).name, 'ของกลุ่ม A');
    assert.strictEqual(await asBypass(base.assessmentTemplate.count({ where: { tenantId: B.id } })), 6);
  });
});
