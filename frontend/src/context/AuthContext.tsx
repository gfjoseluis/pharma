import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';
import { hasAction } from '../perms';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  branchId: number | null;
  permissions: string[];
  branch?: { id: number; name: string; type: string } | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPerm: (module: string) => boolean;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const hasPerm = (action: string) =>
    user ? user.role === 'admin' || hasAction(user.permissions, action) : false;

  return <Ctx.Provider value={{ user, loading, login, logout, hasPerm }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
