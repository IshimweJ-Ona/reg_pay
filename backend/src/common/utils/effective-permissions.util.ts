import { IMPLIED_PERMISSIONS } from '../constants/permissions.constants';
import type { CurrentUserType } from '../../auth/types/current-user.type';

/**
 * Shape returned by Prisma for a user's roles/direct-permissions relations,
 * loose enough to accept the `select`/`include` variants used across
 * auth.service.ts and jwt.strategy.ts.
 */
export type UserPermissionRelations = {
  user_roles?: Array<{ roles?: { permission_keys?: unknown } | null }> | null;
  user_permissions?: Array<{ permission_key: string }> | null;
};

/**
 * Builds a user's *raw* (pre-implied, pre-override) permission key set from
 * their role assignments and direct per-user grants. This is the single
 * place both login/refresh (auth.service.ts) and per-request authentication
 * (jwt.strategy.ts) read from, so the two can never drift out of sync.
 */
export function buildRawPermissionKeys(
  user: UserPermissionRelations,
): string[] {
  const keys = new Set<string>();

  for (const userRole of user.user_roles ?? []) {
    const rolePermissionKeys =
      (userRole.roles?.permission_keys as string[] | undefined) ?? [];
    for (const key of rolePermissionKeys) {
      keys.add(key);
    }
  }

  for (const userPermission of user.user_permissions ?? []) {
    keys.add(userPermission.permission_key);
  }

  return Array.from(keys);
}

/**
 * Computes a user's effective permission set: raw permissions expanded
 * through IMPLIED_PERMISSIONS, then adjusted by permission_overrides.
 * Shared by PermissionsGuard and WorkingLocationScopeInterceptor so both
 * agree on what a user can do. SUPER_ADMIN is handled by callers instead
 * (they check `user.roles.includes('SUPER_ADMIN')` and skip this entirely).
 */
export function computeEffectivePermissions(
  user:
    | Pick<CurrentUserType, 'permissions' | 'permission_overrides'>
    | undefined
    | null,
): Set<string> {
  const effective = new Set<string>(user?.permissions ?? []);

  for (const key of Array.from(effective)) {
    for (const implied of IMPLIED_PERMISSIONS[key] ?? []) {
      effective.add(implied);
    }
  }

  for (const override of user?.permission_overrides ?? []) {
    if (override.is_allowed) {
      effective.add(override.permission_key);
    } else {
      effective.delete(override.permission_key);
    }
  }

  return effective;
}

export function hasEffectivePermission(
  user:
    | Pick<CurrentUserType, 'permissions' | 'permission_overrides'>
    | undefined
    | null,
  permission: string,
): boolean {
  return computeEffectivePermissions(user).has(permission);
}
