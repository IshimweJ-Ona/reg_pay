
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'HR_ADMIN' | 'HR_MANAGER' | 'FINANCE' | 'BRANCH_MANAGER' | 'HQ_MANAGER' | 'USER';

export type UserStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';

export interface User {
  id: string;
  uuid?: string;
  name: string;
  email: string;
  role: UserRole;
  roles?: string[];
  status: UserStatus;
  permissions: string[];
  avatar?: string;
  department?: string;
  location?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
