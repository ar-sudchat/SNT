const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { bindTenant } = require('./tenant');
const { accessFor, ensureTeacherFor } = require('../services/teacherAccount');

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

    // Tenant from the verified JWT. Legacy tokens without `tid` fall back to the first membership.
    let tid = decoded.tid;
    let membership = null;
    if (!tid) {
      membership = await prisma.membership.findFirst({ where: { userId: user.id }, orderBy: { id: 'asc' }, select: { tenantId: true, role: true } });
      tid = membership ? membership.tenantId : null;
    } else {
      membership = await prisma.membership.findUnique({ where: { userId_tenantId: { userId: user.id, tenantId: tid } }, select: { tenantId: true, role: true } });
      if (!membership) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
    }
    if (tid) {
      const t = await prisma.tenant.findUnique({ where: { id: tid }, select: { status: true } });
      if (!t) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
      // PENDING_DELETE: owner may still reach /api/tenant (status, export, delete-cancel) and /api/auth.
      const graceOk = t.status === 'PENDING_DELETE' && /^\/api\/(tenant|auth)(\/|$)/.test(req.originalUrl || '');
      if (t.status !== 'ACTIVE' && !graceOk) {
        return res.status(403).json({ error: 'กลุ่มนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ', code: 'TENANT_SUSPENDED' });
      }
    }
    // Permissions follow the current group: effective role + this group's Teacher row.
    const access = accessFor(user.role, membership ? membership.role : null);
    user.globalRole = user.role;
    user.role = access.role;
    user.trole = membership ? membership.role : null;
    user.canManage = access.canManage;
    if (tid && access.role === 'TEACHER') {
      const teacher = await ensureTeacherFor(user, tid);
      user.teacher = teacher;
      user.teacherId = teacher ? teacher.id : null;
    } else if (user.teacher && user.teacher.tenantId !== tid) {
      user.teacher = null; // legacy link belongs to another group
      user.teacherId = null;
    }
    req.user = user;
    req.user.tid = tid;
    bindTenant(req);
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบใหม่' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    }
    console.error('authenticate error:', error.message);
    return res.status(500).json({ error: 'ตรวจสอบสิทธิ์ไม่สำเร็จ' });
  }
};

// Check role authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }

    if (!roles.includes(req.user.role) && !(req.user.canManage && roles.includes('ADMIN'))) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ทำรายการนี้' });
    }

    next();
  };
};

// Admin of the current group: ADMIN role, or the group's OWNER/ADMIN (canManage).
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && !req.user.canManage) {
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
