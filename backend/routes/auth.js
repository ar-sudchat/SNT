const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const loginRateLimit = require('../middleware/loginRateLimit');
const { signupRateLimit } = require('../controllers/onboardingController');
const { validate, schemas } = require('../middleware/validate');

// Login
router.post('/login', loginRateLimit, validate(schemas.login), authController.login);

// Accounts: email signup/login, Google OAuth, tenant memberships
router.get('/config', authController.config);
router.post('/signup', loginRateLimit, signupRateLimit, authController.signup); // per-IP cap: each signup = new group + AI quota
router.post('/login/email', loginRateLimit, authController.emailLogin);
router.get('/google', authController.googleStart);
router.get('/google/callback', authController.googleCallback);
router.get('/memberships', authenticate, authController.memberships);
router.post('/switch-tenant', authenticate, authController.switchTenant);

// Register (Admin only)
router.post('/register', authenticate, authorize('ADMIN'), validate(schemas.register), authController.register);

// Get current user
router.get('/me', authenticate, authController.getCurrentUser);

// Logout
router.post('/logout', authenticate, authController.logout);

// Change password
router.put('/change-password', authenticate, authController.changePassword);

// Profile (avatar, display name, bio, accent) and stats
router.put('/profile', authenticate, authController.updateProfile);
router.get('/profile/stats', authenticate, authController.getProfileStats);

module.exports = router;
