const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, isTeacher, authorize } = require('../middleware/auth');
// Every teacher of the group manages its teaching data (owner request 2026-10-24).
const staff = authorize('ADMIN', 'TEACHER');

// Admin dashboard overview
router.get('/admin/overview', authenticate, staff, reportController.adminOverview);

// Admin task submission statistics
router.get('/admin/statistics', authenticate, staff, reportController.adminStatistics);

// Teacher dashboard overview (like admin but for teacher's subjects)
router.get('/teacher/overview', authenticate, isTeacher, reportController.teacherOverview);

// Teacher task statistics
router.get('/teacher/statistics', authenticate, isTeacher, reportController.teacherStatistics);

// Teacher dashboard - by subject
router.get('/teacher/subjects', authenticate, isTeacher, reportController.teacherSubjects);

// Teacher report - subject summary
router.get('/teacher/subject/:subjectId', authenticate, isTeacher, reportController.subjectSummary);

// Teacher report - student summary
router.get('/teacher/student/:studentId', authenticate, isTeacher, reportController.studentSummary);

// Student report - own submissions
router.get('/student/my-submissions', authenticate, reportController.studentSubmissions);

// Export report to CSV/Excel
router.get('/export/:type', authenticate, isTeacher, reportController.exportReport);

module.exports = router;
