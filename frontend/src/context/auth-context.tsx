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
  verifyAccount as verifyAccountRequest,
} from '@/api/auth';
import { User, UserRole } from '@/types/auth';
import { expandPermissionKeys } from '@/lib/permissions';

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
  verifyAccount: (identifier: string, code: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  accessToken: string | null;
  refreshSession: (options?: { reload?: boolean }) => Promise<void>;
  refreshPermissions: (options?: { refreshAccessToken?: boolean }) => Promise<void>;
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

function normalizePermissionKey(permission: unknown): string | null {
  if (typeof permission === 'string') return permission;
  if (permission && typeof permission === 'object') {
    const p = permission as { key?: string; permission_key?: string; permissionKey?: string };
    return p.key ?? p.permission_key ?? p.permissionKey ?? null;
  }
  return null;
}

function normalizePermissionList(rawPermissions: unknown, fallback: string[] = []) {
  const permissions = Array.isArray(rawPermissions) ? rawPermissions : [];
  const keys = permissions
    .map(normalizePermissionKey)
    .filter((key): key is string => Boolean(key));

  return expandPermissionKeys(keys.length ? keys : fallback);
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function profileDiffersFromToken(profileUser: any, tokenUser: User | null) {
  const profileRoles: string[] = Array.isArray(profileUser.roles)
    ? profileUser.roles.map(normalizeRole)
    : [];
  const profilePermissions = normalizePermissionList(profileUser.permissions, []);

  return (
    !sameStringSet(profileRoles, tokenUser?.roles ?? []) ||
    !sameStringSet(profilePermissions, tokenUser?.permissions ?? [])
  );
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
    permissions: normalizePermissionList(payload.permissions ?? []),
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
    const normalizedRoles = rawRoles.length ? rawRoles.map(normalizeRole) : fallback?.roles ?? [];
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
      permissions: normalizePermissionList(profileUser.permissions, fallback?.permissions ?? []),
      department: profileUser.department?.name,
      location: profileUser.working_location?.name,
      department_id: profileUser.department?.uuid ?? fallback?.department_id,
      location_id: profileUser.working_location?.uuid ?? fallback?.location_id,
      createdAt: fallback?.createdAt ?? new Date().toISOString(),
    });
  };

  const refreshAccessTokenFromSession = async () => {
    const currentRefreshToken = sessionStorage.getItem('refreshToken');
    if (!currentRefreshToken) return null;

    const tokens = await refreshTokenRequest(currentRefreshToken);
    saveTokens(tokens);
    setAccessToken(tokens.access_token);
    const tokenUser = mapJwtUser(tokens.access_token);
    if (tokenUser) setUser(tokenUser);
    return tokenUser;
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
          if (profileDiffersFromToken(profileUser, tokenUser)) {
            const refreshedTokenUser = await refreshAccessTokenFromSession();
            const refreshedProfile = await getMyProfile();
            applyProfile(refreshedProfile?.profile ?? profileUser, refreshedTokenUser ?? tokenUser);
          } else {
            applyProfile(profileUser, tokenUser);
          }
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

  // Uses the shared, mutex-guarded refreshToken() from api/auth.ts so this
  // timer can't race with refreshSession() or the axios 401 interceptor.
  // Sessions are per-tab (sessionStorage) by design, so different accounts
  // can be open side by side; a tab duplicated from an open one briefly
  // shares its refresh token and gets logged out on the next refresh race.
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

  const verifyAccount = async (identifier: string, code: string) => {
    const response = await verifyAccountRequest(identifier, code);
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
    let tokenUser = user;
    tokenUser = await refreshAccessTokenFromSession() ?? user;

    const profile = await getMyProfile();
    if (profile?.profile) {
      applyProfile(profile.profile, tokenUser);
    }

    if (options?.reload) {
      window.location.reload();
    }
  };

  const refreshPermissions = async (options?: { refreshAccessToken?: boolean }) => {
    try {
      const currentAccessToken = sessionStorage.getItem('accessToken');
      let tokenUser = currentAccessToken ? mapJwtUser(currentAccessToken) ?? user : user;
      if (options?.refreshAccessToken) {
        tokenUser = await refreshAccessTokenFromSession() ?? tokenUser;
      }

      const profile = await getMyProfile();
      if (profile?.profile) {
        if (!options?.refreshAccessToken && profileDiffersFromToken(profile.profile, tokenUser)) {
          tokenUser = await refreshAccessTokenFromSession() ?? tokenUser;
          const refreshedProfile = await getMyProfile();
          applyProfile(refreshedProfile?.profile ?? profile.profile, tokenUser);
          return;
        }
        applyProfile(profile.profile, tokenUser);
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
        refreshPermissions({ refreshAccessToken: true });
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
    <AuthContext.Provider value={{ user, login, verifyAccount, register, logout, isLoading, hasPermission, accessToken, refreshSession, refreshPermissions }}>
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
