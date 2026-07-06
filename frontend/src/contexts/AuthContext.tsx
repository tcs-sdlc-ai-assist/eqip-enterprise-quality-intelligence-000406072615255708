import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { User } from '@/types';
import apiClient from '@/api/client';

// ---------------------------------------------------------------------------
// Auth context — single source of truth for the current user session.
// Token is stored in localStorage('authToken'); user object in ('authUser').
// The axios client interceptor (api/client.ts) reads 'authToken' for every
// request, so we only manage state + persistence here.
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'authToken';
const REFRESH_KEY = 'refreshToken';
const USER_KEY = 'authUser';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ---- Bootstrap: restore session from localStorage on mount ----
  useEffect(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (token && storedUser) {
        const parsed: User = JSON.parse(storedUser);
        setUser(parsed);
      }
    } catch {
      // Corrupted storage — clear and start fresh
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ---- Login ----
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await apiClient.post<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: User;
    }>('/auth/login', { email, password });

    const { access_token, refresh_token, user: loggedInUser } = response.data;

    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(REFRESH_KEY, refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(loggedInUser));

    setUser(loggedInUser);
  }, []);

  // ---- Logout ----
  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);

    // Fire-and-forget — clear local state regardless of server response
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);

    if (refreshToken) {
      try {
        await apiClient.post('/auth/logout', { refresh_token: refreshToken });
      } catch {
        // Server-side invalidation is best-effort; session is already cleared
      }
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
