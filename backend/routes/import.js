const express = require('express');
const router = express.Router();
const multer = require('multer');
const { restoreTenant } = require('../middleware/tenant');
const importController = require('../controllers/importController');
const { authenticate, isAdmin, authorize } = require('../middleware/auth');
const staff = authorize('ADMIN', 'TEACHER'); // smart roster import: any teacher of the group

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];
    // บาง browser ส่ง CSV มาเป็น application/octet-stream หรือ text/plain จึงตรวจนามสกุลด้วย
    const allowedExts = ['.csv', '.xlsx', '.xls', '.json'];
    const name = (file.originalname || '').toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.some(ext => name.endsWith(ext))) {
      cb(null, true);
    } else {
      const err = new Error('รองรับเฉพาะไฟล์ CSV, Excel (.xlsx, .xls) และ JSON');
      err.status = 400;
      cb(err);
    }
  }
});

const smartImport = require('../controllers/smartImportController');
router.post('/smart/preview', authenticate, staff, upload.single('file'), restoreTenant, smartImport.preview);
router.post('/smart/commit', authenticate, staff, express.json({ limit: '2mb' }), smartImport.commit);

// Download templates
router.get('/templates/:type', authenticate, staff, importController.downloadTemplate);

// Import academic years
router.post('/academic-years', authenticate, staff, upload.single('file'), restoreTenant, importController.importAcademicYears);

// Import grades
router.post('/grades', authenticate, staff, upload.single('file'), restoreTenant, importController.importGrades);

// Import classes
router.post('/classes', authenticate, staff, upload.single('file'), restoreTenant, importController.importClasses);

// Import students
router.post('/students', authenticate, staff, upload.single('file'), restoreTenant, importController.importStudents);

// Import teachers
router.post('/teachers', authenticate, isAdmin, upload.single('file'), restoreTenant, importController.importTeachers);

// Import subjects
router.post('/subjects', authenticate, staff, upload.single('file'), restoreTenant, importController.importSubjects);

// Import tasks
router.post('/tasks', authenticate, staff, upload.single('file'), restoreTenant, importController.importTasks);

// Validate file before import
router.post('/validate', authenticate, staff, upload.single('file'), restoreTenant, importController.validateFile);

module.exports = router;
