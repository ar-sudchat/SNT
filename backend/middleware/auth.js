const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        teacher: true,
        student: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    return res.status(500).json({ error: 'ตรวจสอบสิทธิ์ไม่สำเร็จ' });
  }
};

// Check role authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ทำรายการนี้' });
    }

    next();
  };
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบ' });
  }
  next();
};

// Check if user is teacher
const isTeacher = (req, res, next) => {
  if (req.user.role !== 'TEACHER' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'เฉพาะครูหรือผู้ดูแลระบบ' });
  }
  next();
};

// Check if user is student
const isStudent = (req, res, next) => {
  if (req.user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'เฉพาะนักเรียน' });
  }
  next();
};

module.exports = {
  authenticate,
  authorize,
  isAdmin,
  isTeacher,
  isStudent
};
