const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticate, isAdmin, isTeacher } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Get all tasks
router.get('/', authenticate, taskController.getAll);

// Get task by ID
router.get('/:id', authenticate, taskController.getById);

// Get task submissions
router.get('/:id/submissions', authenticate, taskController.getSubmissions);

// Create task (Admin/Teacher)
router.post('/', authenticate, isTeacher, validate(schemas.task), taskController.create);

// Update task (Admin/Teacher)
router.put('/:id', authenticate, isTeacher, validate(schemas.task), taskController.update);

// Delete task (Admin/Teacher)
router.delete('/:id', authenticate, isTeacher, taskController.delete);

module.exports = router;
