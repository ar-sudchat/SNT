import axios from 'axios';

// Own axios instance: the shared `api` redirects to /login on any 401, which would
// swallow wrong-password messages on these public pages.
const base = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
const http = axios.create({ baseURL: base, headers: { 'Content-Type': 'application/json' } });
http.interceptors.request.use((c) => {
  const t = localStorage.getItem('token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

export const errMsg = (e, fallback = 'ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง') => e?.response?.data?.error || fallback;

export const inviteAPI = {
  list: () => http.get('/invites'),
  create: (data) => http.post('/invites', data),
  remove: (id) => http.delete(`/invites/${id}`),
  preview: (token) => http.get(`/invites/${token}`),
  accept: (token, data) => http.post(`/invites/${token}/accept`, data || {}),
};

export const groupsAPI = {
  signup: (data) => http.post('/auth/signup', data),
  loginEmail: (data) => http.post('/auth/login/email', data),
  config: () => http.get('/auth/config'),
  join: (code) => http.post('/groups/join', { code }),
};

export const googleHref = `${base}/auth/google`;

// Join codes look like ABC-123; accept any case / missing dash.
export const normalizeCode = (v) => {
  const c = (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
};
