const express = require('express');
const router = express.Router();
const gradeController = require('../controllers/gradeController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Get all grades
router.get('/', authenticate, gradeController.getAll);

// Get grade by ID
router.get('/:id', authenticate, gradeController.getById);

// Create grade (Admin only)
router.post('/', authenticate, isAdmin, validate(schemas.grade), gradeController.create);

// Update grade (Admin only)
router.put('/:id', authenticate, isAdmin, validate(schemas.grade), gradeController.update);

// Delete grade (Admin only)
router.delete('/:id', authenticate, isAdmin, gradeController.delete);

module.exports = router;
