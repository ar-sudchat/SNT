const Joi = require('joi');

// Generic validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({ errors });
    }

    req.body = value;
    next();
  };
};

// Validation schemas
const schemas = {
  // Auth schemas
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('ADMIN', 'TEACHER', 'STUDENT').required(),
    teacherId: Joi.number().integer().optional(),
    studentId: Joi.number().integer().optional()
  }),

  // Grade schemas
  grade: Joi.object({
    gradeName: Joi.string().max(50).required(),
    description: Joi.string().max(255).optional().allow(''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE')
  }),

  // Class schemas
  class: Joi.object({
    className: Joi.string().max(50).required(),
    gradeId: Joi.number().integer().required(),
    teacherId: Joi.number().integer().optional().allow(null),
    academicYear: Joi.string().max(10).required(),
    capacity: Joi.number().integer().min(1).default(40),
    description: Joi.string().max(255).optional().allow(''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE')
  }),

  // Student schemas
  student: Joi.object({
    studentCode: Joi.string().max(20).required(),
    name: Joi.string().max(100).required(),
    classId: Joi.number().integer().required(),
    email: Joi.string().email().optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE')
  }),

  // Teacher schemas
  teacher: Joi.object({
    teacherCode: Joi.string().max(20).required(),
    name: Joi.string().max(100).required(),
    email: Joi.string().email().optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE')
  }),

  // Subject schemas
  subject: Joi.object({
    subjectCode: Joi.string().max(20).required(),
    subjectName: Joi.string().max(100).required(),
    teacherId: Joi.number().integer().required(),
    description: Joi.string().max(255).optional().allow(''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE')
  }),

  // Task schemas
  task: Joi.object({
    subjectId: Joi.number().integer().required(),
    taskName: Joi.string().max(100).required(),
    taskNumber: Joi.number().integer().min(1).max(100).required(),
    description: Joi.string().max(500).optional().allow(''),
    deadline: Joi.date().iso().optional().allow(null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE')
  }),

  // Submission schemas
  submission: Joi.object({
    studentId: Joi.number().integer().required(),
    taskId: Joi.number().integer().required(),
    status: Joi.string().valid('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED').required(),
    notes: Joi.string().max(500).optional().allow('')
  }),

  // QR Code generation
  qrcode: Joi.object({
    studentId: Joi.number().integer().required(),
    subjectId: Joi.number().integer().required()
  }),

  // Bulk QR Code generation
  qrcodeBulk: Joi.object({
    studentIds: Joi.array().items(Joi.number().integer()).required(),
    subjectId: Joi.number().integer().required()
  })
};

module.exports = {
  validate,
  schemas
};
