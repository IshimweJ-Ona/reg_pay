export const PERMISSIONS = {
  USERS: ['users.create', 'users.read', 'users.update', 'users.approve', 'users.suspend', 'users.transfer'],
  EMPLOYEES: ['employees.create', 'employees.read', 'employees.update', 'employees.suspend', 'employees.transfer'],
  ORGANIZATION: ['branches.manage', 'departments.manage'],
  ATTENDANCE: ['attendance.create', 'attendance.read', 'attendance.update', 'attendance.approve'],
  PAYROLL: ['payroll.create', 'payroll.read', 'payroll.approve'],
  PAYMENTS: ['payment-structures.create', 'payment-structures.read', 'payment-structures.update'],
  PERMISSIONS: ['permissions.create', 'permissions.read', 'permissions.update'],
} as const;
