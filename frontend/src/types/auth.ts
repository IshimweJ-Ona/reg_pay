
export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'HR'
  | 'HR_ADMIN'
  | 'HR_MANAGER'
  | 'ACCOUNTANT'
  | 'ATTENDANT'
  | 'FINANCE'
  | 'BRANCH_MANAGER'
  | 'HQ_MANAGER'
  | 'DEPARTMENT_MANAGER'
  | 'MANAGER'
  | 'ON_MANAGER'
  | 'USER';

export type UserStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';

export interface User {
  id: string;
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: string[];
  status: UserStatus;
  permissions: string[];
  permission_overrides?: {
    permission_id: string;
    permission_key: string;
    is_allowed: boolean;
  }[];
  avatar?: string;
  avatar_url?: string;
  department?: string;
  location?: string;
  department_id?: string;
  location_id?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
