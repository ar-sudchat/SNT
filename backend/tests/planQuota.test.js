const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
const logs = [];
const state = { tenant: { id: 't1', plan: 'free', aiEnabled: true }, students: 10 };
stub('config/database.js', {
  tenant: { findUnique: async () => state.tenant },
  student: { count: async () => state.students },
  auditLog: {
    count: async ({ where }) => logs.filter(l => l.tenantId === where.tenantId && l.action === where.action && l.createdAt >= where.createdAt.gte).length,
    create: async ({ data }) => { logs.push({ ...data, createdAt: new Date() }); return data; }
  }
});
const { enforceAiQuota, enforceStudentQuota } = require('../middleware/planLimit');
const { getPlan, PLANS } = require('../config/plans');
const { monthStart } = require('../services/usage');

const mkRes = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const req = { tenantId: 't1', user: { id: 1 }, route: { path: '/ask' } };

test('plans: unknown falls back to free', () => {
  assert.equal(getPlan('nope').id, 'free');
  assert.equal(PLANS.free.limits.aiPerMonth, 50);
});

test('no tenant passes through', async () => {
  const res = mkRes();
  assert.equal(await enforceAiQuota({ user: { id: 1 } }, res), true);
});

test('AI quota allows up to limit then 429', async () => {
  logs.length = 0;
  for (let i = 0; i < 50; i++) assert.equal(await enforceAiQuota(req, mkRes()), true);
  assert.equal(logs.length, 50);
  const res = mkRes();
  assert.equal(await enforceAiQuota(req, res), false);
  assert.equal(res.code, 429);
  assert.match(res.body.error, /โควตา/);
  assert.equal(logs.length, 50);
});

test('last month usage does not count', async () => {
  logs.length = 0;
  const old = new Date(monthStart().getTime() - 86400000);
  for (let i = 0; i < 50; i++) logs.push({ tenantId: 't1', action: 'ai.call', createdAt: old });
  assert.equal(await enforceAiQuota(req, mkRes()), true);
});

test('aiEnabled false -> 429', async () => {
  state.tenant = { id: 't1', plan: 'free', aiEnabled: false };
  const res = mkRes();
  assert.equal(await enforceAiQuota(req, res), false);
  assert.equal(res.code, 429);
  state.tenant = { id: 't1', plan: 'free', aiEnabled: true };
});

test('pro plan has higher quota', async () => {
  logs.length = 0; state.tenant = { id: 't1', plan: 'pro', aiEnabled: true };
  for (let i = 0; i < 60; i++) logs.push({ tenantId: 't1', action: 'ai.call', createdAt: new Date() });
  assert.equal(await enforceAiQuota(req, mkRes()), true);
  state.tenant = { id: 't1', plan: 'free', aiEnabled: true };
});

test('student quota 402 when over free cap', async () => {
  state.students = 60;
  const res = mkRes();
  assert.equal(await enforceStudentQuota(req, res, 1), false);
  assert.equal(res.code, 402);
  state.students = 10;
  assert.equal(await enforceStudentQuota(req, mkRes(), 1), true);
});
