const express = require('express');
const router = express.Router();
const multer = require('multer');
const importController = require('../controllers/importController');
const { authenticate, isAdmin } = require('../middleware/auth');

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
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, Excel, and JSON files are allowed.'));
    }
  }
});

// Download templates
router.get('/templates/:type', authenticate, isAdmin, importController.downloadTemplate);

// Import grades
router.post('/grades', authenticate, isAdmin, upload.single('file'), importController.importGrades);

// Import classes
router.post('/classes', authenticate, isAdmin, upload.single('file'), importController.importClasses);

// Import students
router.post('/students', authenticate, isAdmin, upload.single('file'), importController.importStudents);

// Import teachers
router.post('/teachers', authenticate, isAdmin, upload.single('file'), importController.importTeachers);

// Import subjects
router.post('/subjects', authenticate, isAdmin, upload.single('file'), importController.importSubjects);

// Import tasks
router.post('/tasks', authenticate, isAdmin, upload.single('file'), importController.importTasks);

// Validate file before import
router.post('/validate', authenticate, isAdmin, upload.single('file'), importController.validateFile);

module.exports = router;
