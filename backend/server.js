const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// อยู่หลัง reverse proxy (nginx / แพลตฟอร์ม) — ให้ req.ip เป็น IP จริงของผู้ใช้ ไม่ใช่ของ proxy
app.set('trust proxy', 1);

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  // Cache CORS preflight 24h so cross-origin API calls don't pay an extra
  // round-trip every request (matters on a high-latency Thailand<->EU link)
  maxAge: 86400
}));
app.disable('x-powered-by');
app.use(require('./middleware/securityHeaders'));
// Avatar uploads need a larger body; must run before the default 100kb parser
app.use('/api/auth/profile', express.json({ limit: '300kb' }));
// Parse the larger roster payload before the default 100kb JSON parser.
app.use('/api/import/smart/commit', express.json({ limit: '2mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Tenant context per request (filled by authenticate() from JWT `tid`)
app.use(require('./middleware/tenant').tenantScope);

// Routes
const authRoutes = require('./routes/auth');
const academicYearRoutes = require('./routes/academicYears');
const gradeRoutes = require('./routes/grades');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teachers');
const subjectRoutes = require('./routes/subjects');
const taskRoutes = require('./routes/tasks');
const qrcodeRoutes = require('./routes/qrcodes');
const submissionRoutes = require('./routes/submissions');
const importRoutes = require('./routes/import');
const reportRoutes = require('./routes/reports');
const transferRoutes = require('./routes/transfer');
const monitorRoutes = require('./routes/monitor');
const aiRoutes = require('./routes/ai');
const parentRoutes = require('./routes/parent');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/onboarding'));
app.use('/api/ops', require('./routes/ops'));
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/qrcodes', qrcodeRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/import', importRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/monitor', monitorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/tenant', require('./routes/tenantData'));
app.use('/api/plan', require('./routes/plan'));
app.use('/api/parent-links', parentRoutes.linksRouter);
app.use('/api/public/parent', parentRoutes.publicRouter);
app.use('/api/public/tenant', require('./routes/publicTenant'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // ไฟล์อัปโหลดไม่ผ่าน (ชนิดไฟล์ผิด / ใหญ่เกิน) → แจ้งผู้ใช้เป็นภาษาไทย
  if (err.name === 'MulterError' || err.status === 400) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ใหญ่เกิน 10MB' : err.message;
    return res.status(400).json({ error: message });
  }
  console.error(err.stack);
  res.status(500).json({
    error: 'เกิดข้อผิดพลาด กรุณาลองใหม่',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'ไม่พบข้อมูล' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
