const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Every teacher in the group may manage grades, classes and students (owner request 2026-10-24).
const staff = authorize('ADMIN', 'TEACHER');

// Get all grades
router.get('/', authenticate, gradeController.getAll);

// Bulk create / delete (registered before the '/:id' routes)
router.post('/bulk', authenticate, staff, gradeController.bulkCreate);
router.post('/bulk-delete', authenticate, staff, gradeController.bulkDelete);

// Get grade by ID
router.get('/:id', authenticate, gradeController.getById);

// Create grade (Admin only)
router.post('/', authenticate, staff, validate(schemas.grade), gradeController.create);

// Update grade (Admin only)
router.put('/:id', authenticate, staff, validate(schemas.grade), gradeController.update);

// Delete grade (Admin only)
router.delete('/:id', authenticate, staff, gradeController.delete);

module.exports = router;
