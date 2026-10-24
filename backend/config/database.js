const { PrismaClient, Prisma } = require('@prisma/client');
const { getTenantId, isBypassed, getStore } = require('../services/tenantContext');

// Models that carry tenantId and are auto-scoped. Global: User, Tenant, Membership.
const TENANT_MODELS = new Set([
  'AcademicYear', 'Grade', 'Class', 'Student', 'Teacher', 'Subject', 'Task',
  'QRCode', 'Submission', 'AiConversation', 'AiMessage', 'Invite', 'AuditLog',
]);
// Former global unique field -> composite @@unique([tenantId, field]).
const COMPOSITE_UNIQUE = {
  AcademicYear: 'year', Grade: 'gradeName', Class: 'className', Student: 'studentCode',
  Teacher: 'teacherCode', Subject: 'subjectCode', QRCode: 'qrcodeData',
};

// relation field map from DMMF: { Model: { field: TargetModel } }
const RELATIONS = {};
for (const m of Prisma.dmmf.datamodel.models) {
  RELATIONS[m.name] = {};
  for (const f of m.fields) if (f.kind === 'object') RELATIONS[m.name][f.name] = f.type;
}

const WHERE_OPS = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany']);
const UNIQUE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete']);

// Add tenantId to a WhereUniqueInput, rewriting { studentCode } -> { tenantId_studentCode }.
function scopeUnique(model, where, tid) {
  const w = { ...(where || {}) };
  const f = COMPOSITE_UNIQUE[model];
  const key = f && `tenantId_${f}`;
  if (key && w[key]) {
    w[key] = { ...w[key], tenantId: tid };
  } else if (f && w[f] !== undefined && typeof w[f] !== 'object' && w.id === undefined) {
    w[key] = { tenantId: tid, [f]: w[f] };
    delete w[f];
  } else {
    w.tenantId = tid;
  }
  return w;
}

// Inject tenantId into nested create/connectOrCreate/upsert/connect for tenant relations.
function scopeData(model, data, tid) {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(d => scopeData(model, d, tid));
  const out = { ...data };
  const rels = RELATIONS[model] || {};
  if (TENANT_MODELS.has(model)) {
    // Checked input (uses relation fields) must connect the relation; unchecked takes the scalar.
    const checked = Object.keys(out).some(k => k in rels);
    delete out.tenantId; delete out.tenant;
    if (checked) out.tenant = { connect: { id: tid } }; else out.tenantId = tid;
  }
  for (const [field, target] of Object.entries(rels)) {
    const nested = out[field];
    if (!nested || typeof nested !== 'object' || !TENANT_MODELS.has(target)) continue;
    out[field] = scopeNested(target, nested, tid);
  }
  return out;
}

function scopeNested(target, nested, tid) {
  const n = { ...nested };
  const each = (v, fn) => (Array.isArray(v) ? v.map(fn) : fn(v));
  if (n.create) n.create = each(n.create, d => scopeData(target, d, tid));
  if (n.createMany && n.createMany.data) n.createMany = { ...n.createMany, data: each(n.createMany.data, d => scopeData(target, d, tid)) };
  if (n.connectOrCreate) n.connectOrCreate = each(n.connectOrCreate, c => ({ where: scopeUnique(target, c.where, tid), create: scopeData(target, c.create, tid) }));
  if (n.upsert) n.upsert = each(n.upsert, u => ({ ...u, where: u.where && scopeUnique(target, u.where, tid), create: scopeData(target, u.create, tid) }));
  if (n.connect) n.connect = each(n.connect, w => scopeUnique(target, w, tid));
  return n;
}

function scopeArgs(model, operation, args, tid) {
  const a = { ...(args || {}) };
  if (WHERE_OPS.has(operation)) a.where = { ...(a.where || {}), tenantId: tid };
  if (UNIQUE_OPS.has(operation)) a.where = scopeUnique(model, a.where, tid);
  if (operation === 'create') a.data = scopeData(model, a.data, tid);
  if (operation === 'createMany' || operation === 'createManyAndReturn') a.data = scopeData(model, a.data, tid);
  if (operation === 'update' || operation === 'updateMany') {
    a.data = { ...(a.data || {}) };
    delete a.data.tenantId; delete a.data.tenant; // tenant is immutable via the app client
    for (const [field, target] of Object.entries(RELATIONS[model] || {})) {
      if (a.data[field] && TENANT_MODELS.has(target) && typeof a.data[field] === 'object') a.data[field] = scopeNested(target, a.data[field], tid);
    }
  }
  if (operation === 'upsert') {
    a.where = scopeUnique(model, a.where, tid);
    a.create = scopeData(model, a.create, tid);
  }
  return a;
}

