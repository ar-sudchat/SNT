const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ops = require('../controllers/opsController');

router.use(authenticate, ops.requirePlatformAdmin);
router.get('/tenants', ops.listTenants);
router.post('/tenants/:id/status', ops.setTenantStatus);

module.exports = router;
