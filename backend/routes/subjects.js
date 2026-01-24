const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const { authenticate, isAdmin, isTeacher } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Get all subjects
router.get('/', authenticate, subjectController.getAll);

// Get subject by ID
router.get('/:id', authenticate, subjectController.getById);

// Get tasks for subject
router.get('/:id/tasks', authenticate, subjectController.getTasks);

// Create subject (Admin only)
router.post('/', authenticate, isAdmin, validate(schemas.subject), subjectController.create);

// Update subject (Admin only)
router.put('/:id', authenticate, isAdmin, validate(schemas.subject), subjectController.update);

// Delete subject (Admin only)
router.delete('/:id', authenticate, isAdmin, subjectController.delete);

module.exports = router;
