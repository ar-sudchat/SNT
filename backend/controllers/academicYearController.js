const prisma = require('../config/database');

const academicYearController = {
  // Get all academic years
  async getAll(req, res) {
    try {
      const academicYears = await prisma.academicYear.findMany({
        include: {
          _count: {
            select: {
              classes: true,
              subjects: true
            }
          }
        },
        orderBy: { year: 'desc' }
      });

      res.json(academicYears);
    } catch (error) {
      console.error('Get academic years error:', error);
      res.status(500).json({ error: 'Failed to fetch academic years' });
    }
  },

  // Get current academic year
  async getCurrent(req, res) {
    try {
      const currentYear = await prisma.academicYear.findFirst({
        where: { isCurrent: true },
        include: {
          _count: {
            select: {
              classes: true,
              subjects: true
            }
          }
        }
      });

      if (!currentYear) {
        return res.status(404).json({ error: 'No current academic year set' });
      }

      res.json(currentYear);
    } catch (error) {
      console.error('Get current academic year error:', error);
      res.status(500).json({ error: 'Failed to fetch current academic year' });
    }
  },

  // Get academic year by ID
  async getById(req, res) {
    try {
      const { id } = req.params;

      const academicYear = await prisma.academicYear.findUnique({
        where: { id: parseInt(id) },
        include: {
          classes: {
            include: {
              grade: true,
              homeTeacher: true,
              _count: {
                select: { students: true }
              }
            }
          },
          subjects: {
            include: {
              teacher: true,
              _count: {
                select: { tasks: true }
              }
            }
          }
        }
      });

      if (!academicYear) {
        return res.status(404).json({ error: 'Academic year not found' });
      }

      res.json(academicYear);
    } catch (error) {
      console.error('Get academic year error:', error);
      res.status(500).json({ error: 'Failed to fetch academic year' });
    }
  },

  // Create academic year
  async create(req, res) {
    try {
      const { year, name, startDate, endDate, isCurrent, status } = req.body;

      // Check if year already exists
      const existingYear = await prisma.academicYear.findUnique({
        where: { year }
      });

      if (existingYear) {
        return res.status(400).json({ error: 'Academic year already exists' });
      }

      // If setting as current, unset all other current years
      if (isCurrent) {
        await prisma.academicYear.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false }
        });
      }

      const academicYear = await prisma.academicYear.create({
        data: {
          year,
          name: name || `ปีการศึกษา ${year}`,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          isCurrent,
          status
        }
      });

      res.status(201).json(academicYear);
    } catch (error) {
      console.error('Create academic year error:', error);
      res.status(500).json({ error: 'Failed to create academic year' });
    }
  },

  // Update academic year
  async update(req, res) {
    try {
      const { id } = req.params;
      const { year, name, startDate, endDate, isCurrent, status } = req.body;

      // Check if year already exists (excluding current record)
      const existing = await prisma.academicYear.findFirst({
        where: {
          year,
          NOT: { id: parseInt(id) }
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Academic year already exists' });
      }

      // If setting as current, unset all other current years
      if (isCurrent) {
        await prisma.academicYear.updateMany({
          where: {
            isCurrent: true,
            NOT: { id: parseInt(id) }
          },
          data: { isCurrent: false }
        });
      }

      const academicYear = await prisma.academicYear.update({
        where: { id: parseInt(id) },
        data: {
          year,
          name,
          startDate: startDate ? new Date(startDate) : null,
          endDate: endDate ? new Date(endDate) : null,
          isCurrent,
          status
        }
      });

      res.json(academicYear);
    } catch (error) {
      console.error('Update academic year error:', error);
      res.status(500).json({ error: 'Failed to update academic year' });
    }
  },

  // Set current academic year
  async setCurrent(req, res) {
    try {
      const { id } = req.params;

      // Unset all current years
      await prisma.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false }
      });

      // Set this year as current
      const academicYear = await prisma.academicYear.update({
        where: { id: parseInt(id) },
        data: { isCurrent: true }
      });

      res.json(academicYear);
    } catch (error) {
      console.error('Set current academic year error:', error);
      res.status(500).json({ error: 'Failed to set current academic year' });
    }
  },

  // Delete academic year
  async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if academic year has classes or subjects
      const classCount = await prisma.class.count({
        where: { academicYearId: parseInt(id) }
      });

      const subjectCount = await prisma.subject.count({
        where: { academicYearId: parseInt(id) }
      });

      if (classCount > 0 || subjectCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete academic year with existing classes or subjects'
        });
      }

      await prisma.academicYear.delete({
        where: { id: parseInt(id) }
      });

      res.json({ message: 'Academic year deleted successfully' });
    } catch (error) {
      console.error('Delete academic year error:', error);
      res.status(500).json({ error: 'Failed to delete academic year' });
    }
  }
};

module.exports = academicYearController;
