const express = require('express');
const router = express.Router();
const academicYearController = require('../controllers/academicYearController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Get all academic years
router.get('/', authenticate, academicYearController.getAll);

// Get current academic year
router.get('/current', authenticate, academicYearController.getCurrent);

// Get academic year by ID
router.get('/:id', authenticate, academicYearController.getById);

// Create academic year (Admin only)
router.post('/', authenticate, isAdmin, validate(schemas.academicYear), academicYearController.create);

// Update academic year (Admin only)
router.put('/:id', authenticate, isAdmin, validate(schemas.academicYear), academicYearController.update);

// Set current academic year (Admin only)
router.put('/:id/set-current', authenticate, isAdmin, academicYearController.setCurrent);

// Delete academic year (Admin only)
router.delete('/:id', authenticate, isAdmin, academicYearController.delete);

module.exports = router;
