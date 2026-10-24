const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { authenticate, authorize } = require('../middleware/auth');
// Every teacher in the group may manage these (owner request 2026-10-24).
const staff = authorize('ADMIN', 'TEACHER');
const { validate, schemas } = require('../middleware/validate');

// Get all classes
router.get('/', authenticate, staff, classController.getAll);

// Bulk create / delete (registered before the '/:id' routes)
router.post('/bulk', authenticate, staff, classController.bulkCreate);
router.post('/bulk-delete', authenticate, staff, classController.bulkDelete);

// Get class by ID
router.get('/:id', authenticate, staff, classController.getById);

// Get students in class
router.get('/:id/students', authenticate, staff, classController.getStudents);

// Create class (Admin only)
router.post('/', authenticate, staff, validate(schemas.class), classController.create);

// Update class (Admin only)
router.put('/:id', authenticate, staff, validate(schemas.class), classController.update);

// Delete class (Admin only)
router.delete('/:id', authenticate, staff, classController.delete);

module.exports = router;
