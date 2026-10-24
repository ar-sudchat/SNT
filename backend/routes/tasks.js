const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate, authorize, isAdmin, isTeacher } = require('../middleware/auth');
const staff = authorize('ADMIN', 'TEACHER');
const { validate, schemas } = require('../middleware/validate');

// Get all tasks
router.get('/', authenticate, staff, taskController.getAll);

// Get task by ID
router.get('/:id', authenticate, staff, taskController.getById);

// Get task submissions
router.get('/:id/submissions', authenticate, staff, taskController.getSubmissions);

// Create task (Admin/Teacher)
router.post('/', authenticate, isTeacher, validate(schemas.task), taskController.create);

// Update task (Admin/Teacher)
router.put('/:id', authenticate, isTeacher, validate(schemas.task), taskController.update);

// Delete task (Admin/Teacher)
router.delete('/:id', authenticate, isTeacher, taskController.delete);

module.exports = router;
