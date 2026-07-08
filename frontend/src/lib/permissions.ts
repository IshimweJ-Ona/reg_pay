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
      { key: 'roles.manage',       name: 'Roles Manage'       },
      { key: 'permissions.read',   name: 'Permissions Read'   },
      { key: 'permissions.assign', name: 'Permissions Assign' },
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
    module: 'SYSTEM_CONFIG',
    permissions: [
      { key: 'system-config.manage', name: 'System Config Manage' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap(
  (m) => m.permissions.map((p) => p.key),
);
