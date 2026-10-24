// Platform operations (superadmin). Authorization = env PLATFORM_ADMIN_EMAILS (comma list)
// matched against the logged-in user's email. TODO: require 2FA (TOTP) before production (SAAS-DESIGN §auth).
const prisma = require('../config/database');
const { withoutTenant } = require('../services/tenantContext');

const STATUSES = ['ACTIVE', 'SUSPENDED'];

function adminEmails(env = process.env) {
  return String(env.PLATFORM_ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function isPlatformAdminEmail(email, env = process.env) {
  if (!email || typeof email !== 'string') return false;
  return adminEmails(env).includes(email.trim().toLowerCase());
}

// Use after authenticate(). Fails closed when env is empty or email is a placeholder-less match.
function requirePlatformAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  // Email alone is not proof: signup / invite / teacher-code accounts never verify their email, so
  // anyone could register the admin address first. Require a Google-verified login (googleSub).
  if (!isPlatformAdminEmail(req.user.email) || !req.user.googleSub) return res.status(403).json({ error: 'เฉพาะผู้ดูแลแพลตฟอร์ม (เข้าสู่ระบบด้วย Google)' });
  next();
}

async function listTenants(req, res) {
  try {
    const rows = await withoutTenant(() => prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, slug: true, name: true, plan: true, status: true, createdAt: true,
        _count: { select: { students: true, teachers: true } },
      },
    }));
    res.json({
      tenants: rows.map(t => ({
        id: t.id, slug: t.slug, name: t.name, plan: t.plan, status: t.status, createdAt: t.createdAt,
        students: t._count.students, teachers: t._count.teachers,
      })),
    });
  } catch (e) {
    console.error('ops listTenants', e.message);
    res.status(500).json({ error: 'โหลดรายชื่อโรงเรียนไม่สำเร็จ' });
  }
}

async function setTenantStatus(req, res) {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง (ACTIVE หรือ SUSPENDED)' });
  try {
    const out = await withoutTenant(async () => {
      const t = await prisma.tenant.findUnique({ where: { id: String(req.params.id) }, select: { id: true, status: true } });
      if (!t) return null;
      if (t.status === 'PENDING_DELETE') return 'locked';
      const updated = await prisma.tenant.update({ where: { id: t.id }, data: { status }, select: { id: true, slug: true, name: true, status: true } });
      await prisma.auditLog.create({
        data: { tenantId: t.id, userId: req.user.id, action: status === 'SUSPENDED' ? 'ops.tenant.suspend' : 'ops.tenant.unsuspend', target: t.id, meta: { from: t.status, to: status } },
      });
      return updated;
    });
    if (!out) return res.status(404).json({ error: 'ไม่พบโรงเรียน' });
    if (out === 'locked') return res.status(409).json({ error: 'โรงเรียนอยู่ระหว่างการลบ เปลี่ยนสถานะไม่ได้' });
    res.json({ tenant: out });
  } catch (e) {
    console.error('ops setTenantStatus', e.message);
    res.status(500).json({ error: 'เปลี่ยนสถานะไม่สำเร็จ' });
  }
}

module.exports = { isPlatformAdminEmail, requirePlatformAdmin, listTenants, setTenantStatus, STATUSES };
