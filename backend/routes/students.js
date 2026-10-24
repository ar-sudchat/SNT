const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, authorize, isTeacher } = require('../middleware/auth');
// Every teacher in the group may manage these (owner request 2026-10-24).
const staff = authorize('ADMIN', 'TEACHER');
const { validate, schemas } = require('../middleware/validate');

// Get all students
router.get('/', authenticate, staff, studentController.getAll);

// Get student by ID
router.get('/:id', authenticate, staff, studentController.getById);

// Get student submissions
router.get('/:id/submissions', authenticate, staff, studentController.getSubmissions);

// Create student (Admin only)
router.post('/', authenticate, staff, validate(schemas.student), studentController.create);

// Update student (Admin only)
router.put('/:id', authenticate, staff, validate(schemas.student), studentController.update);

// Delete student (Admin only)
router.delete('/:id', authenticate, staff, studentController.delete);

module.exports = router;
