"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, UserRole } from '@/types/auth';
import { PERMISSIONS } from '@/lib/permissions';

interface AuthContextType {
  user: User | null;
  login: (email: string, role: UserRole) => void;
  logout: () => void;
  updateUserPermissions: (userId: string, permissions: string[]) => void;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('reg_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, role: UserRole) => {
    // Determine initial permissions based on role
    // SUPER_ADMIN and ADMIN bypass the permission system and get everything
    // Everyone else (USER, HR_ADMIN) starts with an empty array until an admin assigns them
    const initialPermissions = ['SUPER_ADMIN', 'ADMIN'].includes(role) 
      ? Object.values(PERMISSIONS).flat() 
      : [];

    const mockUser: User = {
      id: Math.random().toString(36).substring(7),
      name: email.split('@')[0].toUpperCase(),
      email,
      role,
      status: role === 'USER' ? 'PENDING' : 'APPROVED',
      permissions: initialPermissions,
      avatar: `https://picsum.photos/seed/${email}/100/100`,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem('reg_user', JSON.stringify(mockUser));
    setUser(mockUser);

    if (['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN'].includes(role)) {
      router.push('/admin');
    } else {
      router.push('/users');
    }
  };

  const logout = () => {
    localStorage.removeItem('reg_user');
    setUser(null);
    router.push('/login');
  };

  const updateUserPermissions = (userId: string, newPermissions: string[]) => {
    if (user && user.id === userId) {
      const updated = { ...user, permissions: newPermissions };
      setUser(updated);
      localStorage.setItem('reg_user', JSON.stringify(updated));
    }
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    
    // Admins bypass all checks and have absolute access
    if (['SUPER_ADMIN', 'ADMIN'].includes(user.role)) return true;
    
    const userPerms = user.permissions || [];

    // Derived logic: payroll.create implies access to employee modules
    // This only triggers if the user was explicitly given 'payroll.create'
    if (userPerms.includes('payroll.create')) {
      const employeePerms = [
        'employees.read', 
        'employees.create', 
        'employees.update', 
        'payment-structures.read'
      ];
      if (employeePerms.includes(permission)) return true;
    }

    // Derived logic: branches.manage often implies departments.manage
    if (userPerms.includes('branches.manage') && permission === 'departments.manage') {
      return true;
    }

    return userPerms.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUserPermissions, isLoading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
