const test = require('node:test');
const assert = require('node:assert');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
const gradeC = require('../controllers/gradeController');
const classC = require('../controllers/classController');
// Fixture writes on RLS tables must set app.bypass_rls (works under a non-superuser role too).
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

// Call a controller with a fake req/res inside the tenant context.
const call = (tid, fn, body) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, status(s) { this.statusCode = s; return this; }, json(b) { resolve({ status: this.statusCode, body: b }); } };
  runWithTenant(tid, () => fn({ body, params: {}, query: {}, headers: {} }, res).catch(reject));
});

test('bulk grades & classes: create, skip rules, default year, delete blocked rows, cross-group', async (t) => {
  const sfx = Date.now();
  const mk = (n) => base.tenant.create({ data: { slug: `bulk-${n}-${sfx}`, name: `กลุ่มบัลค์${n}${sfx}` } });
  const A = await mk('a'), B = await mk('b');
  const tids = [A.id, B.id];
  t.after(async () => {
    const w = { where: { tenantId: { in: tids } } };
    await asBypass(base.student.deleteMany(w));
    await asBypass(base.class.deleteMany(w));
    await asBypass(base.subject.deleteMany(w));
    await asBypass(base.grade.deleteMany(w));
    await asBypass(base.teacher.deleteMany(w));
    await asBypass(base.academicYear.deleteMany(w));
    await base.tenant.deleteMany({ where: { id: { in: tids } } });
    await base.$disconnect();
  });

  const yearA = await asBypass(base.academicYear.create({ data: { tenantId: A.id, year: '2569', isCurrent: true } }));
  const oldYear = await asBypass(base.academicYear.create({ data: { tenantId: A.id, year: '2568', isCurrent: false } }));
  const teacherA = await asBypass(base.teacher.create({ data: { tenantId: A.id, teacherCode: `TA${sfx}`, name: 'ครูเอ' } }));
  const teacherB = await asBypass(base.teacher.create({ data: { tenantId: B.id, teacherCode: `TB${sfx}`, name: 'ครูบี' } }));
  const gradeB = await asBypass(base.grade.create({ data: { tenantId: B.id, gradeName: 'ป.1' } }));
  const classB = await asBypass(base.class.create({ data: { tenantId: B.id, className: 'ป.1/1', gradeId: gradeB.id } }));
  await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: 'ม.1' } }));

  // ---- grades bulk create
  let r = await call(A.id, gradeC.bulkCreate, { items: [] });
  assert.strictEqual(r.status, 400);
  r = await call(A.id, gradeC.bulkCreate, { items: Array.from({ length: 101 }, (_, i) => ({ gradeName: `x${i}` })) });
  assert.strictEqual(r.status, 400);
  r = await call(A.id, gradeC.bulkCreate, {});
  assert.strictEqual(r.status, 400);

  r = await call(A.id, gradeC.bulkCreate, { items: [
    { gradeName: ' ป.1 ', description: 'ประถม' }, { gradeName: 'ป.2' }, { gradeName: 'ป.1' },
    { gradeName: '   ' }, { gradeName: 'ม.1' }, { description: 'no name' }, { gradeName: 'ป.3' },
  ] });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.created.map(g => g.gradeName), ['ป.1', 'ป.2', 'ป.3']);
  assert.strictEqual(r.body.created[0].description, 'ประถม');
  assert.ok(r.body.created.every(g => g.tenantId === A.id));
  assert.deepStrictEqual(r.body.skipped.map(s => [s.gradeName, s.reason]), [
    ['ป.1', 'ซ้ำในรายการ'], ['', 'ไม่มีชื่อระดับชั้น'], ['ม.1', 'มีอยู่แล้ว'], ['', 'ไม่มีชื่อระดับชั้น']]);
  // B's own "ป.1" does not collide with A's (composite unique)
  assert.strictEqual(await asBypass(base.grade.count({ where: { gradeName: 'ป.1' , tenantId: { in: tids } } })), 2);
  const [gP1, gP2, gP3] = r.body.created;

  // ---- classes bulk create
  r = await call(A.id, classC.bulkCreate, { items: [] });
  assert.strictEqual(r.status, 400);
  r = await call(A.id, classC.bulkCreate, { items: Array.from({ length: 201 }, (_, i) => ({ className: `c${i}`, gradeId: gP1.id })) });
  assert.strictEqual(r.status, 400);

  r = await call(A.id, classC.bulkCreate, { items: [
    { className: ' ป.1/1 ', gradeId: gP1.id },                                        // default year
    { className: 'ป.1/2', gradeId: gP1.id, academicYearId: oldYear.id, teacherId: teacherA.id, capacity: 30 },
    { className: 'ป.1/1', gradeId: gP1.id },                                          // dup in request
    { className: 'ป.1/3', gradeId: 999999999 },                                       // no grade
    { className: 'ป.1/4', gradeId: gradeB.id },                                       // other group's grade
    { className: 'ป.1/5', gradeId: gP1.id, teacherId: teacherB.id },                  // other group's teacher
    { className: 'ป.1/6', gradeId: gP1.id, academicYearId: 999999999 },               // bad year
    { className: '', gradeId: gP1.id },
    { className: 'ป.1/7', gradeId: gP1.id, capacity: 0 },
    { className: 'ป.2/1', gradeId: gP2.id },
  ] });
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.created.map(c => c.className), ['ป.1/1', 'ป.1/2', 'ป.2/1']);
  const [c11, c12, c21] = r.body.created;
  assert.strictEqual(c11.academicYearId, yearA.id);          // defaulted to current year
  assert.strictEqual(c21.academicYearId, yearA.id);
  assert.strictEqual(c11.capacity, 40);
  assert.strictEqual(c12.academicYearId, oldYear.id);
  assert.strictEqual(c12.teacherId, teacherA.id);
  assert.strictEqual(c12.capacity, 30);
  assert.strictEqual(c11.grade.gradeName, 'ป.1');
  assert.deepStrictEqual(r.body.skipped.map(s => [s.className, s.reason]), [
    ['ป.1/1', 'ซ้ำในรายการ'], ['ป.1/3', 'ไม่พบชั้นปี'], ['ป.1/4', 'ไม่พบชั้นปี'], ['ป.1/5', 'ไม่พบครู'],
    ['ป.1/6', 'ไม่พบปีการศึกษา'], ['', 'ไม่มีชื่อห้องเรียน'], ['ป.1/7', 'ความจุไม่ถูกต้อง']]);

  // existing class name is skipped on a second run
  r = await call(A.id, classC.bulkCreate, { items: [{ className: 'ป.1/1', gradeId: gP1.id }, { className: 'ป.2/2', gradeId: gP2.id }] });
  assert.deepStrictEqual(r.body.created.map(c => c.className), ['ป.2/2']);
  assert.deepStrictEqual(r.body.skipped, [{ className: 'ป.1/1', reason: 'มีอยู่แล้ว' }]);
  const c22 = r.body.created[0];

  // without a current year the class is created with no year
  await asBypass(base.academicYear.update({ where: { id: yearA.id }, data: { isCurrent: false } }));
  r = await call(A.id, classC.bulkCreate, { items: [{ className: 'ป.3/1', gradeId: gP3.id }] });
  assert.strictEqual(r.body.created[0].academicYearId, null);
  const c31 = r.body.created[0];

  // ---- classes bulk delete
  const student = await asBypass(base.student.create({ data: { tenantId: A.id, studentCode: `S${sfx}`, name: 'นักเรียน', classId: c11.id } }));
  assert.strictEqual((await call(A.id, classC.bulkDelete, { ids: [] })).status, 400);
  assert.strictEqual((await call(A.id, classC.bulkDelete, { ids: ['1'] })).status, 400);
  assert.strictEqual((await call(A.id, classC.bulkDelete, { ids: Array.from({ length: 501 }, (_, i) => i + 1) })).status, 400);

  r = await call(A.id, classC.bulkDelete, { ids: [c11.id, c12.id, c11.id, classB.id, 999999999] });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.deleted, 1);                       // c12 only (c11 listed twice counted once)
  assert.deepStrictEqual(r.body.failed, [
    { id: c11.id, name: 'ป.1/1', reason: 'ยังมีนักเรียนอยู่ในห้องนี้' },
    { id: classB.id, name: null, reason: 'ไม่พบ' },
    { id: 999999999, name: null, reason: 'ไม่พบ' }]);
  assert.strictEqual(await asBypass(base.class.count({ where: { id: c12.id } })), 0);
  assert.strictEqual(await asBypass(base.class.count({ where: { id: { in: [c11.id, classB.id] } } })), 2);

  // ---- grades bulk delete: gP1 has class ป.1/1, gP2 has classes, gP3 has class ป.3/1; make gP3 free + a subject block
  const gFree = await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: 'ว่าง' } }));
  const gSubj = await asBypass(base.grade.create({ data: { tenantId: A.id, gradeName: 'มีวิชา' } }));
  await asBypass(base.subject.create({ data: { tenantId: A.id, subjectCode: `J${sfx}`, subjectName: 'วิชา', gradeId: gSubj.id, teacherId: teacherA.id } }));
  assert.strictEqual((await call(A.id, gradeC.bulkDelete, { ids: [] })).status, 400);
  r = await call(A.id, gradeC.bulkDelete, { ids: [gFree.id, gP1.id, gSubj.id, gradeB.id, 999999999] });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.deleted, 1);
  assert.deepStrictEqual(r.body.failed, [
    { id: gP1.id, name: 'ป.1', reason: 'ยังมีห้องเรียนหรือวิชาในชั้นนี้' },
    { id: gSubj.id, name: 'มีวิชา', reason: 'ยังมีห้องเรียนหรือวิชาในชั้นนี้' },
    { id: gradeB.id, name: null, reason: 'ไม่พบ' },
    { id: 999999999, name: null, reason: 'ไม่พบ' }]);
  assert.strictEqual(await asBypass(base.grade.count({ where: { id: gFree.id } })), 0);
  assert.strictEqual(await asBypass(base.grade.count({ where: { id: gradeB.id } })), 1);

  // after removing the blockers everything goes
  await asBypass(base.student.delete({ where: { id: student.id } }));
  r = await call(A.id, classC.bulkDelete, { ids: [c11.id, c21.id, c22.id, c31.id] });
  assert.deepStrictEqual([r.body.deleted, r.body.failed], [4, []]);
  r = await call(A.id, gradeC.bulkDelete, { ids: [gP1.id, gP2.id, gP3.id] });
  assert.deepStrictEqual([r.body.deleted, r.body.failed], [3, []]);
  assert.strictEqual(await asBypass(base.class.count({ where: { tenantId: B.id } })), 1); // B untouched
});
