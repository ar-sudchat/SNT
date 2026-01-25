const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Transfer single student
router.post('/student', authenticate, isAdmin, transferController.transferStudent);

// Bulk transfer students
router.post('/bulk', authenticate, isAdmin, transferController.transferBulk);

// Promote students to next grade
router.post('/promote', authenticate, isAdmin, transferController.promoteStudents);

// Get promotion preview/suggestions
router.get('/promotion-preview', authenticate, isAdmin, transferController.getPromotionPreview);

module.exports = router;
