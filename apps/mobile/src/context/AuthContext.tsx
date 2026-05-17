import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import { AppUser, UserRole } from '../types/roles';

type AuthContextValue = {
  user: AppUser;
  isAuthenticated: boolean;
  signIn: (payload: { name?: string; email?: string }) => void;
  signOut: () => void;
  setActiveRole: (role: UserRole) => void;
};

const defaultUser: AppUser = {
  id: 1,
  name: 'ELS User',
  email: 'user@els.ai',
  roles: ['student', 'teacher', 'parent'],
  activeRole: 'student',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AppUser>(defaultUser);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const signIn = ({ name, email }: { name?: string; email?: string }) => {
    setUser((prev) => ({
      ...prev,
      name: name?.trim() || prev.name,
      email: email?.trim() || prev.email,
    }));
    setIsAuthenticated(true);
  };

  const signOut = () => {
    setIsAuthenticated(false);
  };

  const setActiveRole = (role: UserRole) => {
    setUser((prev) => {
      if (!prev.roles.includes(role)) {
        return prev;
      }

      return { ...prev, activeRole: role };
    });
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      signIn,
      signOut,
      setActiveRole,
    }),
    [isAuthenticated, user],
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
