const usage = require('../services/usage');

// Guard + meter for AI endpoints. Call before the provider. Returns true if allowed;
// otherwise it has already sent the response. Requests without a tenant (legacy/stub) pass through.
async function enforceAiQuota(req, res) {
  const tid = req.tenantId;
  if (!tid) return true;
  const r = await usage.checkAiQuota(tid);
  if (!r.ok) { res.status(r.status).json({ error: r.error }); return false; }
  try { await usage.recordAiCall(tid, req.user && req.user.id, req.route && req.route.path); }
  catch (e) { console.error('usage record failed:', e && e.message); }
  return true;
}

async function enforceStudentQuota(req, res, adding = 1) {
  const tid = req.tenantId;
  if (!tid) return true;
  const r = await usage.checkStudentQuota(tid, adding);
  if (!r.ok) { res.status(r.status).json({ error: r.error }); return false; }
  return true;
}

module.exports = { enforceAiQuota, enforceStudentQuota };
