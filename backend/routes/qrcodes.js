const express = require('express');
const router = express.Router();
const qrcodeController = require('../controllers/qrcodeController');
const { authenticate, authorize, isTeacher } = require('../middleware/auth');
const staff = authorize('ADMIN', 'TEACHER');
const { validate, schemas } = require('../middleware/validate');

// Generate single QR code (Admin only)
router.post('/generate', authenticate, staff, validate(schemas.qrcode), qrcodeController.generate);

// Generate bulk QR codes (Admin only)
router.post('/generate-bulk', authenticate, staff, validate(schemas.qrcodeBulk), qrcodeController.generateBulk);

// Scan QR code (Teacher)
router.post('/scan', authenticate, isTeacher, qrcodeController.scan);

// Search by student code (Teacher) - for manual input
router.post('/search-student', authenticate, isTeacher, qrcodeController.searchByStudent);

// Get QR code by ID
router.get('/:id', authenticate, staff, qrcodeController.getById);

// Get QR code image
router.get('/:id/image', authenticate, staff, qrcodeController.getImage);

// Print QR codes for class
router.get('/print/class/:classId/subject/:subjectId', authenticate, staff, qrcodeController.printForClass);

module.exports = router;
