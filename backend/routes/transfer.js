const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { authenticate, authorize } = require('../middleware/auth');
// Every teacher of the group manages its teaching data (owner request 2026-10-24).
const staff = authorize('ADMIN', 'TEACHER');

// Transfer single student
router.post('/student', authenticate, staff, transferController.transferStudent);

// Bulk transfer students
router.post('/bulk', authenticate, staff, transferController.transferBulk);

// Promote students to next grade
router.post('/promote', authenticate, staff, transferController.promoteStudents);

// Get promotion preview/suggestions
router.get('/promotion-preview', authenticate, staff, transferController.getPromotionPreview);

module.exports = router;
