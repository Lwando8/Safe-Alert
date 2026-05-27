import React, { createContext, useContext, ReactNode } from 'react';
import type { UserRole } from '../types/auth';

interface AuthContextType {
  userRole: UserRole | null;
  signIn: (role: UserRole) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  userRole: UserRole | null;
  signIn: (role: UserRole) => void;
  signOut: () => void;
}

export function AuthProvider({ children, userRole, signIn, signOut }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ userRole, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
