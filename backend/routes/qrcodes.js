const express = require('express');
const router = express.Router();
const qrcodeController = require('../controllers/qrcodeController');
const { authenticate, isAdmin, isTeacher } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Generate single QR code (Admin only)
router.post('/generate', authenticate, isAdmin, validate(schemas.qrcode), qrcodeController.generate);

// Generate bulk QR codes (Admin only)
router.post('/generate-bulk', authenticate, isAdmin, validate(schemas.qrcodeBulk), qrcodeController.generateBulk);

// Scan QR code (Teacher)
router.post('/scan', authenticate, isTeacher, qrcodeController.scan);

// Search by student code (Teacher) - for manual input
router.post('/search-student', authenticate, isTeacher, qrcodeController.searchByStudent);

// Get QR code by ID
router.get('/:id', authenticate, qrcodeController.getById);

// Get QR code image
router.get('/:id/image', authenticate, qrcodeController.getImage);

// Print QR codes for class
router.get('/print/class/:classId/subject/:subjectId', authenticate, isAdmin, qrcodeController.printForClass);

module.exports = router;
