const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/publicTenantController');

router.get('/:slug', ctrl.getTenantBySlug);

module.exports = router;
