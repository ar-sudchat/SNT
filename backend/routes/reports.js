const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, isAdmin, isTeacher } = require('../middleware/auth');

// Admin dashboard overview
router.get('/admin/overview', authenticate, isAdmin, reportController.adminOverview);

// Admin task submission statistics
router.get('/admin/statistics', authenticate, isAdmin, reportController.adminStatistics);

// Teacher dashboard - by subject
router.get('/teacher/subjects', authenticate, isTeacher, reportController.teacherSubjects);

// Teacher report - subject summary
router.get('/teacher/subject/:subjectId', authenticate, isTeacher, reportController.subjectSummary);

// Teacher report - student summary
router.get('/teacher/student/:studentId', authenticate, isTeacher, reportController.studentSummary);

// Student report - own submissions
router.get('/student/my-submissions', authenticate, reportController.studentSubmissions);

// Export report to CSV/Excel
router.get('/export/:type', authenticate, reportController.exportReport);

module.exports = router;
