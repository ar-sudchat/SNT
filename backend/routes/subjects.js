const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { authenticate, authorize, isAdmin, isTeacher } = require('../middleware/auth');
const staff = authorize('ADMIN', 'TEACHER');
const { validate, schemas } = require('../middleware/validate');

// Get all subjects
router.get('/', authenticate, staff, subjectController.getAll);

// Get subject by ID
router.get('/:id', authenticate, staff, subjectController.getById);

// Get tasks for subject
router.get('/:id/tasks', authenticate, staff, subjectController.getTasks);

// Create subject (Admin only)
router.post('/', authenticate, isAdmin, validate(schemas.subject), subjectController.create);

// Update subject (Admin only)
router.put('/:id', authenticate, isAdmin, validate(schemas.subject), subjectController.update);

// Delete subject (Admin only)
router.delete('/:id', authenticate, isAdmin, subjectController.delete);

module.exports = router;
