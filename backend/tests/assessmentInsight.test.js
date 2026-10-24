// บันทึกหลังแผน: fill-from-task mapping, term summary, PDPA export coverage. Real local DB.
const test = require('node:test');
const assert = require('node:assert');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
const I = require('../controllers/assessmentInsightController');
const tenantData = require('../controllers/tenantDataController');
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

// Call a controller inside a tenant context, collecting what it sends.
function call(tenantId, fn, req) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200, headers: {},
      status(s) { this.statusCode = s; return this; },
      setHeader(k, v) { this.headers[k] = v; },
      json(b) { resolve({ status: this.statusCode, body: b }); },
      send(b) { resolve({ status: this.statusCode, body: b }); },
    };
    runWithTenant(tenantId, () => fn({ params: {}, query: {}, body: {}, headers: {}, ...req }, res, reject)).catch(reject);
  });
}

test('lesson log insight: fill-from-task, summary, PDPA export', async (t) => {
  try { await base.$queryRaw`SELECT 1`; } catch { return t.skip('local DB unreachable'); }
  const sfx = Date.now().toString(36);
  const A = await base.tenant.create({ data: { slug: `ai-a-${sfx}`, name: `ai A ${sfx}` } });
  const B = await base.tenant.create({ data: { slug: `ai-b-${sfx}`, name: `ai B ${sfx}` } });
  const ids = [A.id, B.id];
  t.after(async () => {
    const w = { where: { tenantId: { in: ids } } };
    for (const m of ['assessmentScore', 'assessmentRecord', 'assessmentTemplate', 'submission', 'task', 'subject', 'student', 'class', 'grade', 'teacher', 'auditLog'])
      await asBypass(base[m].deleteMany(w));
    await base.tenant.deleteMany({ where: { id: { in: ids } } });
    await base.$disconnect();
  });

  const mk = async (tid, n) => {
    const teacher = await asBypass(base.teacher.create({ data: { tenantId: tid, teacherCode: `T${n}${sfx}`, name: `ครู${n}` } }));
    const other = await asBypass(base.teacher.create({ data: { tenantId: tid, teacherCode: `O${n}${sfx}`, name: `ครูอื่น${n}` } }));
    const grade = await asBypass(base.grade.create({ data: { tenantId: tid, gradeName: `G${n}${sfx}` } }));
    const cls = await asBypass(base.class.create({ data: { tenantId: tid, className: `C${n}${sfx}`, gradeId: grade.id } }));
    const subject = await asBypass(base.subject.create({ data: { tenantId: tid, subjectCode: `J${n}${sfx}`, subjectName: `วิชา${n}`, teacherId: teacher.id } }));
    return { teacher, other, grade, cls, subject };
  };
  const a = await mk(A.id, 'a'), b = await mk(B.id, 'b');

  // students: 1 on time (has stored values), 2 pending on time, 3 approved late, 4 rejected, 5 not submitted, 6 no row, 7 inactive
  const names = ['ด.ช.หนึ่ง', 'ด.ญ.สอง', 'ด.ช.สาม', 'ด.ญ.สี่', 'ด.ช.ห้า', 'ด.ญ.หก', 'ด.ช.เจ็ด'];
  const st = [];
  for (let i = 0; i < names.length; i++) {
    st.push(await asBypass(base.student.create({ data: {
      tenantId: A.id, studentCode: `S${i}${sfx}`, studentNumber: i + 1, name: names[i], classId: a.cls.id, status: i === 6 ? 'INACTIVE' : 'ACTIVE' } })));
  }
  const deadline = new Date('2026-01-10T00:00:00Z');
  const onTime = new Date('2026-01-09T00:00:00Z'), late = new Date('2026-01-12T00:00:00Z');
  const task = await asBypass(base.task.create({ data: { tenantId: A.id, subjectId: a.subject.id, taskName: 'ใบงาน', taskNumber: 1, createdById: a.teacher.id, deadline } }));
  const noDl = await asBypass(base.task.create({ data: { tenantId: A.id, subjectId: a.subject.id, taskName: 'ไม่มีกำหนด', taskNumber: 2, createdById: a.teacher.id } }));
  const bTask = await asBypass(base.task.create({ data: { tenantId: B.id, subjectId: b.subject.id, taskName: 'ของกลุ่มอื่น', taskNumber: 1, createdById: b.teacher.id } }));
  const sub = (s, taskId, status, submitDate) => base.submission.create({ data: { tenantId: A.id, studentId: s.id, taskId, status, submitDate } });
  await asBypass(sub(st[0], task.id, 'APPROVED', onTime));
  await asBypass(sub(st[1], task.id, 'PENDING', onTime));
  await asBypass(sub(st[2], task.id, 'APPROVED', late));
  await asBypass(sub(st[3], task.id, 'REJECTED', onTime));
  await asBypass(sub(st[4], task.id, 'NOT_SUBMITTED', null));
  await asBypass(sub(st[2], noDl.id, 'APPROVED', late)); // no deadline -> never late

  const levels = [{ min: 0.93, label: 'ดีมาก' }, { min: 0.73, label: 'ดี' }, { min: 0.53, label: 'พอใช้' }, { min: 0, label: 'ปรับปรุง' }];
  const criteria = [{ label: 'ก', short: 'ก' }, { label: 'ข', short: 'ข', source: 'scan' }, { label: 'ค', short: 'ค' }];
  const tpl = await asBypass(base.assessmentTemplate.create({ data: { tenantId: A.id, key: `c-${sfx}`, name: 'แบบทดสอบ', kind: 'RUBRIC', maxScore: 4, criteria, levels } }));
  const noteTpl = await asBypass(base.assessmentTemplate.create({ data: { tenantId: A.id, key: `n-${sfx}`, name: 'บันทึก', kind: 'NOTE', maxScore: 0 } }));
  const rec = (over) => asBypass(base.assessmentRecord.create({ data: {
    tenantId: A.id, templateId: tpl.id, classId: a.cls.id, subjectId: a.subject.id, teacherId: a.teacher.id,
    name: 'กิจกรรม', kind: 'RUBRIC', templateName: 'แบบทดสอบ', criteria, maxScore: 4, levels, ...over } }));
  const r1 = await rec({ name: 'ครั้งที่ 1', assessedOn: new Date('2026-01-05') });
  const r2 = await rec({ name: 'ครั้งที่ 2', assessedOn: new Date('2026-01-20') });
  const rNote = await asBypass(base.assessmentRecord.create({ data: {
    tenantId: A.id, templateId: noteTpl.id, classId: a.cls.id, teacherId: a.teacher.id, name: 'บันทึก', kind: 'NOTE', templateName: 'บันทึก' } }));
  await asBypass(base.assessmentScore.create({ data: { tenantId: A.id, recordId: r1.id, studentId: st[0].id, values: [2, 2, 2] } }));
  // r2: st[1] has a stored row that no longer fits the snapshot -> treated as full marks
  await asBypass(base.assessmentScore.create({ data: { tenantId: A.id, recordId: r2.id, studentId: st[1].id, values: [1, 1] } }));
  await asBypass(base.assessmentScore.create({ data: { tenantId: A.id, recordId: r2.id, studentId: st[2].id, values: [1, 1, 1] } }));

  const owner = { role: 'TEACHER', teacherId: a.teacher.id };
  const fill = (id, body, user = owner) => call(A.id, I.fillFromTask, { params: { id: String(id) }, body, user });
  const valuesOf = (detail) => Object.fromEntries(detail.students.map(s => [s.name, s.values]));

  await t.test('fill-from-task maps on time / late / missing / rejected', async () => {
    const r = await fill(r1.id, { taskId: task.id, criterionIndex: 1 });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.filled, 6); // 6 active students; the inactive one is skipped
    const v = valuesOf(r.body);
    assert.deepStrictEqual(v['ด.ช.หนึ่ง'], [2, 4, 2]); // only the chosen criterion changes
    assert.deepStrictEqual(v['ด.ญ.สอง'], [4, 4, 4]); // pending on time = full; other criteria keep default full
    assert.deepStrictEqual(v['ด.ช.สาม'], [4, 3, 4]); // late = max-1
    assert.deepStrictEqual(v['ด.ญ.สี่'], [4, 1, 4]); // rejected
    assert.deepStrictEqual(v['ด.ช.ห้า'], [4, 1, 4]); // not submitted
    assert.deepStrictEqual(v['ด.ญ.หก'], [4, 1, 4]); // no row
    assert.ok(!('ด.ช.เจ็ด' in v));
    const rows = await asBypass(base.assessmentScore.findMany({ where: { recordId: r1.id } }));
    assert.strictEqual(rows.length, 6); // existing row updated, not duplicated
  });

  await t.test('no deadline never counts as late; other criteria untouched', async () => {
    const r = await fill(r2.id, { taskId: noDl.id, criterionIndex: 0 });
    assert.strictEqual(r.status, 200);
    const v = valuesOf(r.body);
    assert.deepStrictEqual(v['ด.ช.สาม'], [4, 1, 1]); // stored [1,1,1], criterion 0 -> max (approved, no deadline)
    assert.deepStrictEqual(v['ด.ญ.สอง'], [1, 4, 4]); // invalid stored row -> full marks, criterion 0 -> 1
  });

  await t.test('errors: 404 record/task, 403, 400', async () => {
    assert.strictEqual((await fill(999999999, { taskId: task.id, criterionIndex: 0 })).status, 404);
    const crossTask = await fill(r1.id, { taskId: bTask.id, criterionIndex: 0 });
    assert.strictEqual(crossTask.status, 404);
    assert.strictEqual(crossTask.body.error, 'ไม่พบงาน');
    assert.strictEqual((await fill(r1.id, { taskId: 999999999, criterionIndex: 0 })).status, 404);
    assert.strictEqual((await fill(r1.id, { taskId: task.id, criterionIndex: 0 }, { role: 'TEACHER', teacherId: a.other.id })).status, 403);
    assert.strictEqual((await fill(r1.id, { taskId: task.id, criterionIndex: 0 }, { role: 'TEACHER', teacherId: a.other.id, canManage: true })).status, 200);
    assert.strictEqual((await fill(rNote.id, { taskId: task.id, criterionIndex: 0 })).status, 400);
    assert.strictEqual((await fill(r1.id, { taskId: task.id, criterionIndex: 3 })).status, 400);
    assert.strictEqual((await fill(r1.id, { taskId: task.id, criterionIndex: -1 })).status, 400);
    assert.strictEqual((await fill(r1.id, { taskId: task.id, criterionIndex: '1' })).status, 400);
    assert.strictEqual((await fill(r1.id, { criterionIndex: 0 })).status, 400);
    // another group cannot see the record at all
    assert.strictEqual((await call(B.id, I.fillFromTask, { params: { id: String(r1.id) }, body: { taskId: bTask.id, criterionIndex: 0 }, user: { role: 'ADMIN', teacherId: null } })).status, 404);
  });

  await t.test('summary shape, order and levels', async () => {
    // r1 was last filled by the manager call above (criterion 0 from the dated task); recompute expectations from the DB values
    const get = (query) => call(A.id, I.summary, { query, user: owner });
    assert.strictEqual((await get({})).status, 400);
    assert.strictEqual((await get({ classId: 'x' })).status, 400);
    const r = await get({ classId: String(a.cls.id) });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(r.body.records.map(x => x.id), [r1.id, r2.id]); // RUBRIC only, assessedOn asc
    assert.deepStrictEqual(r.body.records[0], { id: r1.id, name: 'ครั้งที่ 1', templateName: 'แบบทดสอบ', dateText: '', maxScore: 4, criteriaCount: 3, maxPoints: 12, responseType: 'SCORE', levels });
    assert.deepStrictEqual(r.body.students.map(s => s.studentNumber), [1, 2, 3, 4, 5, 6]);
    const by = Object.fromEntries(r.body.students.map(s => [s.name, s.results]));
    // r1 after the manager refill of criterion 0: st1 [4,4,2]=10/12 ดี ; st3 [4,3,4]=11 ดี ; st4 [4,1,4]=9 -> 0.75 ดี
    assert.deepStrictEqual(by['ด.ช.หนึ่ง'][r1.id], { total: 10, average: 3.33, level: 'ดี' });
    assert.deepStrictEqual(by['ด.ญ.สอง'][r1.id], { total: 12, average: 4, level: 'ดีมาก' });
    // r2: st2 invalid stored row -> full marks (after criterion 0 -> 1: 1+4+4=9 -> ดี); st3 [4,1,1]=6 -> 0.5 ปรับปรุง; st4 untouched row? none -> full from fill
    assert.deepStrictEqual(by['ด.ญ.สอง'][r2.id], { total: 9, average: 3, level: 'ดี' });
    assert.deepStrictEqual(by['ด.ช.สาม'][r2.id], { total: 6, average: 2, level: 'ปรับปรุง' });
    for (const s of r.body.students) assert.deepStrictEqual(Object.keys(s.results).sort(), [String(r1.id), String(r2.id)].sort());

    // missing rows -> full marks; subject filter
    const other = await rec({ subjectId: null, name: 'ไม่มีวิชา', assessedOn: new Date('2026-01-30') });
    const withSub = await get({ classId: String(a.cls.id), subjectId: String(a.subject.id) });
    assert.deepStrictEqual(withSub.body.records.map(x => x.id), [r1.id, r2.id]);
    const all = await get({ classId: String(a.cls.id) });
    assert.deepStrictEqual(all.body.records.map(x => x.id), [r1.id, r2.id, other.id]);
    assert.deepStrictEqual(all.body.students[5].results[other.id], { total: 12, average: 4, level: 'ดีมาก' });
    assert.strictEqual((await get({ classId: String(a.cls.id), subjectId: 'z' })).status, 400);
    // other group sees nothing of this class
    const fromB = await call(B.id, I.summary, { query: { classId: String(a.cls.id) } });
    assert.deepStrictEqual(fromB.body, { records: [], students: [] });
  });

  await t.test('fill-from-task for PASSFAIL / CHECK, 400 for TEXT / CLASS; summary skips TEXT', async () => {
    const mkRec = (over) => rec({ assessedOn: new Date('2026-02-01'), ...over });
    const pf = await mkRec({ name: 'ผ่าน/ไม่ผ่าน', responseType: 'PASSFAIL', maxScore: 2, levels: [] });
    const ck = await mkRec({ name: 'ติ๊ก', responseType: 'CHECK', maxScore: 1, levels: [] });
    const tx = await mkRec({ name: 'ข้อความ', responseType: 'TEXT', maxScore: 0, levels: [] });
    const cl = await asBypass(base.assessmentRecord.create({ data: {
      tenantId: A.id, templateId: noteTpl.id, classId: a.cls.id, teacherId: a.teacher.id, name: 'ห้อง', kind: 'CLASS', templateName: 'ห้อง' } }));

    let r = await fill(pf.id, { taskId: task.id, criterionIndex: 1 });
    assert.strictEqual(r.status, 200);
    let v = valuesOf(r.body);
    assert.deepStrictEqual(v['ด.ช.หนึ่ง'], [2, 2, 2]); // on time -> ผ่าน; others stay at the default ผ่าน
    assert.deepStrictEqual(v['ด.ช.สาม'], [2, 2, 2]); // late still counts as handed in
    assert.deepStrictEqual(v['ด.ญ.สี่'], [2, 1, 2]); // rejected -> ไม่ผ่าน
    assert.deepStrictEqual(v['ด.ช.ห้า'], [2, 1, 2]); // not submitted
    assert.deepStrictEqual(v['ด.ญ.หก'], [2, 1, 2]); // no row
    assert.strictEqual(r.body.responseType, 'PASSFAIL');

    r = await fill(ck.id, { taskId: task.id, criterionIndex: 0 });
    assert.strictEqual(r.status, 200);
    v = valuesOf(r.body);
    assert.deepStrictEqual(v['ด.ช.หนึ่ง'], [1, 1, 1]);
    assert.deepStrictEqual(v['ด.ช.สาม'], [1, 1, 1]); // late -> ✓
    assert.deepStrictEqual(v['ด.ญ.สอง'], [1, 1, 1]); // pending -> ✓
    assert.deepStrictEqual(v['ด.ญ.สี่'], [0, 1, 1]); // rejected -> blank
    assert.deepStrictEqual(v['ด.ช.ห้า'], [0, 1, 1]);
    assert.deepStrictEqual(v['ด.ญ.หก'], [0, 1, 1]);
    assert.strictEqual(r.body.students.find(s => s.name === 'ด.ญ.สี่').total, 2);

    r = await fill(tx.id, { taskId: task.id, criterionIndex: 0 });
    assert.strictEqual(r.status, 400);
    assert.strictEqual(r.body.error, 'แบบเขียนข้อความดึงจากการส่งงานไม่ได้');
    assert.strictEqual(await asBypass(base.assessmentScore.count({ where: { recordId: tx.id } })), 0);
    assert.strictEqual((await fill(cl.id, { taskId: task.id, criterionIndex: 0 })).status, 400);

    const sum = await call(A.id, I.summary, { query: { classId: String(a.cls.id) }, user: owner });
    const byId = Object.fromEntries(sum.body.records.map(x => [x.id, x]));
    assert.ok(byId[pf.id] && byId[ck.id], 'PASSFAIL and CHECK are summarised');
    assert.ok(!byId[tx.id], 'TEXT records are left out');
    assert.ok(!byId[cl.id], 'CLASS records are left out');
    assert.strictEqual(byId[pf.id].responseType, 'PASSFAIL'); assert.strictEqual(byId[ck.id].responseType, 'CHECK');
    assert.deepStrictEqual(byId[pf.id].levels, []); assert.strictEqual(byId[r1.id].levels.length, 4);
    assert.strictEqual(byId[pf.id].maxPoints, 3); assert.strictEqual(byId[ck.id].maxPoints, 3); assert.strictEqual(byId[r1.id].maxPoints, 12);
    const by = Object.fromEntries(sum.body.students.map(s => [s.name, s.results]));
    assert.deepStrictEqual(by['ด.ญ.สี่'][pf.id], { total: 2, average: 0.67, level: '' }); // 2 ผ่าน of 3, no levels
    assert.deepStrictEqual(by['ด.ช.หนึ่ง'][ck.id], { total: 3, average: 1, level: '' });
    assert.ok(!(tx.id in by['ด.ช.หนึ่ง']));
  });

  await t.test('PDPA export includes the lesson log tables', async () => {
    const r = await call(A.id, tenantData.exportData, { tenantId: A.id, user: { id: 1 } });
    assert.strictEqual(r.status, 200);
    const data = JSON.parse(r.body);
    assert.ok(Array.isArray(data.assessmentTemplate) && data.assessmentTemplate.length >= 2);
    assert.ok(data.assessmentRecord.some(x => x.id === r1.id));
    assert.ok(data.assessmentScore.length >= 3);
    assert.ok(data.assessmentRecord.every(x => x.tenantId === A.id));
    assert.ok(!r.body.includes(`ai B ${sfx}`) || r.body.includes(A.name));
    assert.ok(!data.assessmentRecord.some(x => x.tenantId === B.id));
  });
});
