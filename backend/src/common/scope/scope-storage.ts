import { AsyncLocalStorage } from 'async_hooks';

export interface UserScope {
  userId: string;
  roles: string[];
  working_location_id: string | null;
  department_id: string | null;
}

export const scopeStorage = new AsyncLocalStorage<UserScope>();
