const express = require('express');
const router = express.Router();
const c = require('../controllers/tenantDataController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate, c.requireOwner);
router.get('/status', c.status);
router.get('/export', c.exportData);
router.post('/delete-request', c.deleteRequest);
router.post('/delete-cancel', c.deleteCancel);
router.get('/audit', c.auditList);

module.exports = router;
