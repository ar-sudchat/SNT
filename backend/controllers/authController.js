const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '1234';

const authController = {
  // Login - supports admin, teacher code, or student code
  async login(req, res) {
    try {
      const { username, password } = req.body;

      // 1. Check for Admin login
      if (username === ADMIN_USERNAME) {
        if (password !== ADMIN_PASSWORD) {
          return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        // Find or create admin user
        let adminUser = await prisma.user.findFirst({
          where: { role: 'ADMIN' }
        });

        if (!adminUser) {
          const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
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
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
            return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
          }
        } else {
          // Auto-create user for teacher (password = teacherCode by default)
          if (password !== teacher.teacherCode) {
            return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง (ใช้รหัสครูเป็นรหัสผ่านครั้งแรก)' });
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
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
        // For students, use studentCode as password (simple login)
        if (password !== student.studentCode) {
          return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง (ใช้รหัสนักเรียนเป็นรหัสผ่าน)' });
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
          { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
      return res.status(401).json({ error: 'ไม่พบผู้ใช้งาน กรุณาตรวจสอบรหัสผู้ใช้' });

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
        return res.status(400).json({ error: 'Email already registered' });
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
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
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
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  // Get current user
  async getCurrentUser(req, res) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          teacher: true,
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
      res.status(500).json({ error: 'Failed to get user data' });
    }
  },

  // Logout
  async logout(req, res) {
    res.json({ message: 'Logged out successfully' });
  },

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword }
      });

      res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ' });
    }
  }
};

module.exports = authController;
