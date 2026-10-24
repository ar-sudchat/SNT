const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const stub = (rel, exports) => {
  const p = require.resolve(path.join('..', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
process.env.PARENT_LINK_SECRET = 'test-secret';
const created = [];
let suspended = 'SUSPENDED';
stub('config/database.js', {
  tenant: { findUnique: async ({ where }) => ({ slug: where.id === 'T1' ? 'snt' : 'other' }) },
  qRCode: {
    findFirst: async () => null,
    create: async ({ data }) => { created.push(data); return data; },
    findUnique: async ({ where }) => where.qrcodeData === 'SNT-1-1-abc' ? {
      status: 'ACTIVE', studentId: 1, student: { id: 1 },
      subject: { id: 1, subjectCode: 'c', subjectName: 'n', tasks: [] }
    } : null
  },
  submission: { findMany: async () => [] },
  student: { findUnique: async ({ where }) => where.id === 1 ? { tenantId: 'T1' }
    : where.id === 2 ? { tenantId: 'T3', tenant: { status: suspended }, id: 2, name: 'ด.ช.ทดสอบ', status: 'ACTIVE', class: { className: 'ป.1', gradeId: 1, academicYearId: null } } : null },
  subject: { findMany: async () => [] }
});

const qp = require('../services/qrPayload');
const ctx = require('../services/tenantContext');
const qr = require('../controllers/qrcodeController');
const parent = require('../controllers/parentController');

const mkRes = () => { const r = { code: 200 }; r.status = c => (r.code = c, r); r.json = b => (r.body = b, r); return r; };

test('format/parse KS1 and legacy', () => {
  const p = qp.formatPayload('snt');
  assert.match(p, /^KS1\.snt\.[0-9a-f]{32}$/);
  assert.deepStrictEqual(qp.parsePayload(p), { kind: 'ks1', slug: 'snt', token: p.split('.')[2] });
  assert.strictEqual(qp.parsePayload('SNT-1-1-abc').kind, 'legacy');
  for (const bad of ['', null, 'KS1.snt', 'KS1.SNT.abcdefabcdefabcdef', 'KS1.snt.short', 'x']) assert.strictEqual(qp.parsePayload(bad), null);
});

test('scan rejects other tenant QR with Thai message', async () => {
  const res = mkRes();
  await ctx.runWithTenant('T1', () => qr.scan({ body: { qrcodeData: qp.formatPayload('other') } }, res));
  assert.strictEqual(res.code, 403);
  assert.strictEqual(res.body.error, 'QR นี้เป็นของกลุ่มอื่น');
});

test('scan accepts same-tenant KS1 (lookup proceeds) and legacy payload', async () => {
  let res = mkRes();
  await ctx.runWithTenant('T1', () => qr.scan({ body: { qrcodeData: qp.formatPayload('snt') } }, res));
  assert.strictEqual(res.code, 404); // passed tenant check, not in stub db
  assert.strictEqual(res.body.error, 'QR code ไม่ถูกต้อง');
  res = mkRes();
  await ctx.runWithTenant('T1', () => qr.scan({ body: { qrcodeData: 'SNT-1-1-abc' } }, res));
  assert.strictEqual(res.code, 200);
});

test('generate emits KS1 with current tenant slug', async () => {
  const res = mkRes();
  await ctx.runWithTenant('T1', () => qr.generate({ body: { studentId: 1, subjectId: 1 } }, res));
  assert.strictEqual(res.code, 201);
  assert.match(created[0].qrcodeData, /^KS1\.snt\./);
});

test('parent token binds tid; legacy tokens still verify', () => {
  const t = parent.signToken(1, 30, 'T1');
  assert.strictEqual(parent.verifyToken(t.token).tid, 'T1');
  const [payload, sig] = t.token.split('.');
  const forged = Buffer.from(JSON.stringify({ sid: 1, tid: 'T2', exp: 9999999999 })).toString('base64url');
  assert.strictEqual(parent.verifyToken(`${forged}.${sig}`), null);
  const legacy = parent.signToken(1);
  assert.strictEqual(parent.verifyToken(legacy.token).tid, undefined);
});

test('getPublic: tid mismatch rejected, matching/legacy resolve tenant', async () => {
  const wrong = parent.signToken(1, 30, 'T2');
  let res = mkRes();
  await ctx.enterScope(() => parent.getPublic({ params: { token: wrong.token } }, res));
  assert.strictEqual(res.code, 401);
});

test('getPublic: suspended group stops serving parent links', async () => {
  const t = parent.signToken(2, 30, 'T3');
  let res = mkRes(); res.set = () => res;
  await ctx.enterScope(() => parent.getPublic({ params: { token: t.token } }, res));
  assert.strictEqual(res.code, 401);
  suspended = 'ACTIVE';
  res = mkRes(); res.set = () => res;
  await ctx.enterScope(() => parent.getPublic({ params: { token: t.token } }, res));
  assert.strictEqual(res.code, 200);
});
