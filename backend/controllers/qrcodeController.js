const QRCode = require('qrcode');
const prisma = require('../config/database');
const crypto = require('crypto');

const qrcodeController = {
  // Generate single QR code
  async generate(req, res) {
    try {
      const { studentId, subjectId } = req.body;

      // Check if QR code already exists
      const existing = await prisma.qRCode.findFirst({
        where: { studentId, subjectId }
      });

      if (existing) {
        return res.status(400).json({ error: 'QR code already exists for this student and subject' });
      }

      // Generate unique QR code data
      const qrcodeData = `SNT-${studentId}-${subjectId}-${crypto.randomBytes(8).toString('hex')}`;

      // Generate QR code image as base64
      const qrcodeImage = await QRCode.toDataURL(qrcodeData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      const qrcode = await prisma.qRCode.create({
        data: {
          studentId,
          subjectId,
          qrcodeData,
          qrcodeImage
        },
        include: {
          student: {
            include: { class: true }
          },
          subject: true
        }
      });

      res.status(201).json(qrcode);
    } catch (error) {
      console.error('Generate QR code error:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  },

  // Generate bulk QR codes
  async generateBulk(req, res) {
    try {
      const { studentIds, subjectId } = req.body;

      const results = {
        success: [],
        failed: []
      };

      for (const studentId of studentIds) {
        try {
          // Check if QR code already exists
          const existing = await prisma.qRCode.findFirst({
            where: { studentId, subjectId }
          });

          if (existing) {
            results.failed.push({
              studentId,
              reason: 'QR code already exists'
            });
            continue;
          }

          // Generate unique QR code data
          const qrcodeData = `SNT-${studentId}-${subjectId}-${crypto.randomBytes(8).toString('hex')}`;

          // Generate QR code image as base64
          const qrcodeImage = await QRCode.toDataURL(qrcodeData, {
            width: 300,
            margin: 2
          });

          const qrcode = await prisma.qRCode.create({
            data: {
              studentId,
              subjectId,
              qrcodeData,
              qrcodeImage
            }
          });

          results.success.push(qrcode);
        } catch (err) {
          results.failed.push({
            studentId,
            reason: err.message
          });
        }
      }

      res.json({
        message: `Generated ${results.success.length} QR codes, ${results.failed.length} failed`,
        results
      });
    } catch (error) {
      console.error('Generate bulk QR codes error:', error);
      res.status(500).json({ error: 'Failed to generate QR codes' });
    }
  },

  // Scan QR code
  async scan(req, res) {
    try {
      const { qrcodeData } = req.body;

      const qrcode = await prisma.qRCode.findUnique({
        where: { qrcodeData },
        include: {
          student: {
            include: {
              class: {
                include: { grade: true }
              }
            }
          },
          subject: {
            include: {
              tasks: {
                where: { status: 'ACTIVE' },
                orderBy: { taskNumber: 'asc' }
              }
            }
          }
        }
      });

      if (!qrcode) {
        return res.status(404).json({ error: 'Invalid QR code' });
      }

      if (qrcode.status === 'INACTIVE') {
        return res.status(400).json({ error: 'QR code is inactive' });
      }

      // Get submissions for this student and subject
      const taskIds = qrcode.subject.tasks.map(t => t.id);
      const submissions = await prisma.submission.findMany({
        where: {
          studentId: qrcode.studentId,
          taskId: { in: taskIds }
        },
        include: {
          reviewedBy: true
        }
      });

      // Create submission map
      const submissionMap = {};
      submissions.forEach(s => {
        submissionMap[s.taskId] = s;
      });

      // Combine tasks with their submissions
      const tasksWithSubmissions = qrcode.subject.tasks.map(task => ({
        ...task,
        submission: submissionMap[task.id] || null
      }));

      res.json({
        student: qrcode.student,
        subject: {
          id: qrcode.subject.id,
          subjectCode: qrcode.subject.subjectCode,
          subjectName: qrcode.subject.subjectName
        },
        tasks: tasksWithSubmissions
      });
    } catch (error) {
      console.error('Scan QR code error:', error);
      res.status(500).json({ error: 'Failed to scan QR code' });
    }
  },

  // Get QR code by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const qrcode = await prisma.qRCode.findUnique({
        where: { id: parseInt(id) },
        include: {
          student: {
            include: { class: true }
          },
          subject: true
        }
      });

      if (!qrcode) {
        return res.status(404).json({ error: 'QR code not found' });
      }

      res.json(qrcode);
    } catch (error) {
      console.error('Get QR code error:', error);
      res.status(500).json({ error: 'Failed to fetch QR code' });
    }
  },

  // Get QR code image
  async getImage(req, res) {
    try {
      const { id } = req.params;

      const qrcode = await prisma.qRCode.findUnique({
        where: { id: parseInt(id) }
      });

      if (!qrcode || !qrcode.qrcodeImage) {
        return res.status(404).json({ error: 'QR code image not found' });
      }

      // Return the base64 image
      res.json({ image: qrcode.qrcodeImage });
    } catch (error) {
      console.error('Get QR code image error:', error);
      res.status(500).json({ error: 'Failed to fetch QR code image' });
    }
  },

  // Print QR codes for class
  async printForClass(req, res) {
    try {
      const { classId, subjectId } = req.params;

      const qrcodes = await prisma.qRCode.findMany({
        where: {
          subjectId: parseInt(subjectId),
          student: {
            classId: parseInt(classId)
          }
        },
        include: {
          student: true,
          subject: true
        },
        orderBy: { student: { studentCode: 'asc' } }
      });

      // Generate print-ready data
      const printData = qrcodes.map(qr => ({
        studentCode: qr.student.studentCode,
        studentName: qr.student.name,
        subjectName: qr.subject.subjectName,
        qrcodeImage: qr.qrcodeImage
      }));

      res.json(printData);
    } catch (error) {
      console.error('Print QR codes error:', error);
      res.status(500).json({ error: 'Failed to get print data' });
    }
  }
};

module.exports = qrcodeController;
