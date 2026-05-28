import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('cxr_token');
    setUser(null);
  }, []);

  // Verify token on mount
  useEffect(() => {
    const token = localStorage.getItem('cxr_token');
    if (!token) { setLoading(false); return; }
    auth.me()
      .then(data => setUser(data.user))
      .catch(() => { localStorage.removeItem('cxr_token'); })
      .finally(() => setLoading(false));
  }, []);

  // Listen for 401 dispatched by fetchJson
  useEffect(() => {
    window.addEventListener('cxr:logout', logout);
    return () => window.removeEventListener('cxr:logout', logout);
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const data = await auth.login(username, password);
    localStorage.setItem('cxr_token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
