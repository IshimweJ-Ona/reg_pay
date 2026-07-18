import { IMPLIED_PERMISSIONS } from '../constants/permissions.constants';
import type { CurrentUserType } from '../../auth/types/current-user.type';

/**
 * Computes a user's *effective* permission set: their raw permissions,
 * expanded through IMPLIED_PERMISSIONS, then adjusted by any per-user
 * permission_overrides from the JWT payload.
 *
 * This is the single source of truth for "what can this user actually do" —
 * used by PermissionsGuard (route-level checks) AND by
 * WorkingLocationScopeInterceptor (data-scoping checks), so the two systems
 * can never disagree about what a user is allowed to see.
 *
 * SUPER_ADMIN is intentionally NOT special-cased here — callers check
 * `user.roles.includes('SUPER_ADMIN')` first and skip permission logic
 * entirely, since SUPER_ADMIN bypasses all permission and scope checks.
 */
export function computeEffectivePermissions(
  user: Pick<CurrentUserType, 'permissions' | 'permission_overrides'> | undefined | null,
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
  user: Pick<CurrentUserType, 'permissions' | 'permission_overrides'> | undefined | null,
  permission: string,
): boolean {
  return computeEffectivePermissions(user).has(permission);
}
