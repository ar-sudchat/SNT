const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requireTenant } = require('../middleware/tenant');
const { getUsageSummary } = require('../services/usage');
const { PLANS } = require('../config/plans');

router.use(authenticate, authorize('ADMIN'), requireTenant);

router.get('/', async (req, res) => {
  try {
    const s = await getUsageSummary(req.tenantId);
    if (!s) return res.status(404).json({ error: 'ไม่พบโรงเรียน' });
    res.json({ ...s, plans: Object.values(PLANS) });
  } catch (err) {
    console.error('plan error:', err && err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่' });
  }
});

// Billing stub: no payment provider yet.
router.post('/upgrade', (req, res) => res.status(501).json({ error: 'การอัปเกรดแพ็กเกจ เร็วๆ นี้' }));

module.exports = router;
