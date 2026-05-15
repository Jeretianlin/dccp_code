import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { getApiUrl } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken);
    } else {
      setLoading(false);
    }
    
    return () => {
      (window as any).electron?.stopScheduler?.();
    };
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const apiUrl = await getApiUrl();
      const response = await axios.get(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data.data);
      
      await (window as any).electron?.startScheduler?.(token);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const apiUrl = await getApiUrl();
    const response = await axios.post(`${apiUrl}/auth/login`, { email, password });
    const { user, token } = response.data.data;
    setUser(user);
    setToken(token);
    localStorage.setItem('token', token);
    
    await (window as any).electron?.startScheduler?.(token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    (window as any).electron?.stopScheduler?.();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}