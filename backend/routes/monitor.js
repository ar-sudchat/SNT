const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/monitorController');
const { authenticate, authorize } = require('../middleware/auth');
const staff = authorize('ADMIN', 'TEACHER');

// Parse QR code
router.post('/parse-qr', authenticate, staff, monitorController.parseQRCode);

// Get student monitor data
router.get('/student/:id', authenticate, staff, monitorController.getStudentMonitor);

// Get class monitor data
router.get('/class/:id', authenticate, staff, monitorController.getClassMonitor);

// Get subject monitor data
router.get('/subject/:id', authenticate, staff, monitorController.getSubjectMonitor);

// Get subject tasks for student (for recording submissions)
router.get('/student/:studentId/subject/:subjectId', authenticate, staff, monitorController.getSubjectTasks);

module.exports = router;
