// Usage metering without schema change: AI calls are AuditLog rows with action 'ai.call'.
const prisma = require('../config/database');
const { getPlan } = require('../config/plans');

const AI_ACTION = 'ai.call';

function monthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const aiCallsThisMonth = (tenantId) =>
  prisma.auditLog.count({ where: { tenantId, action: AI_ACTION, createdAt: { gte: monthStart() } } });

const recordAiCall = (tenantId, userId, target) =>
  prisma.auditLog.create({ data: { tenantId, userId: userId || null, action: AI_ACTION, target: target || null } });

const studentCount = (tenantId) => prisma.student.count({ where: { tenantId } });

// Plan, limits and current usage for a tenant (null if tenant is missing).
async function getUsageSummary(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;
  const plan = getPlan(tenant.plan);
  const [ai, students] = await Promise.all([aiCallsThisMonth(tenantId), studentCount(tenantId)]);
  return {
    plan: { id: plan.id, name: plan.name, priceTHB: plan.priceTHB },
    limits: plan.limits,
    aiEnabled: tenant.aiEnabled,
    usage: { aiCalls: ai, students }
  };
}

// Returns { ok: true } or { ok: false, status, error }. Does not record.
async function checkAiQuota(tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: false, status: 403, error: 'ไม่พบกลุ่มของบัญชีนี้' };
  if (!tenant.aiEnabled) return { ok: false, status: 429, error: 'กลุ่มนี้ปิดการใช้ผู้ช่วย AI อยู่ กรุณาติดต่อผู้ดูแลระบบ' };
  const limit = getPlan(tenant.plan).limits.aiPerMonth;
  if (limit != null) {
    const used = await aiCallsThisMonth(tenantId);
    if (used >= limit) {
      return { ok: false, status: 429, error: `ใช้ผู้ช่วย AI ครบโควตาเดือนนี้แล้ว (${used}/${limit} ครั้ง) โควตาจะรีเซ็ตต้นเดือนหน้า หรืออัปเกรดแพ็กเกจ` };
    }
  }
  return { ok: true };
}

// Check student cap before adding `adding` students. Same result shape as checkAiQuota.
async function checkStudentQuota(tenantId, adding = 1) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return { ok: true };
  const limit = getPlan(tenant.plan).limits.students;
  if (limit == null) return { ok: true };
  const n = await studentCount(tenantId);
  if (n + adding > limit) {
    return { ok: false, status: 402, error: `จำนวนนักเรียนเต็มโควตาของแพ็กเกจ (${n}/${limit} คน) กรุณาอัปเกรดแพ็กเกจ` };
  }
  return { ok: true };
}

module.exports = { AI_ACTION, monthStart, aiCallsThisMonth, recordAiCall, studentCount, getUsageSummary, checkAiQuota, checkStudentQuota };
