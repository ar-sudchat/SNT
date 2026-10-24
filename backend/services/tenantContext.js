// Per-request tenant context (AsyncLocalStorage).
// Store shape: { tenantId: string|null, bypass: boolean }
const { AsyncLocalStorage } = require('node:async_hooks');

const als = new AsyncLocalStorage();

const getStore = () => als.getStore();
const getTenantId = () => { const s = als.getStore(); return (s && s.tenantId) || null; };
const isBypassed = () => { const s = als.getStore(); return !!(s && s.bypass); };

function requireTenantId() {
  const tid = getTenantId();
  if (!tid) throw Object.assign(new Error('No tenant in context'), { code: 'NO_TENANT', status: 401 });
  return tid;
}

// Run fn (sync or async) scoped to a tenant.
const runWithTenant = (tenantId, fn) => als.run({ tenantId, bypass: false }, fn);

// Escape hatch for auth / platform / cross-tenant code. Tenant filters are NOT applied inside.
const withoutTenant = (fn) => als.run({ tenantId: getTenantId(), bypass: true }, fn);

// Open a mutable scope for the rest of a request; setTenantId() fills it later (after auth).
const enterScope = (fn) => als.run({ tenantId: null, bypass: false }, fn);
function setTenantId(tenantId) {
  const s = als.getStore();
  if (!s) return false;
  s.tenantId = tenantId || null;
  return true;
}

module.exports = { als, getStore, getTenantId, requireTenantId, isBypassed, runWithTenant, withoutTenant, enterScope, setTenantId };
