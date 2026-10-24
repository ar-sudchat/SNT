import axios from 'axios';
import api from './api';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Public client: no auth interceptor, never sends the staff token.
const publicClient = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

export const parentAPI = {
  createLink: (studentId) => api.post('/parent-links', { studentId }),
  getPublic: (token) => publicClient.get(`/public/parent/${encodeURIComponent(token)}`),
};

export default parentAPI;
