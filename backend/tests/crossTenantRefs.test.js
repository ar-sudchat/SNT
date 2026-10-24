// Foreign keys are by id only, so a write in tenant A must not reference tenant B rows
// (e.g. task.create({ subjectId: <B subject> }) then include: { subject } leaks B). Local DB only.
const test = require('node:test');
const assert = require('node:assert');
const prisma = require('../config/database');
const base = prisma.basePrisma;
const { runWithTenant } = require('../services/tenantContext');
const asBypass = (q) => base.$transaction([base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`, q]).then(r => r[1]);

test('tenant extension rejects cross-tenant foreign keys', async (t) => {
  try { await base.$queryRaw`SELECT 1`; } catch { return t.skip('local DB unreachable'); }
  const sfx = Date.now().toString(36);
  const A = await base.tenant.create({ data: { slug: `fk-a-${sfx}`, name: `fkA${sfx}` } });
  const B = await base.tenant.create({ data: { slug: `fk-b-${sfx}`, name: `fkB${sfx}` } });
  const mk = async (tid, n) => {
    const teacher = await asBypass(base.teacher.create({ data: { tenantId: tid, teacherCode: `T${n}${sfx}`, name: `ครู${n}` } }));
    const grade = await asBypass(base.grade.create({ data: { tenantId: tid, gradeName: `G${n}${sfx}` } }));
    const cls = await asBypass(base.class.create({ data: { tenantId: tid, className: `C${n}${sfx}`, gradeId: grade.id } }));
    const student = await asBypass(base.student.create({ data: { tenantId: tid, studentCode: `S${n}${sfx}`, name: `ลับ${n}`, classId: cls.id } }));
    const subject = await asBypass(base.subject.create({ data: { tenantId: tid, subjectCode: `J${n}${sfx}`, subjectName: `วิชา${n}`, teacherId: teacher.id } }));
    return { teacher, grade, cls, student, subject };
  };
  const a = await mk(A.id, 'a'), b = await mk(B.id, 'b');
  const ids = [A.id, B.id];
  t.after(async () => {
    const w = { where: { tenantId: { in: ids } } };
    for (const m of ['submission', 'qRCode', 'task', 'subject', 'student', 'class', 'grade', 'teacher']) await asBypass(base[m].deleteMany(w));
    await base.user.deleteMany({ where: { email: { endsWith: `${sfx}@fk.test` } } });
    await base.tenant.deleteMany({ where: { id: { in: ids } } });
    await base.$disconnect();
  });
  const inA = (fn) => runWithTenant(A.id, async () => await fn()); // PrismaPromise is lazy: await inside the scope
  const isFk = (e) => e.code === 'P2003' && e.status === 400;

  // own refs still work
  const task = await inA(() => prisma.task.create({ data: { subjectId: a.subject.id, taskName: 'ok', taskNumber: 1, createdById: a.teacher.id } }));
  assert.strictEqual(task.tenantId, A.id);

  await assert.rejects(inA(() => prisma.task.create({
    data: { subjectId: b.subject.id, taskName: 'x', taskNumber: 2, createdById: a.teacher.id }, include: { subject: true } })), isFk);
  await assert.rejects(inA(() => prisma.qRCode.create({
    data: { studentId: b.student.id, subjectId: a.subject.id, qrcodeData: `q-${sfx}` }, include: { student: { include: { class: true } } } })), isFk);
  await assert.rejects(inA(() => prisma.submission.create({
    data: { studentId: b.student.id, taskId: task.id, status: 'APPROVED' }, include: { student: true } })), isFk);
  await assert.rejects(inA(() => prisma.student.updateMany({ where: { id: a.student.id }, data: { classId: b.cls.id } })), isFk);
  await assert.rejects(inA(() => prisma.class.update({ where: { id: a.cls.id }, data: { teacherId: b.teacher.id } })), isFk);
  // nested create inside a tenant write
  await assert.rejects(inA(() => prisma.task.update({ where: { id: task.id },
    data: { submissions: { create: [{ studentId: b.student.id, status: 'PENDING' }] } } })), isFk);
  // global User row linking to another tenant's student/teacher (auth register path)
  await assert.rejects(inA(() => prisma.user.create({ data: { email: `u${sfx}@fk.test`, password: 'x', role: 'STUDENT', studentId: b.student.id } })), isFk);

  const leaked = await asBypass(base.task.count({ where: { tenantId: A.id, subjectId: b.subject.id } }));
  assert.strictEqual(leaked, 0);
  assert.strictEqual((await asBypass(base.student.findUnique({ where: { id: a.student.id } }))).classId, a.cls.id);
});
