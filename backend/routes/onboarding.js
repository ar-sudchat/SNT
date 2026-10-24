const express = require('express');
const c = require('../controllers/onboardingController');

// Mounted at /api: /api/onboarding/* and /api/invites/*
const router = express.Router();

router.get('/onboarding/slug-available', c.slugAvailable);
router.post('/onboarding/school', c.signupRateLimit, c.createSchool);

router.post('/invites', c.createInvite);
router.get('/invites', c.listInvites);
router.delete('/invites/:id', c.deleteInvite);
router.get('/invites/:token', c.inviteAcceptRateLimit, c.previewInvite);
router.post('/invites/:token/accept', c.inviteAcceptRateLimit, c.acceptInvite);

// Groups (tenant = กลุ่ม)
router.post('/groups', c.createGroup);
router.post('/groups/join', c.joinRateLimit, c.joinGroup);
router.get('/groups/:id', c.getGroup);
router.patch('/groups/:id', c.renameGroup);
router.get('/groups/:id/members', c.listMembers);
router.post('/groups/:id/join-code/rotate', c.rotateJoinCode);
router.delete('/groups/:id/members/:userId', c.removeMember);

module.exports = router;
