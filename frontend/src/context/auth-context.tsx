"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearTokens,
  decodeJwt,
  getMyProfile,
  login as loginRequest,
  logout as logoutRequest,
  refreshToken as refreshTokenRequest,
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
  refreshPermissions: () => Promise<void>;
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

function normalizeRole(role: unknown): string {
  if (typeof role === 'string') return role;
  if (role && typeof role === 'object') {
    const r = role as { key?: string; name?: string };
    return r.key ?? r.name ?? 'USER';
  }
  return 'USER';
}

function mapJwtUser(token: string): User | null {
  const payload = decodeJwt(token);
  if (!payload) return null;

  const rawRoles: unknown[] = payload.roles ?? [];
  const normalizedRoles = rawRoles.map(normalizeRole);
  const primaryRole = (normalizedRoles[0] ?? 'USER') as UserRole;
  return {
    id: payload.sub,
    uuid: payload.uuid ?? '',
    name: `${payload.first_name} ${payload.last_name}`.trim(),
    email: payload.email,
    role: primaryRole,
    roles: normalizedRoles,
    status: (payload.status === 'ACTIVE' ? 'APPROVED' : payload.status) as any,
    permissions: payload.permissions ?? [],
    avatar_url: payload.avatar_url,
    department_id: payload.department_id ?? undefined,
    location_id: payload.working_location_id ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const applyProfile = (profileUser: any, fallback: User | null) => {
    const rawRoles: unknown[] = profileUser.roles ?? [];
    const normalizedRoles = rawRoles.map(normalizeRole);
    const primaryRole = (normalizedRoles[0] ?? fallback?.role ?? 'USER') as UserRole;
    setUser({
      id: fallback?.id ?? profileUser.id ?? profileUser.uuid,
      uuid: profileUser.uuid,
      name: `${profileUser.first_name} ${profileUser.last_name}`.trim(),
      email: profileUser.email,
      role: primaryRole,
      roles: normalizedRoles,
      status: (profileUser.status === 'ACTIVE' ? 'APPROVED' : profileUser.status) as any,
      avatar_url: profileUser.avatar_url,
      // If the profile endpoint returns an empty permissions array, fall back to the
      // JWT-derived permissions instead of wiping them out. `[].map(...)` returns `[]`,
      // which is truthy, so a plain `??` fallback never fires for an empty array -
      // we need an explicit length check here.
      permissions: profileUser.permissions?.length
        ? profileUser.permissions.map((permission: any) => permission.key)
        : fallback?.permissions ?? [],
      department: profileUser.department?.name,
      location: profileUser.working_location?.name,
      department_id: profileUser.department?.uuid ?? fallback?.department_id,
      location_id: profileUser.working_location?.uuid ?? fallback?.location_id,
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
  // Uses the shared, mutex-guarded refreshTokenRequest() from api/auth.ts so
  // this timer can never race against refreshSession() or an axios 401
  // interceptor WITHIN THIS TAB - they all collapse into a single in-flight
  // request. This is intentionally per-tab only: sessionStorage keeps each
  // tab's session fully isolated (so different accounts/roles can be open
  // side by side, like Instagram's multi-account tabs). If a tab was
  // created by duplicating an already-open tab, it briefly shares the same
  // refresh token as its source tab; whichever one refreshes first wins,
  // and the duplicate correctly gets logged out on its next attempt rather
  // than silently taking over another tab's session.
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const currentRefreshToken = sessionStorage.getItem('refreshToken');
      if (!currentRefreshToken) return;

      try {
        const tokens = await refreshTokenRequest(currentRefreshToken);
        saveTokens(tokens);
        setAccessToken(tokens.access_token);
      } catch {
        // Refresh genuinely failed for this tab's session - log this tab
        // out. Does not affect any other open tab/account.
        clearTokens();
        setUser(null);
        setAccessToken(null);
        router.push('/auth/login');
      }
    }, 13 * 60 * 1000); // every 13 minutes, before 15m access token expires

    return () => clearInterval(interval);
    // Keyed on user?.id, not the whole user object: `user` gets a new object
    // reference on every setUser() call (login, applyProfile, refreshSession,
    // refreshPermissions, the system_update SSE listener), which would
    // otherwise clear and restart this interval each time, making the
    // "13 minutes" cadence unreliable and increasing the chance of a refresh
    // firing while another one is still in flight.
  }, [user?.id]);

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
    const currentRefreshToken = sessionStorage.getItem('refreshToken');
    try {
      if (currentRefreshToken) await logoutRequest(currentRefreshToken);
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
      const tokens = await refreshTokenRequest(currentRefreshToken);
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

  const refreshPermissions = async () => {
    try {
      const profile = await getMyProfile();
      if (profile?.profile) {
        applyProfile(profile.profile, user);
      }
    } catch (err) {
      console.error('Failed to refresh permissions:', err);
    }
  };

  useEffect(() => {
    const handleSystemUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.type === 'permissions_updated') {
        console.log('Permissions updated event received. Refreshing permissions...');
        refreshPermissions();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('system_update', handleSystemUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('system_update', handleSystemUpdate);
      }
    };
  }, [user]);

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.roles?.some((role) => ['SUPER_ADMIN'].includes(role))) return true;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading, hasPermission, accessToken, refreshSession, refreshPermissions }}>
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