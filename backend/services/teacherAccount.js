// Per-group access for a logged-in account.
// - accessFor(): effective role inside the current group (tenant) from the global User.role
//   plus the Membership role, so permissions follow the group, not the account.
// - ensureTeacherFor(): every staff member of a group gets exactly one Teacher row there,
//   linked by Teacher.userId (User.teacherId is the legacy single-school link and can only
//   point at one group). Created on first use, idempotent.
const prisma = require('../config/database');
const { runWithTenant } = require('./tenantContext');

const MANAGER_ROLES = new Set(['OWNER', 'ADMIN']);

// globalRole: User.role · trole: Membership.role in the current group (null = no group).
// - canManage: group OWNER/ADMIN may set up the group (years, grades, classes, students,
//   subjects, import) even when their account is a plain TEACHER.
// - Global ADMIN (legacy school admin, school owners) stays ADMIN only where they manage;
//   as a TEACHER member of someone else's group they are a teacher there.
function accessFor(globalRole, trole) {
  if (globalRole === 'STUDENT' || trole === 'STUDENT') return { role: 'STUDENT', canManage: false };
  const canManage = MANAGER_ROLES.has(trole);
  const role = globalRole === 'ADMIN' && (canManage || !trole) ? 'ADMIN' : 'TEACHER';
  return { role, canManage };
}

const teacherNameOf = (user) =>
  String(user.displayName || (user.email || '').split('@')[0] || 'ครู').trim().slice(0, 100) || 'ครู';

const isUniqueErr = (e) => e && e.code === 'P2002';
const inflight = new Map(); // `${tenantId}:${userId}` -> Promise (dedupe concurrent first requests)

async function findOrCreate(user, tenantId) {
  const own = await prisma.teacher.findFirst({ where: { userId: user.id }, orderBy: { id: 'asc' } });
  if (own) return own;
  // Legacy link (User.teacherId) into this same group: adopt it instead of creating a duplicate.
  if (user.teacherId) {
    const legacy = await prisma.teacher.findFirst({ where: { id: user.teacherId } });
    if (legacy) return prisma.teacher.update({ where: { id: legacy.id }, data: { userId: user.id } });
  }
  // Deterministic code: a racing second create hits @@unique([tenantId, teacherCode]) and re-reads.
  const base = `T${user.id}`;
  for (let i = 0; i < 5; i++) {
    const teacherCode = i === 0 ? base : `${base}-${i + 1}`;
    try {
      return await prisma.teacher.create({
        data: { teacherCode, name: teacherNameOf(user), email: user.email || null, userId: user.id },
      });
    } catch (e) {
      if (!isUniqueErr(e)) throw e;
      const raced = await prisma.teacher.findFirst({ where: { userId: user.id }, orderBy: { id: 'asc' } });
      if (raced) return raced;
    }
  }
  throw new Error('ensureTeacherFor: could not allocate a teacher code');
}

// Teacher row for `user` in group `tenantId` (runs scoped to that tenant so RLS/extension apply).
function ensureTeacherFor(user, tenantId) {
  if (!user || !user.id || !tenantId) return Promise.resolve(null);
  const key = `${tenantId}:${user.id}`;
  if (inflight.has(key)) return inflight.get(key);
  const p = runWithTenant(tenantId, () => findOrCreate(user, tenantId)).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

module.exports = { accessFor, ensureTeacherFor, teacherNameOf, MANAGER_ROLES };
