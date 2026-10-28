const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const scanCheck = require('../controllers/scanCheckController');
const { authenticate, authorize, isTeacher } = require('../middleware/auth');
const staff = authorize('ADMIN', 'TEACHER');
const { validate, schemas } = require('../middleware/validate');

// สแกนตรวจงานต่อเนื่อง (ต้องอยู่เหนือ /:id)
router.post('/scan-check', authenticate, isTeacher, scanCheck.scanCheck);
router.get('/task-progress', authenticate, isTeacher, scanCheck.taskProgress);
router.get('/task-sheet', authenticate, isTeacher, scanCheck.taskSheet);

// Get all submissions
router.get('/', authenticate, staff, submissionController.getAll);

// Get submission by ID
router.get('/:id', authenticate, staff, submissionController.getById);

// Create or update submission (Teacher)
router.post('/', authenticate, isTeacher, validate(schemas.submission), submissionController.createOrUpdate);

// Bulk update submissions (Teacher)
router.post('/bulk', authenticate, isTeacher, submissionController.bulkUpdate);

// Get submission history
router.get('/:id/history', authenticate, staff, submissionController.getHistory);

module.exports = router;
