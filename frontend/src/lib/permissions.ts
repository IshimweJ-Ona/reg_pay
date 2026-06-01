export const PERMISSIONS = {
  USERS: ['users.create', 'users.read', 'users.update', 'users.approve', 'users.suspend', 'users.transfer'],
  EMPLOYEES: ['employees.create', 'employees.read', 'employees.update', 'employees.suspend', 'employees.transfer'],
  ORGANIZATION: ['branches.manage', 'departments.manage'],
  ATTENDANCE: ['attendance.create', 'attendance.read', 'attendance.update', 'attendance.approve'],
  PAYROLL: ['payroll.create', 'payroll.read', 'payroll.manage', 'payroll.approve'],
  PAYMENTS: ['payment-structures.create', 'payment-structures.read', 'payment-structures.update'],
  PERMISSIONS: ['permissions.create', 'permissions.read', 'permissions.assign', 'permissions.manage'],
} as const;

const IMPLIED_PERMISSIONS: Record<string, string[]> = {
  'employees.create': [
    'employees.read',
    'employees.update',
    'employees.suspend',
    'employees.transfer',
  ],
  'attendance.create': [
    'attendance.read',
    'attendance.update',
    'attendance.approve',
  ],
  'payroll.create': ['payroll.read', 'payroll.manage'],
  'payroll.manage': ['payroll.read', 'payroll.create', 'payroll.approve'],
  'payment-structures.create': [
    'payment-structures.read',
    'payment-structures.update',
    'payment-structures.delete',
  ],
  'users.create': ['users.read', 'users.update', 'users.approve', 'users.suspend'],
  'permissions.manage': [
    'permissions.read',
    'permissions.create',
    'permissions.assign',
  ],
  'branches.manage': ['departments.manage', 'branch-manager.manage'],
  'branch-manager.manage': [
    'users.read',
    'users.update',
    'permissions.read',
    'permissions.assign',
    'departments.manage',
    'employees.create',
    'employees.read',
    'employees.update',
    'attendance.read',
    'payroll.read',
  ],
};

export function expandPermissions(permissions: string[]) {
  const expanded = new Set(permissions);

  for (const permission of permissions) {
    for (const impliedPermission of IMPLIED_PERMISSIONS[permission] ?? []) {
      expanded.add(impliedPermission);
    }
  }

  return expanded;
}
