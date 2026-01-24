const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Get all classes
router.get('/', authenticate, classController.getAll);

// Get class by ID
router.get('/:id', authenticate, classController.getById);

// Get students in class
router.get('/:id/students', authenticate, classController.getStudents);

// Create class (Admin only)
router.post('/', authenticate, isAdmin, validate(schemas.class), classController.create);

// Update class (Admin only)
router.put('/:id', authenticate, isAdmin, validate(schemas.class), classController.update);

// Delete class (Admin only)
router.delete('/:id', authenticate, isAdmin, classController.delete);

module.exports = router;
