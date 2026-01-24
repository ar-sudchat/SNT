const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { authenticate, isTeacher } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Get all submissions
router.get('/', authenticate, submissionController.getAll);

// Get submission by ID
router.get('/:id', authenticate, submissionController.getById);

// Create or update submission (Teacher)
router.post('/', authenticate, isTeacher, validate(schemas.submission), submissionController.createOrUpdate);

// Bulk update submissions (Teacher)
router.post('/bulk', authenticate, isTeacher, submissionController.bulkUpdate);

// Get submission history
router.get('/:id/history', authenticate, submissionController.getHistory);

module.exports = router;
