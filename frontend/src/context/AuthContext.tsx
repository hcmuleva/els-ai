import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { AppUser, UserRole } from '../types/roles';
import { getStorageItem, setStorageItem, deleteStorageItem } from '../utils/storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000';

type AuthContextValue = {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (payload: { firstName: string; lastName: string; email: string; password?: string; role: UserRole }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  setActiveRole: (role: UserRole) => Promise<void>;
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Helper: Get cached tokens
  const getAccessToken = async () => getStorageItem('accessToken');
  const getRefreshToken = async () => getStorageItem('refreshToken');

  // Load profile on start
  useEffect(() => {
    async function loadUser() {
      try {
        const cachedUser = await getStorageItem('user');
        const token = await getAccessToken();
        if (cachedUser && token) {
          const parsed = JSON.parse(cachedUser);
          setUser(parsed);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.warn('Failed to load user state', e);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  // Authenticated fetch wrapper with automatic token refresh rotation
  const apiFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
    let token = await getAccessToken();
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const fetchOptions = { ...options, headers };
    let response = await fetch(`${API_BASE_URL}${path}`, fetchOptions);

    // If unauthorized, attempt to refresh token
    if (response.status === 401) {
      const refresh = await getRefreshToken();
      if (refresh) {
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: refresh }),
          });

          if (refreshResponse.ok) {
            const tokens = await refreshResponse.json();
            await setStorageItem('accessToken', tokens.accessToken);
            await setStorageItem('refreshToken', tokens.refreshToken);

            // Retry original request with new token
            headers.set('Authorization', `Bearer ${tokens.accessToken}`);
            response = await fetch(`${API_BASE_URL}${path}`, fetchOptions);
          } else {
            // Refresh token invalid/revoked
            await cleanAuth();
          }
        } catch (e) {
          console.warn('Token refresh failed', e);
          await cleanAuth();
        }
      } else {
        await cleanAuth();
      }
    }

    return response;
  };

  const cleanAuth = async () => {
    await deleteStorageItem('accessToken');
    await deleteStorageItem('refreshToken');
    await deleteStorageItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const signIn = async (email: string, password = 'welcome') => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json();
        return { success: false, error: err.message || 'Login failed' };
      }

      const data = await res.json();
      await setStorageItem('accessToken', data.accessToken);
      await setStorageItem('refreshToken', data.refreshToken);
      await setStorageItem('user', JSON.stringify(data.user));

      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error connection' };
    }
  };

  const signUp = async (payload: { firstName: string; lastName: string; email: string; password?: string; role: UserRole }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          password: payload.password || 'welcome',
          role: payload.role,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        return { success: false, error: err.message || 'Registration failed' };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error connection' };
    }
  };

  const signOut = async () => {
    await cleanAuth();
  };

  const setActiveRole = async (role: UserRole) => {
    if (!user) return;
    try {
      const res = await apiFetch(`/users/${user.id}/active-role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        await setStorageItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      } else {
        console.warn('Failed to update active role on backend');
      }
    } catch (e) {
      console.warn('Network error setting active role', e);
    }
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      signIn,
      signUp,
      signOut,
      setActiveRole,
      apiFetch,
    }),
    [isAuthenticated, isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
