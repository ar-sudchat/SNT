// บันทึกหลังแผน: records + scores controller against the local DB (set DATABASE_URL to snt_local first).
const test = require('node:test');
const assert = require('node:assert');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
const { ensureBuiltins } = require('../services/assessmentCore');
const R = require('../controllers/assessmentRecordController');

const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

// Call a controller inside the tenant context with a fake req/res.
const call = (tenantId, fn, req) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, status(s) { this.statusCode = s; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  runWithTenant(tenantId, () => Promise.resolve(fn({ params: {}, query: {}, body: {}, ...req }, res)).catch(reject));
});

test('assessment records + scores', async (t) => {
  const sfx = Date.now();
  const A = await base.tenant.create({ data: { slug: `ar-a-${sfx}`, name: `ar-a-${sfx}` } });
  const B = await base.tenant.create({ data: { slug: `ar-b-${sfx}`, name: `ar-b-${sfx}` } });
  const ids = [A.id, B.id];
  t.after(async () => {
    await asBypass(base.assessmentScore.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.assessmentRecord.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.assessmentTemplate.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.subject.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.student.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.class.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.teacher.deleteMany({ where: { tenantId: { in: ids } } }));
    await asBypass(base.grade.deleteMany({ where: { tenantId: { in: ids } } }));
    await base.tenant.deleteMany({ where: { id: { in: ids } } });
    await base.$disconnect();
  });

  // fixtures: group A has two teachers, two classes, students, a subject; group B has its own class
  const grade = await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: 'ม.1' } }));
  const gradeB = await asBypass(base.grade.create({ data: { tenantId: B.id, gradeName: 'ม.1' } }));
  const mkTeacher = (n) => asBypass(base.teacher.create({ data: { tenantId: A.id, teacherCode: `T${n}-${sfx}`, name: `ครู${n}` } }));
  const tA = await mkTeacher('A'), tB = await mkTeacher('B');
  const cls1 = await asBypass(base.class.create({ data: { tenantId: A.id, className: '1/1', gradeId: grade.id } }));
  const cls2 = await asBypass(base.class.create({ data: { tenantId: A.id, className: '1/2', gradeId: grade.id } }));
  const clsB = await asBypass(base.class.create({ data: { tenantId: B.id, className: '1/1', gradeId: gradeB.id } }));
  const mkStudent = (n, classId, extra = {}) => asBypass(base.student.create({
    data: { tenantId: A.id, studentCode: `S${n}-${sfx}`, studentNumber: n, name: `เด็ก${n}`, classId, ...extra } }));
  const s1 = await mkStudent(1, cls1.id), s2 = await mkStudent(2, cls1.id);
  const sInactive = await mkStudent(3, cls1.id, { status: 'INACTIVE' });
  const sOther = await mkStudent(4, cls2.id);
  const subj = await asBypass(base.subject.create({ data: { tenantId: A.id, subjectCode: `V1-${sfx}`, subjectName: 'วิทย์', teacherId: tA.id } }));

  await runWithTenant(A.id, () => ensureBuiltins(prisma));
  await runWithTenant(B.id, () => ensureBuiltins(prisma));
  const tpl = async (tenant, key) => (await asBypass(base.assessmentTemplate.findFirst({ where: { tenantId: tenant, key } })));
  const noteT = await tpl(A.id, 'note'), behavT = await tpl(A.id, 'behav'), actT = await tpl(A.id, 'act');
  const noteTB = await tpl(B.id, 'note');

  const userA = { role: 'TEACHER', teacherId: tA.id, canManage: false };
  const userB = { role: 'TEACHER', teacherId: tB.id, canManage: false };
  const manager = { role: 'TEACHER', teacherId: tB.id, canManage: true };
  const mk = (body, user = userA) => call(A.id, R.create, { user, body });

  // ---- create: validation ----
  assert.strictEqual((await mk({ templateId: behavT.id, classId: cls1.id, name: '  ' })).status, 400);
  assert.strictEqual((await mk({ templateId: 999999, classId: cls1.id, name: 'x' })).status, 404);
  assert.strictEqual((await mk({ templateId: noteTB.id, classId: cls1.id, name: 'x' })).status, 404, 'template of another group');
  assert.strictEqual((await mk({ templateId: behavT.id, classId: clsB.id, name: 'x' })).status, 404, 'class of another group');
  assert.strictEqual((await mk({ templateId: behavT.id, classId: cls1.id, subjectId: 999999, name: 'x' })).status, 404);
  await asBypass(base.assessmentTemplate.update({ where: { id: actT.id }, data: { status: 'INACTIVE' } }));
  assert.strictEqual((await mk({ templateId: actT.id, classId: cls1.id, name: 'x' })).status, 404, 'inactive template');
  await asBypass(base.assessmentTemplate.update({ where: { id: actT.id }, data: { status: 'ACTIVE' } }));
  assert.strictEqual((await call(A.id, R.list, { user: userA, query: {} })).status, 400, 'list needs classId');

  // ---- create: RUBRIC (full marks by default, no score rows) ----
  let r = await mk({ templateId: behavT.id, classId: cls1.id, subjectId: subj.id, name: 'x'.repeat(300), dateText: 'd'.repeat(150) });
  assert.strictEqual(r.status, 201);
  const rub = r.body;
  assert.strictEqual(rub.name.length, 200); assert.strictEqual(rub.dateText.length, 100);
  assert.strictEqual(rub.kind, 'RUBRIC'); assert.strictEqual(rub.templateName, behavT.name);
  assert.strictEqual(rub.status, 'DRAFT'); assert.strictEqual(rub.teacherId, tA.id); assert.strictEqual(rub.canEdit, true);
  assert.strictEqual(rub.maxScore, 3); assert.strictEqual(rub.criteria.length, 5); assert.strictEqual(rub.templateKey, 'behav');
  assert.deepStrictEqual(rub.subject, { id: subj.id, subjectName: 'วิทย์' });
  assert.deepStrictEqual(rub.students.map(s => s.id), [s1.id, s2.id], 'active students of the class only');
  for (const s of rub.students) {
    assert.deepStrictEqual(s.values, [3, 3, 3, 3, 3]); assert.strictEqual(s.total, 15); assert.strictEqual(s.level, 'ดีมาก');
  }
  assert.deepStrictEqual(rub.levelCounts, { ดีมาก: 2 });
  assert.strictEqual(await asBypass(base.assessmentScore.count({ where: { recordId: rub.id } })), 0, 'no score rows pre-created');

  // ---- create: NOTE ----
  r = await mk({ templateId: noteT.id, classId: cls1.id, name: 'แผนที่ 1', header: { planNo: '1', unitNo: '2', unitName: 'u'.repeat(300), junk: 'z' } });
  assert.strictEqual(r.status, 201);
  const note = r.body;
  assert.strictEqual(note.kind, 'NOTE'); assert.deepStrictEqual(note.students, []);
  assert.deepStrictEqual(note.note, { pct: 80, outcome: '', problems: [], fixes: [], extra: '' });
  assert.deepStrictEqual(Object.keys(note.header), ['planNo', 'unitNo', 'unitName']);
  assert.strictEqual(note.header.unitName.length, 200); assert.strictEqual(note.subject, null);

  // global ADMIN has no teacherId -> stored null, still editable (manager)
  r = await mk({ templateId: noteT.id, classId: cls1.id, name: 'by admin' }, { role: 'ADMIN', teacherId: null });
  assert.strictEqual(r.body.teacherId, null);

  // ---- get ----
  r = await call(A.id, R.get, { user: userA, params: { id: String(rub.id) } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.id, rub.id);
  assert.strictEqual((await call(A.id, R.get, { user: userA, params: { id: 'abc' } })).status, 404);

  // ---- saveScores ----
  const save = (scores, user = userA, id = rub.id) => call(A.id, R.saveScores, { user, params: { id: String(id) }, body: { scores } });
  r = await save([{ studentId: s1.id, values: [1, 1, 1, 1, 1] }, { studentId: s2.id, values: [3, 2, 3, 3, 3] }]);
  assert.strictEqual(r.status, 200);
  const st1 = r.body.students.find(s => s.id === s1.id), st2 = r.body.students.find(s => s.id === s2.id);
  assert.strictEqual(st1.total, 5); assert.strictEqual(st1.level, 'ปรับปรุง');
  assert.strictEqual(st2.total, 14); assert.strictEqual(st2.level, 'ดีมาก');
  assert.deepStrictEqual(r.body.levelCounts, { ปรับปรุง: 1, ดีมาก: 1 });
  // second save upserts (no duplicate rows) and only touches the sent student
  r = await save([{ studentId: s1.id, values: [2, 2, 2, 2, 2] }]);
  assert.strictEqual(r.body.students.find(s => s.id === s1.id).total, 10);
  assert.strictEqual(r.body.students.find(s => s.id === s1.id).level, 'พอใช้');
  assert.strictEqual(r.body.students.find(s => s.id === s2.id).total, 14);
  assert.strictEqual(await asBypass(base.assessmentScore.count({ where: { recordId: rub.id } })), 2);

  // invalid input is rejected and writes nothing
  const before = JSON.stringify((await call(A.id, R.get, { user: userA, params: { id: String(rub.id) } })).body.students);
  for (const bad of [[0, 1, 1, 1, 1], [4, 1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1, 1, 1], [1.5, 1, 1, 1, 1], ['3', 3, 3, 3, 3], null]) {
    r = await save([{ studentId: s2.id, values: [1, 1, 1, 1, 1] }, { studentId: s1.id, values: bad }]);
    assert.strictEqual(r.status, 400, JSON.stringify(bad)); assert.strictEqual(r.body.error, 'คะแนนไม่ถูกต้อง');
  }
  assert.strictEqual((await save([{ studentId: sOther.id, values: [3, 3, 3, 3, 3] }])).status, 400, 'student of another class');
  assert.strictEqual((await save([{ studentId: sInactive.id, values: [3, 3, 3, 3, 3] }])).status, 400, 'inactive student');
  assert.strictEqual((await save([{ studentId: 999999, values: [3, 3, 3, 3, 3] }])).status, 400, 'unknown student');
  assert.strictEqual((await save([{ values: [3, 3, 3, 3, 3] }])).status, 400, 'missing studentId');
  assert.strictEqual((await call(A.id, R.saveScores, { user: userA, params: { id: String(rub.id) }, body: {} })).status, 400);
  assert.strictEqual((await save(Array.from({ length: 501 }, () => ({ studentId: s1.id, values: [3, 3, 3, 3, 3] })))).status, 400, '>500 items');
  assert.strictEqual((await save([{ studentId: s1.id, values: [3, 3, 3, 3, 3] }], userA, note.id)).status, 400, 'NOTE has no scores');
  const after = JSON.stringify((await call(A.id, R.get, { user: userA, params: { id: String(rub.id) } })).body.students);
  assert.strictEqual(after, before, 'rejected saves leave scores untouched');

  // student added after creation shows full marks
  const s5 = await mkStudent(5, cls1.id);
  r = await call(A.id, R.get, { user: userA, params: { id: String(rub.id) } });
  assert.deepStrictEqual(r.body.students.map(s => s.id), [s1.id, s2.id, s5.id]);
  const st5 = r.body.students.find(s => s.id === s5.id);
  assert.deepStrictEqual(st5.values, [3, 3, 3, 3, 3]); assert.strictEqual(st5.level, 'ดีมาก');

  // ---- permissions ----
  const upd = (id, body, user) => call(A.id, R.update, { user, params: { id: String(id) }, body });
  r = await call(A.id, R.get, { user: userB, params: { id: String(rub.id) } });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.canEdit, false, 'any member can view');
  assert.strictEqual((await upd(rub.id, { name: 'hijack' }, userB)).status, 403);
  assert.strictEqual((await save([{ studentId: s1.id, values: [1, 1, 1, 1, 1] }], userB)).status, 403);
  assert.strictEqual((await call(A.id, R.remove, { user: userB, params: { id: String(rub.id) } })).status, 403);
  r = await upd(rub.id, { name: 'จัดการโดยผู้จัดการ' }, manager);
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.name, 'จัดการโดยผู้จัดการ'); assert.strictEqual(r.body.canEdit, true);
  assert.strictEqual((await save([{ studentId: s2.id, values: [3, 3, 3, 3, 3] }], manager)).status, 200);
  assert.strictEqual((await upd(999999, { name: 'x' }, userA)).status, 404);

  // ---- update: common fields ----
  r = await upd(rub.id, { dateText: ' 3 มิ.ย. 69 ', status: 'DONE' }, userA);
  assert.strictEqual(r.body.dateText, '3 มิ.ย. 69'); assert.strictEqual(r.body.status, 'DONE');
  assert.strictEqual((await upd(rub.id, { status: 'WHATEVER' }, userA)).status, 400);
  assert.strictEqual((await upd(rub.id, { name: '   ' }, userA)).status, 400);
  // note/header are ignored on a RUBRIC record
  r = await upd(rub.id, { note: { pct: 10 }, header: { planNo: '9' } }, userA);
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.note, null); assert.strictEqual(r.body.header, null);

  // ---- update: NOTE fields with clipping ----
  r = await upd(note.id, {
    header: { unitName: 'หน่วยใหม่' },
    note: { pct: 65, outcome: 'o'.repeat(900), problems: Array.from({ length: 30 }, (_, i) => `p${i}`), fixes: ['f'.repeat(700), '', 'ok'], extra: 'e'.repeat(1500) },
  }, userA);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.note.pct, 65); assert.strictEqual(r.body.note.outcome.length, 500);
  assert.strictEqual(r.body.note.problems.length, 20); assert.strictEqual(r.body.note.problems[0], 'p0');
  assert.deepStrictEqual(r.body.note.fixes.map(f => f.length), [500, 2]);
  assert.strictEqual(r.body.note.extra.length, 1000);
  assert.deepStrictEqual(r.body.header, { planNo: '1', unitNo: '2', unitName: 'หน่วยใหม่' }, 'header merges onto stored values');
  // partial note update keeps the rest
  r = await upd(note.id, { note: { outcome: 'ผ่าน' } }, userA);
  assert.strictEqual(r.body.note.outcome, 'ผ่าน'); assert.strictEqual(r.body.note.pct, 65); assert.strictEqual(r.body.note.problems.length, 20);
  for (const pct of [-1, 101, 5.5, 'abc']) assert.strictEqual((await upd(note.id, { note: { pct } }, userA)).status, 400, String(pct));
  assert.strictEqual((await upd(note.id, { note: 'text' }, userA)).status, 400);
  assert.strictEqual((await upd(note.id, { note: { pct: 0 } }, userA)).body.note.pct, 0);

  // ---- list: filters and ordering ----
  const listQ = (query, tenant = A.id) => call(tenant, R.list, { user: userB, query });
  r = await listQ({ classId: String(cls1.id) });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.body.length, 3);
  const dates = r.body.map(x => +new Date(x.assessedOn));
  assert.deepStrictEqual(dates, [...dates].sort((a, b) => b - a));
  const sameTime = r.body.filter(x => +new Date(x.assessedOn) === dates[0]).map(x => x.id);
  assert.deepStrictEqual(sameTime, [...sameTime].sort((a, b) => b - a), 'id desc on ties');
  assert.ok(r.body.every(x => x.canEdit === false && !('students' in x)));
  assert.strictEqual((await listQ({ classId: String(cls1.id), subjectId: String(subj.id) })).body.length, 1);
  assert.strictEqual((await listQ({ classId: String(cls1.id), templateId: String(noteT.id) })).body.length, 2);
  assert.strictEqual((await listQ({ classId: String(cls1.id), status: 'DONE' })).body.map(x => x.id).join(), String(rub.id));
  assert.strictEqual((await listQ({ classId: String(cls2.id) })).body.length, 0);

  // ---- cross-group isolation ----
  const idParams = { id: String(rub.id) };
  assert.strictEqual((await call(B.id, R.get, { user: manager, params: idParams })).status, 404);
  assert.strictEqual((await call(B.id, R.update, { user: manager, params: idParams, body: { name: 'x' } })).status, 404);
  assert.strictEqual((await call(B.id, R.saveScores, { user: manager, params: idParams, body: { scores: [] } })).status, 404);
  assert.strictEqual((await call(B.id, R.remove, { user: manager, params: idParams })).status, 404);
  assert.strictEqual((await listQ({ classId: String(cls1.id) }, B.id)).body.length, 0);
  assert.strictEqual((await call(B.id, R.create, { user: manager, body: { templateId: noteTB.id, classId: cls1.id, name: 'x' } })).status, 404, 'class of group A from group B');

  // ---- remove: scores cascade ----
  assert.ok(await asBypass(base.assessmentScore.count({ where: { recordId: rub.id } })) > 0);
  r = await call(A.id, R.remove, { user: userA, params: idParams });
  assert.deepStrictEqual(r.body, { ok: true });
  assert.strictEqual(await asBypass(base.assessmentScore.count({ where: { recordId: rub.id } })), 0);
  assert.strictEqual((await call(A.id, R.get, { user: userA, params: idParams })).status, 404);
  assert.strictEqual((await call(A.id, R.remove, { user: userA, params: idParams })).status, 404);

  // ---- v2: response types and class questions ----
  const tplData = (key, over) => asBypass(base.assessmentTemplate.create({ data: {
    tenantId: A.id, key, name: key, kind: 'RUBRIC', maxScore: 3, levels: [{ min: 0.5, label: 'ผ่าน' }, { min: 0, label: 'ไม่ผ่าน' }],
    criteria: [{ label: 'ก', short: 'ก' }, { label: 'ข', short: 'ข' }], ...over } }));
  const fields = [
    { key: 'f1', label: 'สรุป', type: 'text' }, { key: 'f2', label: 'รายละเอียด', type: 'longtext' }, { key: 'f3', label: 'จำนวน', type: 'number' },
    { key: 'f4', label: 'ระดับ', type: 'choice', options: ['ต่ำ', 'สูง'] }, { key: 'f5', label: 'อุปกรณ์', type: 'checklist', options: ['สี', 'กรรไกร', 'กาว'] },
  ];
  const classT = await tplData('v2-class', { kind: 'CLASS', maxScore: 0, criteria: [], levels: [], classFields: fields });
  const bothT = await tplData('v2-both', { classFields: fields.slice(0, 1) });
  const pfT = await tplData('v2-pf', { responseType: 'PASSFAIL', maxScore: 2, levels: [] });
  const ckT = await tplData('v2-ck', { responseType: 'CHECK', maxScore: 1, levels: [{ min: 0.5, label: 'ดี' }, { min: 0, label: 'ควรปรับปรุง' }] });
  const txT = await tplData('v2-tx', { responseType: 'TEXT', maxScore: 0, levels: [] });

  // CLASS record: snapshot, no students, answers cleaned and replaced as a whole
  r = await mk({ templateId: classT.id, classId: cls1.id, name: 'ระดับห้อง' });
  assert.strictEqual(r.status, 201);
  const cr = r.body;
  assert.strictEqual(cr.kind, 'CLASS'); assert.strictEqual(cr.responseType, 'SCORE'); assert.deepStrictEqual(cr.students, []); assert.deepStrictEqual(cr.levelCounts, {});
  assert.deepStrictEqual(cr.classFields, fields); assert.deepStrictEqual(cr.classAnswers, {});
  assert.strictEqual(cr.header, null); assert.strictEqual(cr.note, null);
  await asBypass(base.assessmentTemplate.update({ where: { id: classT.id }, data: { classFields: [] } }));
  assert.strictEqual((await call(A.id, R.get, { user: userA, params: { id: String(cr.id) } })).body.classFields.length, 5, 'snapshot survives template edits');
  r = await upd(cr.id, { classAnswers: {
    f1: ' ผ่านดี ', f2: 'd'.repeat(4000), f3: '12.5', f4: 'สูง', f5: ['สี', 'ไม่มี', 'กาว'], zzz: 'unknown',
  } }, userA);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.classAnswers.f1, 'ผ่านดี'); assert.strictEqual(r.body.classAnswers.f2.length, 3000);
  assert.strictEqual(r.body.classAnswers.f3, 12.5); assert.strictEqual(r.body.classAnswers.f4, 'สูง');
  assert.deepStrictEqual(r.body.classAnswers.f5, ['สี', 'กาว']); assert.ok(!('zzz' in r.body.classAnswers));
  r = await upd(cr.id, { classAnswers: { f4: 'กลาง', f3: 'abc', f1: 'ใหม่' } }, userA);
  assert.deepStrictEqual(r.body.classAnswers, { f1: 'ใหม่' }, 'invalid choice/number dropped; whole object replaced');
  r = await upd(cr.id, { name: 'เปลี่ยนชื่อ' }, userA);
  assert.deepStrictEqual(r.body.classAnswers, { f1: 'ใหม่' }, 'untouched when classAnswers is not sent');
  assert.strictEqual((await upd(cr.id, { classAnswers: { f1: 'x' } }, userB)).status, 403);
  assert.strictEqual((await save([{ studentId: s1.id, values: [] }], userA, cr.id)).status, 400, 'CLASS has no scores');
  r = await call(A.id, R.list, { user: userA, query: { classId: String(cls1.id) } });
  assert.strictEqual(r.body.find(x => x.id === cr.id).responseType, 'SCORE'); assert.ok(!('classAnswers' in r.body[0]));

  // RUBRIC with class questions keeps scores and takes answers; a plain RUBRIC ignores them; NOTE ignores them
  r = await mk({ templateId: bothT.id, classId: cls1.id, name: 'ทั้งสอง' });
  assert.strictEqual(r.body.students.length, 3);
  const both = r.body;
  r = await upd(both.id, { classAnswers: { f1: 'ตอบ', other: 'x' } }, userA);
  assert.deepStrictEqual(r.body.classAnswers, { f1: 'ตอบ' }); assert.strictEqual(r.body.students.length, 3);
  r = await upd(both.id, { classAnswers: {} }, userA);
  assert.deepStrictEqual(r.body.classAnswers, {});
  r = await mk({ templateId: pfT.id, classId: cls1.id, name: 'ผ่าน' });
  const pf = r.body;
  assert.strictEqual(pf.responseType, 'PASSFAIL'); assert.strictEqual(pf.maxScore, 2); assert.deepStrictEqual(pf.classFields, []);
  assert.deepStrictEqual((await upd(pf.id, { classAnswers: { f1: 'x' } }, userA)).body.classAnswers, {}, 'no class questions -> ignored');
  assert.strictEqual(await asBypass(base.assessmentRecord.findFirst({ where: { id: pf.id } })).then(x => x.classAnswers), null);
  assert.deepStrictEqual((await upd(note.id, { classAnswers: { f1: 'x' } }, userA)).body.classAnswers, {});

  // PASSFAIL: default ผ่าน, 1/2 accepted, others rejected
  assert.deepStrictEqual(pf.students[0].values, [2, 2]); assert.strictEqual(pf.students[0].total, 2); assert.strictEqual(pf.students[0].level, '');
  const savePf = (values, id = pf.id) => save([{ studentId: s1.id, values }], userA, id);
  r = await savePf([2, 1]);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.students.find(s => s.id === s1.id).values, [2, 1]); assert.strictEqual(r.body.students.find(s => s.id === s1.id).total, 1);
  assert.deepStrictEqual(r.body.levelCounts, { '': 3 });
  for (const bad of [[0, 1], [3, 1], [2], ['2', 1], [1.5, 1]]) assert.strictEqual((await savePf(bad)).status, 400, JSON.stringify(bad));

  // CHECK: 0 or 1, levels from the template
  r = await mk({ templateId: ckT.id, classId: cls1.id, name: 'ติ๊ก' });
  const ck = r.body;
  assert.deepStrictEqual(ck.students[0].values, [1, 1]); assert.strictEqual(ck.students[0].total, 2); assert.strictEqual(ck.students[0].level, 'ดี');
  r = await save([{ studentId: s1.id, values: [0, 0] }, { studentId: s2.id, values: [1, 0] }], userA, ck.id);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.students.find(s => s.id === s1.id).level, 'ควรปรับปรุง');
  assert.strictEqual(r.body.students.find(s => s.id === s2.id).total, 1); assert.strictEqual(r.body.students.find(s => s.id === s2.id).level, 'ดี');
  for (const bad of [[2, 1], [-1, 0], [true, 0]]) assert.strictEqual((await save([{ studentId: s1.id, values: bad }], userA, ck.id)).status, 400, JSON.stringify(bad));

  // TEXT: strings up to 200 chars, no totals
  r = await mk({ templateId: txT.id, classId: cls1.id, name: 'เขียน' });
  const tx = r.body;
  assert.deepStrictEqual(tx.students[0].values, ['', '']); assert.strictEqual(tx.students[0].total, 0); assert.strictEqual(tx.students[0].level, '');
  r = await save([{ studentId: s1.id, values: ['  เขียนได้ดี ', 'สะกดผิด'] }], userA, tx.id);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.students.find(s => s.id === s1.id).values, ['เขียนได้ดี', 'สะกดผิด']);
  for (const bad of [[1, 2], ['a'], ['a', 'b', 'c'], ['a', 'x'.repeat(201)], [null, 'a']]) {
    r = await save([{ studentId: s1.id, values: bad }], userA, tx.id);
    assert.strictEqual(r.status, 400, JSON.stringify(bad)); assert.strictEqual(r.body.error, 'คำตอบไม่ถูกต้อง');
  }
  assert.strictEqual((await save([{ studentId: s1.id, values: ['x'.repeat(200), ''] }], userA, tx.id)).status, 200);
});