const base = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// DB-level RLS (prisma/rls.sql). Off unless RLS_ENABLED=1. Each tenant-model operation runs in a
// batch transaction whose first statement sets a transaction-local GUC (is_local=true), so pooled
// connections never carry a tenant across requests. Nested writes stay inside the same statement.
// NOTE: no interactive prisma.$transaction(async tx => ...) exists in controllers; if one is added,
// it must set the GUC itself (a batch tx cannot nest inside it).
const RLS_ENABLED = process.env.RLS_ENABLED === '1';
async function withRls(tid, op) {
  if (!RLS_ENABLED) return op;
  const guc = tid
    ? base.$executeRaw`SELECT set_config('app.tenant_id', ${tid}, true)`
    : base.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
  const [, result] = await base.$transaction([guc, op]);
  return result;
}

// Scalar foreign keys into tenant models: { Model: [[fkField, TargetModel]] }. Foreign keys are by id
// only (no tenantId in the constraint), so a write like task.create({ subjectId }) could point at
// another tenant's row and later leak it through include/select. checkRefs() rejects that.
const FKS = {};
for (const m of Prisma.dmmf.datamodel.models) {
  FKS[m.name] = m.fields
    .filter(f => f.kind === 'object' && TENANT_MODELS.has(f.type) && (f.relationFromFields || []).length === 1)
    .map(f => [f.relationFromFields[0], f.type]);
}
const WRITE_OPS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert']);

function collectRefs(model, data, acc) {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data)) { data.forEach(d => collectRefs(model, d, acc)); return; }
  for (const [fk, target] of FKS[model] || []) {
    let v = data[fk];
    if (v && typeof v === 'object' && 'set' in v) v = v.set;
    if (v !== undefined && v !== null) (acc[target] = acc[target] || new Set()).add(v);
  }
  for (const [field, target] of Object.entries(RELATIONS[model] || {})) {
    const n = data[field];
    if (!n || typeof n !== 'object' || !TENANT_MODELS.has(target)) continue;
    const each = (v, fn) => (Array.isArray(v) ? v.forEach(fn) : v && fn(v));
    collectRefs(target, n.create, acc);
    if (n.createMany) collectRefs(target, n.createMany.data, acc);
    each(n.connectOrCreate, c => collectRefs(target, c.create, acc));
    each(n.upsert, u => { collectRefs(target, u.create, acc); collectRefs(target, u.update, acc); });
    each(n.update, u => collectRefs(target, u.data || u, acc));
    each(n.updateMany, u => collectRefs(target, u.data, acc));
  }
}

const delegateOf = (model) => model[0].toLowerCase() + model.slice(1);
async function checkRefs(model, operation, args, tid) {
  if (!WRITE_OPS.has(operation) || !args) return;
  const acc = {};
  if (operation === 'upsert') { collectRefs(model, args.create, acc); collectRefs(model, args.update, acc); }
  else collectRefs(model, args.data, acc);
  const store = getStore();
  const seen = store ? (store.okRefs = store.okRefs || new Set()) : new Set(); // per-request cache
  for (const [target, set] of Object.entries(acc)) {
    const key = (id) => `${tid}:${target}:${id}`;
    const ids = [...set].filter(id => !seen.has(key(id)));
    if (!ids.length) continue;
    const bad = ids.some(id => !Number.isInteger(id));
    const n = bad ? -1 : await withRls(tid, base[delegateOf(target)].count({ where: { id: { in: ids }, tenantId: tid } }));
    if (n !== ids.length) {
      throw Object.assign(new Error(`Foreign key ${model} -> ${target} is not in this tenant`), { code: 'P2003', status: 400 });
    }
    ids.forEach(id => seen.add(key(id)));
  }
}

const prisma = base.$extends({
  name: 'tenant-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) {
          // Global models (User) can still reference tenant rows (User.teacherId/studentId).
          const t = !isBypassed() && getTenantId();
          if (t) await checkRefs(model, operation, args, t);
          return query(args);
        }
        if (isBypassed()) return withRls(null, query(args));
        const tid = getTenantId();
        if (!tid) {
          throw Object.assign(new Error(`Tenant context required for ${model}.${operation} (use withoutTenant() for platform code)`), { code: 'NO_TENANT', status: 401 });
        }
        await checkRefs(model, operation, args, tid);
        return withRls(tid, query(scopeArgs(model, operation, args, tid)));
      },
    },
  },
});

module.exports = prisma;
module.exports.basePrisma = base; // unscoped; only for scripts/migrations
module.exports.TENANT_MODELS = TENANT_MODELS;
module.exports.scopeArgs = scopeArgs;
module.exports.RLS_ENABLED = RLS_ENABLED;
