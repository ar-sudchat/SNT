const prisma = require('../config/database');
const { withoutTenant } = require('../services/tenantContext');

const NOT_FOUND_MSG = 'ไม่พบโรงเรียนนี้';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

// Public: expose only name + slug (no private data). Suspended/deleted tenants look like 404.
exports.getTenantBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!SLUG_RE.test(slug)) return res.status(404).json({ error: NOT_FOUND_MSG });
    const tenant = await withoutTenant(() =>
      prisma.tenant.findUnique({ where: { slug }, select: { name: true, slug: true, status: true } })
    );
    if (!tenant || tenant.status !== 'ACTIVE') return res.status(404).json({ error: NOT_FOUND_MSG });
    res.json({ name: tenant.name, slug: tenant.slug });
  } catch (error) {
    console.error('Public tenant error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
};
