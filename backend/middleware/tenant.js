// Tenant middleware. tenantId always comes from the verified JWT (`tid`), never a header.
const ctx = require('../services/tenantContext');

// Global (server.js): opens a per-request context that authenticate() fills.
const tenantScope = (req, res, next) => ctx.enterScope(next);

// Called by authenticate() after the token is verified.
function bindTenant(req) {
  const tid = (req.user && req.user.tid) || null;
  req.tenantId = tid;
  if (!ctx.setTenantId(tid)) return false; // no scope opened
  return !!tid;
}

// Re-enter the request's tenant (use after middleware that loses async context, e.g. multer).
const restoreTenant = (req, res, next) =>
  req.tenantId ? ctx.runWithTenant(req.tenantId, next) : next();

// Guard: route requires a tenant.
const requireTenant = (req, res, next) =>
  req.tenantId ? next() : res.status(403).json({ error: 'ไม่พบกลุ่มของบัญชีนี้' });

module.exports = { tenantScope, bindTenant, restoreTenant, requireTenant };
