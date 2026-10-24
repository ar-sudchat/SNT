import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

// Where to send a user after login (every account has a group, so tid is never null).
export const homePathFor = (u) => {
  if (!u) return '/login';
  return u.role === 'ADMIN' ? '/admin' : u.role === 'STUDENT' ? '/student' : '/teacher';
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await api.get('/auth/me');
        setUser(response.data);
      }
    } catch (error) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password, slug) => {
    const response = await api.post('/auth/login', slug ? { username, password, slug } : { username, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
    // login response is slim; fetch full profile (avatar, display name) in background
    api.get('/auth/me').then(r => setUser(r.data)).catch(() => {});
    return user;
  };

  // Store a token obtained elsewhere (Google callback, switch-tenant) and load the profile.
  const loginWithToken = async (token) => {
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const r = await api.get('/auth/me');
    setUser(r.data);
    return r.data;
  };

  const loginWithEmail = async (email, password) => {
    const { data } = await api.post('/auth/login/email', { email, password });
    return loginWithToken(data.token);
  };

  const switchTenant = async (tenantId) => {
    const { data } = await api.post('/auth/switch-tenant', { tenantId });
    return loginWithToken(data.token);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    login,
    loginWithToken,
    loginWithEmail,
    switchTenant,
    logout,
    checkAuth,
    updateUser: (patch) => setUser(u => (u ? { ...u, ...patch } : u))
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
