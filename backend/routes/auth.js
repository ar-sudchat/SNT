const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

// Login
router.post('/login', validate(schemas.login), authController.login);

// Register (Admin only in production)
router.post('/register', validate(schemas.register), authController.register);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Logout
router.post('/logout', authenticate, authController.logout);

// Change password
router.put('/change-password', authenticate, authController.changePassword);

module.exports = router;
