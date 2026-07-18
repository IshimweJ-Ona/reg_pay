import { AsyncLocalStorage } from 'async_hooks';

export interface UserScope {
  userId: string;
  roles: string[];
  /**
   * The caller's effective permission set (raw + implied + overrides
   * applied — see computeEffectivePermissions). Used by PrismaService's
   * query extension to decide whether a "<module>.read_all" bypass applies,
   * so scoping and route-level authorization can never disagree.
   */
  permissions: string[];
  working_location_id: string | null;
  department_id: string | null;
}

export const scopeStorage = new AsyncLocalStorage<UserScope>();
