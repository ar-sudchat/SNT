import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // รหัสผิดตอนล็อกอินก็ได้ 401 เหมือนกัน — อย่า redirect ไม่งั้นข้อความแจ้งเตือนในหน้า login หาย
    const isLoginRequest = (error.config?.url || '').includes('/auth/login');
    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    // แปลงข้อความ error ภาษาอังกฤษจาก backend เป็นไทยสำหรับแสดงผล
    const res = error.response;
    if (res && !(res.data instanceof Blob)) {
      if (!res.data || typeof res.data !== 'object') res.data = {};
      const data = res.data;
      {
        const msg = typeof data.error === 'string' ? data.error : '';
        const isThai = /[\u0E00-\u0E7F]/.test(msg);
        const map = {
          'Admin access required.': 'เฉพาะผู้ดูแลระบบ',
          'Access denied.': 'คุณไม่มีสิทธิ์ทำรายการนี้',
          'Insufficient permissions.': 'คุณไม่มีสิทธิ์ทำรายการนี้'
        };
        if (map[msg]) data.error = map[msg];
        else if (!isThai) {
          if (res.status === 403) data.error = /admin/i.test(msg) ? 'เฉพาะผู้ดูแลระบบ' : 'คุณไม่มีสิทธิ์ทำรายการนี้';
          else if (res.status >= 500) data.error = 'ระบบขัดข้อง ลองใหม่อีกครั้ง';
        }
        if (msg && data.error !== msg) data.originalError = msg;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// API helper functions
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
  updateProfile: (data) => api.put('/auth/profile', data),
  profileStats: () => api.get('/auth/profile/stats')
};

export const academicYearAPI = {
  getAll: () => api.get('/academic-years'),
  getCurrent: () => api.get('/academic-years/current'),
  getById: (id) => api.get(`/academic-years/${id}`),
  create: (data) => api.post('/academic-years', data),
  update: (id, data) => api.put(`/academic-years/${id}`, data),
  setCurrent: (id) => api.put(`/academic-years/${id}/set-current`),
  delete: (id) => api.delete(`/academic-years/${id}`)
};

export const gradeAPI = {
  // Many at once (one request): { created, skipped } / { deleted, failed }
  bulkCreate: (items) => api.post('/grades/bulk', { items }),
  bulkDelete: (ids) => api.post('/grades/bulk-delete', { ids }),

  getAll: () => api.get('/grades'),
  getById: (id) => api.get(`/grades/${id}`),
  create: (data) => api.post('/grades', data),
  update: (id, data) => api.put(`/grades/${id}`, data),
  delete: (id) => api.delete(`/grades/${id}`)
};

export const classAPI = {
  // Many at once (one request): { created, skipped } / { deleted, failed }
  bulkCreate: (items) => api.post('/classes/bulk', { items }),
  bulkDelete: (ids) => api.post('/classes/bulk-delete', { ids }),

  getAll: (params) => api.get('/classes', { params }),
  getById: (id) => api.get(`/classes/${id}`),
  getStudents: (id) => api.get(`/classes/${id}/students`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  delete: (id) => api.delete(`/classes/${id}`)
};

export const studentAPI = {
  // Many at once (one request): { created, skipped } / { deleted, failed }
  bulkDelete: (ids) => api.post('/students/bulk-delete', { ids }),

  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  getSubmissions: (id, params) => api.get(`/students/${id}/submissions`, { params }),
  create: (data) => api.post('/students', data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`)
};

export const teacherAPI = {
  getAll: (params) => api.get('/teachers', { params }),
  getById: (id) => api.get(`/teachers/${id}`),
  getSubjects: (id) => api.get(`/teachers/${id}/subjects`),
  create: (data) => api.post('/teachers', data),
  update: (id, data) => api.put(`/teachers/${id}`, data),
  delete: (id) => api.delete(`/teachers/${id}`)
};

export const subjectAPI = {
  // Many at once (one request): { created, skipped } / { deleted, failed }
  bulkCreate: (items) => api.post('/subjects/bulk', { items }),
  bulkDelete: (ids) => api.post('/subjects/bulk-delete', { ids }),

  getAll: (params) => api.get('/subjects', { params }),
  getById: (id) => api.get(`/subjects/${id}`),
  getTasks: (id) => api.get(`/subjects/${id}/tasks`),
  create: (data) => api.post('/subjects', data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`)
};

export const taskAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  getById: (id) => api.get(`/tasks/${id}`),
  getSubmissions: (id) => api.get(`/tasks/${id}/submissions`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`)
};

export const qrcodeAPI = {
  generate: (data) => api.post('/qrcodes/generate', data),
  generateBulk: (data) => api.post('/qrcodes/generate-bulk', data),
  scan: (data) => api.post('/qrcodes/scan', data),
  searchByStudent: (data) => api.post('/qrcodes/search-student', data),
  getById: (id) => api.get(`/qrcodes/${id}`),
  getImage: (id) => api.get(`/qrcodes/${id}/image`),
  printForClass: (classId, subjectId) => api.get(`/qrcodes/print/class/${classId}/subject/${subjectId}`)
};

export const submissionAPI = {
  getAll: (params) => api.get('/submissions', { params }),
  getById: (id) => api.get(`/submissions/${id}`),
  createOrUpdate: (data) => api.post('/submissions', data),
  bulkUpdate: (data) => api.post('/submissions/bulk', data)
};

export const importAPI = {
  smartPreview: (file, { mapping, defaultClass, headerRow } = {}) => {
    const data = new FormData();
    data.append('file', file);
    if (mapping !== undefined) data.append('mapping', JSON.stringify(mapping));
    if (defaultClass !== undefined) data.append('defaultClass', defaultClass);
    if (headerRow !== undefined) data.append('headerRow', headerRow);
    return api.post('/import/smart/preview', data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 90000 });
  },
  smartCommit: students => api.post('/import/smart/commit', { students }, { timeout: 120000 }),
  downloadTemplate: (type) => api.get(`/import/templates/${type}`, { responseType: 'blob' }),
  importAcademicYears: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/academic-years', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importGrades: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/grades', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importClasses: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/classes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importStudents: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/students', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importTeachers: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/teachers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importSubjects: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/subjects', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  importTasks: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/tasks', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  validate: (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/import/validate?type=${type}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};

export const reportAPI = {
  adminOverview: () => api.get('/reports/admin/overview'),
  adminStatistics: () => api.get('/reports/admin/statistics'),
  teacherOverview: () => api.get('/reports/teacher/overview'),
  teacherStatistics: () => api.get('/reports/teacher/statistics'),
  teacherSubjects: () => api.get('/reports/teacher/subjects'),
  subjectSummary: (id) => api.get(`/reports/teacher/subject/${id}`),
  studentSummary: (id) => api.get(`/reports/teacher/student/${id}`),
  studentSubmissions: () => api.get('/reports/student/my-submissions'),
  exportReport: (type, params) => api.get(`/reports/export/${type}`, { params, responseType: 'blob' })
};

export const transferAPI = {
  transferStudent: (data) => api.post('/transfer/student', data),
  transferBulk: (data) => api.post('/transfer/bulk', data),
  promoteStudents: (data) => api.post('/transfer/promote', data),
  getPromotionPreview: (fromYearId, toYearId) =>
    api.get('/transfer/promotion-preview', { params: { fromAcademicYearId: fromYearId, toAcademicYearId: toYearId } })
};

export const monitorAPI = {
  // Parse QR code data
  parseQR: (qrData) => api.post('/monitor/parse-qr', { qrData }),
  // Get student monitor data (all subjects + progress)
  getStudentMonitor: (studentId, params) => api.get(`/monitor/student/${studentId}`, { params }),
  // Get class monitor data (all students + progress)
  getClassMonitor: (classId, params) => api.get(`/monitor/class/${classId}`, { params }),
  // Get subject monitor data (all students in subject + their submissions)
  getSubjectMonitor: (subjectId, params) => api.get(`/monitor/subject/${subjectId}`, { params }),
  // Get subject tasks for a specific student
  getSubjectTasks: (studentId, subjectId) => api.get(`/monitor/student/${studentId}/subject/${subjectId}`)
};

// AI assistant (การเรียก AI อาจใช้เวลานานถึง 60 วินาที)
const AI_TIMEOUT = 65000;
export const aiAPI = {
  status: () => api.get('/ai/status'),
  ask: (data) => api.post('/ai/ask', data, { timeout: AI_TIMEOUT }),
  conversations: () => api.get('/ai/conversations'),
  conversation: (id) => api.get(`/ai/conversations/${id}`),
  deleteConversation: (id) => api.delete(`/ai/conversations/${id}`),
  report: (data) => api.post('/ai/report', data, { timeout: AI_TIMEOUT }),
  importHelp: (data) => api.post('/ai/import-help', data, { timeout: AI_TIMEOUT }),
  draftTask: (data) => api.post('/ai/draft-task', data, { timeout: AI_TIMEOUT })
};

// บันทึกหลังแผน — contract: docs/LESSON-LOG.md
export const assessmentAPI = {
  templates: () => api.get('/assessments/templates'),
  createTemplate: (data) => api.post('/assessments/templates', data),
  updateTemplate: (id, data) => api.put(`/assessments/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/assessments/templates/${id}`),
  settings: () => api.get('/assessments/settings'),
  saveSettings: (data) => api.put('/assessments/settings', data),
  records: (params) => api.get('/assessments/records', { params }),
  createRecord: (data) => api.post('/assessments/records', data),
  record: (id) => api.get(`/assessments/records/${id}`),
  updateRecord: (id, data) => api.put(`/assessments/records/${id}`, data),
  saveScores: (id, scores) => api.put(`/assessments/records/${id}/scores`, { scores }),
  deleteRecord: (id) => api.delete(`/assessments/records/${id}`),
  fillFromTask: (id, data) => api.post(`/assessments/records/${id}/fill-from-task`, data),
  summary: (params) => api.get('/assessments/summary', { params }),
  exportDocx: (ids) => api.get('/assessments/export', { params: { ids: ids.join(',') }, responseType: 'blob', timeout: 120000 })
};

export const tenantAPI = {
  memberships: () => api.get('/auth/memberships'),
  switchTenant: (tenantId) => api.post('/auth/switch-tenant', { tenantId })
};

// PDPA: ข้อมูลและการลบของโรงเรียน (เจ้าของเท่านั้น)
export const tenantDataAPI = {
  status: () => api.get('/tenant/status'),
  exportData: () => api.get('/tenant/export', { responseType: 'blob' }),
  deleteRequest: (confirm) => api.post('/tenant/delete-request', { confirm }),
  deleteCancel: () => api.post('/tenant/delete-cancel'),
  audit: (page = 1, limit = 20) => api.get('/tenant/audit', { params: { page, limit } })
};

export const planAPI = {
  get: () => api.get('/plan'),
  upgrade: () => api.post('/plan/upgrade')
};

// Groups (กลุ่ม) management for signed-in users. Public signup/login/join helpers live in pages/signup/client.js.
export const groupAPI = {
  get: (id) => api.get(`/groups/${id}`),
  create: (name) => api.post('/groups', { name }),
  members: (id) => api.get(`/groups/${id}/members`),
  rotateCode: (id) => api.post(`/groups/${id}/join-code/rotate`),
  removeMember: (id, userId) => api.delete(`/groups/${id}/members/${userId}`),
  rename: (id, name) => api.patch(`/groups/${id}`, { name })
};
