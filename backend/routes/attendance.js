const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const day = require('../controllers/dayAttendanceController');
const report = require('../controllers/attendanceReportController');
const { authenticate, isTeacher } = require('../middleware/auth');

router.post('/scan', authenticate, isTeacher, attendanceController.scan);
router.get('/sheet', authenticate, isTeacher, attendanceController.sheet);
router.put('/mark', authenticate, isTeacher, attendanceController.mark);
router.post('/close', authenticate, isTeacher, attendanceController.close);
router.get('/summary', authenticate, isTeacher, attendanceController.summary);
router.get('/export', authenticate, isTeacher, attendanceController.exportXlsx);

// รายงานรายเดือน + ส่งออก ปพ.5 (เวลาเรียน)
router.get('/monthly', authenticate, isTeacher, report.monthly);
router.get('/pp5-export', authenticate, isTeacher, report.pp5Export);

// มาเรียนรายวัน (ไม่ผูกวิชา)
router.post('/day/scan', authenticate, isTeacher, day.scan);
router.get('/day/sheet', authenticate, isTeacher, day.sheet);
router.put('/day/mark', authenticate, isTeacher, day.mark);
router.get('/day/summary', authenticate, isTeacher, day.summary);
router.get('/day/export', authenticate, isTeacher, day.exportXlsx);

module.exports = router;
