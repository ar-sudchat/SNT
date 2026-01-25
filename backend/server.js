const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

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
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// API Routes
app.use('/api/auth', authRoutes);
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
