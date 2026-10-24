const express = require('express');
const router = express.Router();
const academicYearController = require('../controllers/academicYearController');
const { authenticate, authorize } = require('../middleware/auth');
// Every teacher of the group manages its teaching data (owner request 2026-10-24).
const staff = authorize('ADMIN', 'TEACHER');
const { validate, schemas } = require('../middleware/validate');

// Get all academic years
router.get('/', authenticate, academicYearController.getAll);

// Get current academic year
router.get('/current', authenticate, academicYearController.getCurrent);

// Get academic year by ID
router.get('/:id', authenticate, academicYearController.getById);

// Create academic year (Admin only)
router.post('/', authenticate, staff, validate(schemas.academicYear), academicYearController.create);

// Update academic year (Admin only)
router.put('/:id', authenticate, staff, validate(schemas.academicYear), academicYearController.update);

// Set current academic year (Admin only)
router.put('/:id/set-current', authenticate, staff, academicYearController.setCurrent);

// Delete academic year (Admin only)
router.delete('/:id', authenticate, staff, academicYearController.delete);

module.exports = router;
