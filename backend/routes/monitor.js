const express = require('express');
const router = express.Router();
const monitorController = require('../controllers/monitorController');
const { authenticate } = require('../middleware/auth');

// Parse QR code
router.post('/parse-qr', authenticate, monitorController.parseQRCode);

// Get student monitor data
router.get('/student/:id', authenticate, monitorController.getStudentMonitor);

// Get class monitor data
router.get('/class/:id', authenticate, monitorController.getClassMonitor);

// Get subject monitor data
router.get('/subject/:id', authenticate, monitorController.getSubjectMonitor);

// Get subject tasks for student (for recording submissions)
router.get('/student/:studentId/subject/:subjectId', authenticate, monitorController.getSubjectTasks);

module.exports = router;
