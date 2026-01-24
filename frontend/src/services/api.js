import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
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
  changePassword: (data) => api.put('/auth/change-password', data)
};

export const gradeAPI = {
  getAll: () => api.get('/grades'),
  getById: (id) => api.get(`/grades/${id}`),
  create: (data) => api.post('/grades', data),
  update: (id, data) => api.put(`/grades/${id}`, data),
  delete: (id) => api.delete(`/grades/${id}`)
};

export const classAPI = {
  getAll: (params) => api.get('/classes', { params }),
  getById: (id) => api.get(`/classes/${id}`),
  getStudents: (id) => api.get(`/classes/${id}/students`),
  create: (data) => api.post('/classes', data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  delete: (id) => api.delete(`/classes/${id}`)
};

export const studentAPI = {
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
  downloadTemplate: (type) => api.get(`/import/templates/${type}`, { responseType: 'blob' }),
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
  teacherSubjects: () => api.get('/reports/teacher/subjects'),
  subjectSummary: (id) => api.get(`/reports/teacher/subject/${id}`),
  studentSummary: (id) => api.get(`/reports/teacher/student/${id}`),
  studentSubmissions: () => api.get('/reports/student/my-submissions'),
  exportReport: (type, params) => api.get(`/reports/export/${type}`, { params, responseType: 'blob' })
};
