const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const { authenticate, authorize, isAdmin } = require('../middleware/auth');
const staff = authorize('ADMIN', 'TEACHER');
const { validate, schemas } = require('../middleware/validate');

// Get all teachers
router.get('/', authenticate, staff, teacherController.getAll);

// Get teacher by ID
router.get('/:id', authenticate, staff, teacherController.getById);

// Get teacher subjects
router.get('/:id/subjects', authenticate, staff, teacherController.getSubjects);

// Create teacher (Admin only)
router.post('/', authenticate, isAdmin, validate(schemas.teacher), teacherController.create);

// Update teacher (Admin only)
router.put('/:id', authenticate, isAdmin, validate(schemas.teacher), teacherController.update);

// Delete teacher (Admin only)
router.delete('/:id', authenticate, isAdmin, teacherController.delete);

module.exports = router;
