// Append-only audit trail. log() never throws (auditing must not break the request).
const prisma = require('../config/database');
const { getTenantId } = require('./tenantContext');

// log(action, target, meta, req) — tenant + actor come from req (or the tenant context).
async function log(action, target, meta, req) {
  try {
    const tenantId = (req && req.tenantId) || getTenantId();
    if (!tenantId) return null;
    const m = { ...(meta || {}) };
    if (req && (req.ip || req.headers)) m.ip = req.ip || null;
    return await prisma.basePrisma.auditLog.create({
      data: {
        tenantId,
        userId: (req && req.user && req.user.id) || null,
        action: String(action).slice(0, 80),
        target: target == null ? null : String(target).slice(0, 200),
        meta: m
      }
    });
  } catch (e) {
    console.error('audit.log failed:', e.message);
    return null;
  }
}

module.exports = { log };
