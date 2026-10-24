const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const loginRateLimit = require('../middleware/loginRateLimit');
const { validate, schemas } = require('../middleware/validate');

// Login
router.post('/login', loginRateLimit, validate(schemas.login), authController.login);

// Register (Admin only)
router.post('/register', authenticate, authorize('ADMIN'), validate(schemas.register), authController.register);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Logout
router.post('/logout', authenticate, authController.logout);

// Change password
router.put('/change-password', authenticate, authController.changePassword);

module.exports = router;
