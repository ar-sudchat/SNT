// PDPA per-school data controls. OWNER-only (see requireOwner).
const prisma = require('../config/database');
const audit = require('../services/audit');

const DELETE_GRACE_DAYS = 30;
// Tenant-scoped models exported (scoped client adds tenantId filter automatically).
const EXPORT_MODELS = ['academicYear', 'grade', 'class', 'student', 'teacher', 'subject', 'task',
  'qRCode', 'submission', 'aiConversation', 'aiMessage', 'invite', 'auditLog'];
const SECRET_KEY = /pass(word)?$|^pin$|secret|token$/i;

const strip = (v) => JSON.parse(JSON.stringify(v, (k, val) => (k && SECRET_KEY.test(k) && k !== 'qrcodeData' ? undefined : val)));

async function requireOwner(req, res, next) {
  try {
    if (!req.user || !req.tenantId) return res.status(403).json({ error: 'เฉพาะเจ้าของกลุ่ม' });
    const m = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: req.user.id, tenantId: req.tenantId } },
      select: { role: true }
    });
    if (!m || m.role !== 'OWNER') return res.status(403).json({ error: 'เฉพาะเจ้าของกลุ่ม' });
    next();
  } catch (e) { next(e); }
}

// Latest pending-delete info (deleteAfter lives in AuditLog meta; no schema column).
async function pendingInfo(tenant) {
  if (tenant.status !== 'PENDING_DELETE') return null;
  const last = await prisma.auditLog.findFirst({ where: { action: 'tenant.delete_request' }, orderBy: { id: 'desc' } });
  return { deleteAfter: last && last.meta && last.meta.deleteAfter, requestedAt: last && last.createdAt };
}

async function status(req, res, next) {
  try {
    const t = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    res.json({ name: t.name, status: t.status, graceDays: DELETE_GRACE_DAYS, pending: await pendingInfo(t) });
  } catch (e) { next(e); }
}

async function exportData(req, res, next) {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    const members = await prisma.membership.findMany({
      where: { tenantId: req.tenantId },
      include: { user: { select: { id: true, email: true, role: true, displayName: true, createdAt: true } } }
    });
    const data = { exportedAt: new Date().toISOString(), tenant, memberships: members };
    for (const m of EXPORT_MODELS) data[m] = await prisma[m].findMany();
    await audit.log('tenant.export', req.tenantId, { counts: Object.fromEntries(EXPORT_MODELS.map(m => [m, data[m].length])) }, req);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kruscan-${tenant.slug}-export.json"`);
    res.send(JSON.stringify(strip(data), null, 2));
  } catch (e) { next(e); }
}

async function deleteRequest(req, res, next) {
  try {
    const t = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (t.status === 'PENDING_DELETE') return res.status(409).json({ error: 'ส่งคำขอลบไปแล้ว' });
    if (!req.body || req.body.confirm !== t.name) return res.status(400).json({ error: 'พิมพ์ชื่อกลุ่มให้ตรงเพื่อยืนยัน' });
    const deleteAfter = new Date(Date.now() + DELETE_GRACE_DAYS * 86400000).toISOString();
    await prisma.tenant.update({ where: { id: t.id }, data: { status: 'PENDING_DELETE' } });
    await audit.log('tenant.delete_request', t.id, { deleteAfter }, req);
    res.json({ status: 'PENDING_DELETE', deleteAfter });
  } catch (e) { next(e); }
}

async function deleteCancel(req, res, next) {
  try {
    const t = await prisma.tenant.findUnique({ where: { id: req.tenantId } });
    if (t.status !== 'PENDING_DELETE') return res.status(409).json({ error: 'ไม่มีคำขอลบที่รออยู่' });
    await prisma.tenant.update({ where: { id: t.id }, data: { status: 'ACTIVE' } });
    await audit.log('tenant.delete_cancel', t.id, {}, req);
    res.json({ status: 'ACTIVE' });
  } catch (e) { next(e); }
}

async function auditList(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const [total, items] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({ orderBy: { id: 'desc' }, skip: (page - 1) * limit, take: limit })
    ]);
    res.json({ page, limit, total, items });
  } catch (e) { next(e); }
}

module.exports = { requireOwner, status, exportData, deleteRequest, deleteCancel, auditList, strip };
