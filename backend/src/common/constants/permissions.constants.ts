/**
 * REG-PAY — Master Permission Registry
 *
 * Permissions are defined here in code. They are never stored in the database.
 * Guards check against ALL_PERMISSION_KEYS at runtime.
 * Roles are stored in the database and reference these keys by string.
 * SUPER_ADMIN bypasses all permission checks entirely.
 */

export interface PermissionDefinition {
  key: string;
  name: string;
}

export interface PermissionModule {
  module: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    module: 'USER_MANAGEMENT',
    permissions: [
      { key: 'users.read',     name: 'Users Read'     },
      { key: 'users.create',   name: 'Users Create'   },
      { key: 'users.approve',  name: 'Users Approve'  },
      { key: 'users.update',   name: 'Users Update'   },
      { key: 'users.suspend',  name: 'Users Suspend'  },
      { key: 'users.transfer', name: 'Users Transfer' },
    ],
  },
  {
    module: 'RBAC',
    permissions: [
      { key: 'roles.manage',              name: 'Roles Manage'              },
      { key: 'roles.manage_own_location', name: 'Roles Manage (Own Branch)' },
      { key: 'permissions.read',          name: 'Permissions Read'          },
      { key: 'permissions.assign',        name: 'Permissions Assign'        },
    ],
  },
  {
    module: 'ORGANIZATION',
    permissions: [
      { key: 'branches.manage',       name: 'Branches Manage'       },
      { key: 'departments.manage',    name: 'Departments Manage'    },
      { key: 'branch-manager.manage', name: 'Branch Manager Manage' },
    ],
  },
  {
    module: 'EMPLOYEES',
    permissions: [
      { key: 'employees.create',   name: 'Employees Create'   },
      { key: 'employees.read',     name: 'Employees Read'     },
      { key: 'employees.update',   name: 'Employees Update'   },
      { key: 'employees.approve',  name: 'Employees Approve'  },
      { key: 'employees.transfer', name: 'Employees Transfer' },
      { key: 'employees.transfer_approve', name: 'Employees Transfer Approve' },
      { key: 'employees.suspend',  name: 'Employees Suspend'  },
    ],
  },
  {
    module: 'ATTENDANCE',
    permissions: [
      { key: 'attendance.create',  name: 'Attendance Create'  },
      { key: 'attendance.read',    name: 'Attendance Read'    },
      { key: 'attendance.update',  name: 'Attendance Update'  },
      { key: 'attendance.approve', name: 'Attendance Approve' },
    ],
  },
  {
    module: 'PAYMENT_STRUCTURES',
    permissions: [
      { key: 'payment-structures.create', name: 'Payment Structures Create' },
      { key: 'payment-structures.read',   name: 'Payment Structures Read'   },
      { key: 'payment-structures.update', name: 'Payment Structures Update' },
      { key: 'payment-structures.delete', name: 'Payment Structures Delete' },
      { key: 'allowances.manage',         name: 'Allowances Manage'         },
    ],
  },
  {
    module: 'PAYROLL',
    permissions: [
      { key: 'payroll.create',  name: 'Payroll Create'  },
      { key: 'payroll.read',    name: 'Payroll Read'    },
      { key: 'payroll.manage',  name: 'Payroll Manage'  },
      { key: 'payroll.approve', name: 'Payroll Approve' },
      { key: 'payroll.reports', name: 'Payroll Reports' },
    ],
  },
  {
    module: 'NOTIFICATIONS',
    permissions: [
      { key: 'notifications.read',   name: 'Notifications Read'   },
      { key: 'notifications.manage', name: 'Notifications Manage' },
    ],
  },
  {
    module: 'AUDIT',
    permissions: [
      { key: 'audit.view', name: 'Audit Logs View' },
    ],
  },
  {
    module: 'IKIMINA',
    permissions: [
      { key: 'ikimina.manage', name: 'Ikimina Manage' },
      { key: 'ikimina.read',   name: 'Ikimina Read'   },
    ],
  },
  {
    module: 'SYSTEM_CONFIG',
    permissions: [
      { key: 'system-config.manage', name: 'System Config Manage' },
    ],
  },
];

/** Flat list of all valid permission keys. Used by guards. */
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_MODULES.flatMap(
  (m) => m.permissions.map((p) => p.key),
);

/**
 * Implied permissions — if a user has key A, they automatically get keys B, C.
 * Guards expand this set before checking.
 */
export const IMPLIED_PERMISSIONS: Record<string, string[]> = {
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
  'payroll.create':  ['payroll.read', 'payroll.manage'],
  'payroll.manage':  ['payroll.read', 'payroll.create', 'payroll.approve'],
  'payment-structures.create': [
    'payment-structures.read',
    'payment-structures.update',
    'payment-structures.delete',
  ],
  'users.create': [
    'users.read',
    'users.update',
    'users.approve',
    'users.suspend',
  ],
  'branches.manage': ['departments.manage', 'branch-manager.manage'],
};

/**
 * Role → permission keys for the baseline system roles seeded into the DB.
 * SUPER_ADMIN bypasses all checks — not listed here.
 * Additional roles created by SUPER_ADMIN at runtime use the same keys.
 */
export const BASELINE_ROLE_PERMISSIONS: Record<string, string[]> = {
  BRANCH_MANAGER: [
    'users.read', 'users.create', 'users.update', 'users.approve',
    'users.suspend', 'users.transfer',
    'branch-manager.manage', 'branches.manage', 'departments.manage',
    'employees.create', 'employees.read', 'employees.update',
    'employees.approve', 'employees.transfer', 'employees.transfer_approve', 'employees.suspend',
    'attendance.create', 'attendance.read', 'attendance.update', 'attendance.approve',
    'payment-structures.create', 'payment-structures.read',
    'payment-structures.update', 'payment-structures.delete',
    'allowances.manage',
    'payroll.create', 'payroll.read', 'payroll.manage',
    'payroll.approve', 'payroll.reports',
    'notifications.read', 'notifications.manage',
    'audit.view', 'system-config.manage',
  ],
  ACCOUNTANT: [
    'employees.read', 'attendance.read',
    'payment-structures.create', 'payment-structures.read',
    'payment-structures.update', 'allowances.manage',
    'payroll.create', 'payroll.read', 'payroll.manage', 'payroll.reports',
    'notifications.read',
  ],
  HR: [
    'employees.create', 'employees.read', 'employees.update', 'employees.suspend',
    'payment-structures.create', 'payment-structures.read', 'payment-structures.update',
    'notifications.read',
  ],
  ATTENDANT: [
    'employees.read',
    'attendance.create', 'attendance.read', 'attendance.update',
    'notifications.read',
  ],
  FINANCE: [
    'employees.read', 'attendance.read',
    'payment-structures.create', 'payment-structures.read', 'payment-structures.update',
    'payroll.create', 'payroll.read', 'payroll.manage', 'payroll.reports',
  ],
};