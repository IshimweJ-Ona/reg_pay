"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearTokens,
  decodeJwt,
  getMyProfile,
  login as loginRequest,
  logout as logoutRequest,
  refreshToken,
  registerUser,
  saveTokens,
} from '@/api/auth';
import { User, UserRole } from '@/types/auth';

type RegisterInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  password: string;
  gender: 'MALE' | 'FEMALE';
  working_location_id?: string;
  department_id?: string;
};

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  accessToken: string | null;
  refreshSession: (options?: { reload?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function isAdminRole(role?: string) {
  return [
    'SUPER_ADMIN',
    'ACCOUNTANT',
    'HR',
    'ATTENDANT',
    'HR_ADMIN',
    'HR_MANAGER',
    'FINANCE',
    'BRANCH_MANAGER',
  ].includes(role ?? '');
}

function mapJwtUser(token: string): User | null {
  const payload = decodeJwt(token);
  if (!payload) return null;

  const primaryRole = (payload.roles?.[0] ?? 'USER') as UserRole;
  return {
    id: payload.sub,
    uuid: payload.uuid ?? '',
    name: `${payload.first_name} ${payload.last_name}`.trim(),
    email: payload.email,
    role: primaryRole,
    roles: payload.roles ?? [primaryRole],
    status: (payload.status === 'ACTIVE' ? 'APPROVED' : payload.status) as any,
    permissions: payload.permissions ?? [],
    avatar_url: payload.avatar_url,
    department: payload.department_id ?? undefined,
    location: payload.working_location_id ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const applyProfile = (profileUser: any, fallback: User | null) => {
    setUser({
      id: fallback?.id ?? profileUser.id ?? profileUser.uuid,
      uuid: profileUser.uuid,
      name: `${profileUser.first_name} ${profileUser.last_name}`.trim(),
      email: profileUser.email,
      role: (profileUser.roles?.[0] ?? fallback?.role ?? 'USER') as UserRole,
      roles: profileUser.roles ?? fallback?.roles ?? ['USER'],
      status: (profileUser.status === 'ACTIVE' ? 'APPROVED' : profileUser.status) as any,
      avatar_url: profileUser.avatar_url,
      permissions: profileUser.permissions?.map((permission: any) => permission.key) ?? fallback?.permissions ?? [],
      department: profileUser.department?.name,
      location: profileUser.working_location?.name,
      createdAt: fallback?.createdAt ?? new Date().toISOString(),
    });
  };

  useEffect(() => {
    const loadUser = async () => {
      const token = sessionStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const payload = decodeJwt(token);
      if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
        clearTokens();
        setIsLoading(false);
        return;
      }

      setAccessToken(token);
      const tokenUser = mapJwtUser(token);
      setUser(tokenUser);

      try {
        const profile = await getMyProfile();
        const profileUser = profile?.profile;
        if (profileUser) {
          applyProfile(profileUser, tokenUser);
        }
      } catch {
        clearTokens();
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  // Token refresh 
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const refreshToken = sessionStorage.getItem('refreshToken');
        if (!refreshToken) return;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (res.ok) {
          const data = await res.json();
          saveTokens(data);
          setAccessToken(data.access_token);
        } else {
          // Refresh failed - Force logout
          clearTokens();
          setUser(null);
          setAccessToken(null);
          router.push('/auth/login');
        }
      } catch {
        // Network error
      }
    }, 13 * 60 * 1000); // every 13 minutes, before 15m access token expires

    return () => clearInterval(interval);
  }, [user]);

  const login = async (email: string, password: string) => {
    const response = await loginRequest({ identifier: email, password });
    saveTokens(response);
    setAccessToken(response.access_token);
    const nextUser = mapJwtUser(response.access_token);
    setUser(nextUser);
    
    router.push(response.redirectUrl);
  };

  const register = async (input: RegisterInput) => {
    await registerUser(input);
  };

  const logout = async () => {
    const refreshToken = sessionStorage.getItem('refreshToken');
    try {
      if (refreshToken) await logoutRequest(refreshToken);
    } catch {
      // Token cleanup still happens locally if the server session is already gone.
    }
    clearTokens();
    setUser(null);
    setAccessToken(null);
    router.push('/auth/login');
  };

  const refreshSession = async (options?: { reload?: boolean }) => {
    const currentRefreshToken = sessionStorage.getItem('refreshToken');
    if (currentRefreshToken) {
      const tokens = await refreshToken(currentRefreshToken);
      saveTokens(tokens);
      setAccessToken(tokens.access_token);
    }

    const profile = await getMyProfile();
    if (profile?.profile) {
      applyProfile(profile.profile, user);
    }

    if (options?.reload) {
      window.location.reload();
    }
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.roles?.some((role) => ['SUPER_ADMIN'].includes(role))) return true;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading, hasPermission, accessToken, refreshSession }}>
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
