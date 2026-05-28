import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing session on mount (cookie sent automatically)
  useEffect(() => {
    auth.me()
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await auth.login(username, password);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await auth.logout(); } catch (_) {}
    setUser(null);
  }, []);

  // Listen for 401 events dispatched by fetchJson
  useEffect(() => {
    const handle = () => setUser(null);
    window.addEventListener('cxr:logout', handle);
    return () => window.removeEventListener('cxr:logout', handle);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
