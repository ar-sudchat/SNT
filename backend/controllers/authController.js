const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

// Admin credentials come from env. ADMIN_PASSWORD_HASH is a bcrypt hash.
// Legacy fallback (admin/1234) only when ADMIN_PASSWORD_HASH is unset -> loud warning.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const LEGACY_ADMIN_PASSWORD = '1234';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const INVALID_LOGIN = 'รหัสผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';

if (!ADMIN_PASSWORD_HASH) {
  console.warn('\n' + '!'.repeat(72) +
    '\n!! SECURITY WARNING: ADMIN_PASSWORD_HASH is not set.' +
    '\n!! Falling back to the legacy default admin password. Set ADMIN_USERNAME and' +
    '\n!! ADMIN_PASSWORD_HASH (bcrypt) in the environment before production use.\n' +
    '!'.repeat(72) + '\n');
}

async function checkAdminPassword(password) {
  if (ADMIN_PASSWORD_HASH) return bcrypt.compare(String(password), ADMIN_PASSWORD_HASH);
  return password === LEGACY_ADMIN_PASSWORD;
}

const authController = {
  // Login - supports admin, teacher code, or student code
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // 1. Check for Admin login
      if (username === ADMIN_USERNAME) {
        if (!(await checkAdminPassword(password))) {
          return res.status(401).json({ error: INVALID_LOGIN });
        }

        // Find or create admin user
        let adminUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' }
        });

        if (!adminUser) {
          const hashedPassword = await bcrypt.hash(String(password), 10);
          adminUser = await prisma.user.create({
            data: {
              email: 'admin@system.local',
              password: hashedPassword,
              role: 'ADMIN'
            }
          });
        }

        const token = jwt.sign(
          { userId: adminUser.id, role: 'ADMIN' },
          process.env.JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({
          token,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            role: 'ADMIN',
            name: 'ผู้ดูแลระบบ'
          }
        });
      }

      // 2. Check for Teacher login (by teacherCode)
      const teacher = await prisma.teacher.findUnique({
        where: { teacherCode: username },
        include: { user: true }
      });

      if (teacher) {
        // Check if teacher has a user account
        if (teacher.user) {
          const isValidPassword = await bcrypt.compare(password, teacher.user.password);
          if (!isValidPassword) {
            return res.status(401).json({ error: INVALID_LOGIN });
          }
        } else {
          // Auto-create user for teacher (password = teacherCode by default)
          if (password !== teacher.teacherCode) {
            return res.status(401).json({ error: INVALID_LOGIN });
          }
          const hashedPassword = await bcrypt.hash(password, 10);
          await prisma.user.create({
            data: {
              email: teacher.email || `${teacher.teacherCode}@teacher.local`,
              password: hashedPassword,
              role: 'TEACHER',
              teacherId: teacher.id
            }
          });
        }

        const user = await prisma.user.findFirst({
          where: { teacherId: teacher.id },
          include: { teacher: true }
        });

        // Use the role stored on the User row (DB-managed), so a teacher whose
        // role was set to ADMIN in the database logs in with admin privileges.
        const token = jwt.sign(
          { userId: user.id, role: user.role },
          process.env.JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            teacher: user.teacher,
            name: teacher.name
          }
        });
      }

      // 3. Check for Student login (by studentCode)
      const student = await prisma.student.findUnique({
        where: { studentCode: username },
        include: {
          user: true,
          class: { include: { grade: true } }
        }
      });

      if (student) {
        // Default password = studentCode until a User row exists; after that the
        // stored hash wins (so change-password takes effect).
        const okStudent = student.user
          ? await bcrypt.compare(String(password), student.user.password)
          : password === student.studentCode;
        if (!okStudent) {
          return res.status(401).json({ error: INVALID_LOGIN });
        }

        // Auto-create user if not exists
        if (!student.user) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await prisma.user.create({
            data: {
              email: student.email || `${student.studentCode}@student.local`,
              password: hashedPassword,
              role: 'STUDENT',
              studentId: student.id
            }
          });
        }

        const user = await prisma.user.findFirst({
          where: { studentId: student.id },
          include: {
            student: {
              include: {
                class: { include: { grade: true } }
              }
            }
          }
        });

        const token = jwt.sign(
          { userId: user.id, role: 'STUDENT' },
          process.env.JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: 'STUDENT',
            student: user.student,
            name: student.name
          }
        });
      }

      // Not found
      return res.status(401).json({ error: INVALID_LOGIN });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'เข้าสู่ระบบไม่สำเร็จ' });
    }
  },

  // Register (kept for compatibility)
  async register(req, res) {
    try {
      const { email, password, role, teacherId, studentId } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'อีเมลนี้ถูกใช้ลงทะเบียนแล้ว' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role,
          teacherId: role === 'TEACHER' ? teacherId : null,
          studentId: role === 'STUDENT' ? studentId : null
        },
        include: {
          teacher: true,
          student: true
        }
      });

      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          teacher: user.teacher,
          student: user.student
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'ลงทะเบียนไม่สำเร็จ' });
    }
  },

  // Get current user
  async getCurrentUser(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          teacher: {
            include: {
              subjects: { where: { status: 'ACTIVE' }, select: { id: true, subjectCode: true, subjectName: true } },
              homeClass: { select: { id: true, className: true } }
            }
          },
          student: {
            include: {
              class: {
                include: {
                  grade: true
                }
              }
            }
          }
        }
      });

      res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.teacher?.name || user.student?.name || 'ผู้ดูแลระบบ',
        teacher: user.teacher,
        student: user.student
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({ error: 'โหลดข้อมูลไม่สำเร็จ' });
    }
  },

  // Logout
  async logout(req, res) {
    res.json({ message: 'ออกจากระบบแล้ว' });
  },

  // Change password (teacher/student). Wrong current password -> 400, not 401,
  // because the frontend treats 401 as "session expired" and logs out.
  async changePassword(req, res) {
    try {
      if (req.user.role === 'ADMIN') {
        return res.status(400).json({ error: 'รหัสผู้ดูแลระบบตั้งที่เซิร์ฟเวอร์ (ADMIN_PASSWORD_HASH) เปลี่ยนจากหน้านี้ไม่ได้' });
      }
      const currentPassword = String((req.body && req.body.currentPassword) || '');
      const newPassword = String((req.body && req.body.newPassword) || '');
      if (!currentPassword) return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบัน' });
      if (newPassword.length < 8) return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' });
      if (newPassword.length > 128) return res.status(400).json({ error: 'รหัสผ่านใหม่ยาวเกินไป' });
      const code = req.user.teacher?.teacherCode || req.user.student?.studentCode || '';
      if (code && newPassword.toLowerCase() === String(code).toLowerCase()) {
        return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผู้ใช้' });
      }
      if (newPassword === currentPassword) {
        return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน' });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: req.user.id }, data: { password: hashedPassword } });

      res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ' });
    }
  }
};

module.exports = authController;
