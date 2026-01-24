const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, isAdmin, isTeacher } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Get all students
router.get('/', authenticate, studentController.getAll);

// Get student by ID
router.get('/:id', authenticate, studentController.getById);

// Get student submissions
router.get('/:id/submissions', authenticate, studentController.getSubmissions);

// Create student (Admin only)
router.post('/', authenticate, isAdmin, validate(schemas.student), studentController.create);

// Update student (Admin only)
router.put('/:id', authenticate, isAdmin, validate(schemas.student), studentController.update);

// Delete student (Admin only)
router.delete('/:id', authenticate, isAdmin, studentController.delete);

module.exports = router;
