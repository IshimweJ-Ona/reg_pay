export interface PermissionDefinition {
  key: string;
  name: string;
}

export interface PermissionModule {
  module: string;
  permissions: PermissionDefinition[];
}

/**
 * Mirrors backend/src/common/constants/permissions.constants.ts.
 * Keep these two files in sync — the frontend uses this list purely to
 * render the role/permission management UI; the backend copy is the
 * actual source of truth enforced by guards. If you add a permission on
 * one side, add it on the other.
 */
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    module: 'USER_MANAGEMENT',
    permissions: [
      { key: 'users.read',     name: 'Users Read'     },
      { key: 'users.read_all', name: 'Users Read (All Locations)' },
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
      { key: 'branches.read_all',     name: 'Branches Read (All Locations)' },
      { key: 'departments.manage',    name: 'Departments Manage'    },
      { key: 'branch-manager.manage', name: 'Branch Manager Manage' },
    ],
  },
  {
    module: 'EMPLOYEES',
    permissions: [
      { key: 'employees.create',   name: 'Employees Create'   },
      { key: 'employees.read',     name: 'Employees Read'     },
      { key: 'employees.read_all', name: 'Employees Read (All Locations)' },
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
      { key: 'attendance.read_all', name: 'Attendance Read (All Locations)' },
      { key: 'attendance.update',  name: 'Attendance Update'  },
      { key: 'attendance.approve', name: 'Attendance Approve' },
    ],
  },
  {
    module: 'PAYMENT_STRUCTURES',
    permissions: [
      { key: 'payment-structures.create', name: 'Payment Structures Create' },
      { key: 'payment-structures.read',   name: 'Payment Structures Read'   },
      { key: 'payment-structures.read_all', name: 'Payment Structures Read (All Locations)' },
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
      { key: 'payroll.read_all', name: 'Payroll Read (All Locations)' },
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
      { key: 'ikimina.manage',   name: 'Ikimina Manage' },
      { key: 'ikimina.read',     name: 'Ikimina Read'   },
      { key: 'ikimina.read_all', name: 'Ikimina Read (All Locations)' },
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
