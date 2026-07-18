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

/**
 * Registry used by PrismaService's query scoping extension.
 *
 * Every Prisma model here is automatically filtered to the caller's
 * working_location_id UNLESS the caller holds the listed
 * `readAllPermission` — in which case the filter is skipped entirely for
 * that model. SUPER_ADMIN always skips every filter, independent of this
 * table.
 *
 * `locationField` names the working_location_id column on the model
 * itself — this is the column the Prisma extension actually filters on.
 * `departmentField`, where present, records that the model also carries a
 * denormalized department_id for filtering/reporting at the service layer
 * (e.g. a future "<module>.read_department_only" tier); it is NOT
 * currently auto-enforced by the Prisma extension, only working_location
 * scoping is.
 *
 * Models without a direct working_location_id column don't belong here —
 * filtering must happen at the service layer via an explicit
 * employee-relation join instead (the Prisma extension only rewrites a
 * model's own `where`, it can't safely inject filters through relations
 * for every operation shape).
 *
 * Adding a new scoped model: add its row here, add the matching
 * `working_location_id` column to the model in schema.prisma (denormalized
 * from the owning employee at write-time is the standard pattern used by
 * time_records/transactions/ikimina_memberships), and add a
 * `<module>.read_all` permission above if one doesn't already fit.
 */
export interface ModuleScopeConfig {
  readAllPermission: string;
  locationField?: string;
  departmentField?: string;
}

export const MODULE_SCOPE_CONFIG: Record<string, ModuleScopeConfig> = {
  Employees: {
    readAllPermission: 'employees.read_all',
    locationField: 'working_location_id',
    departmentField: 'department_id',
  },
  Users: {
    readAllPermission: 'users.read_all',
    locationField: 'working_location_id',
    departmentField: 'department_id',
  },
  Departments: {
    readAllPermission: 'branches.read_all',
    locationField: 'working_location_id',
  },
  Branch_managers: {
    readAllPermission: 'branches.read_all',
    locationField: 'working_location_id',
  },
  Payment_batches: {
    readAllPermission: 'payroll.read_all',
    locationField: 'working_location_id',
  },
  Time_records: {
    readAllPermission: 'attendance.read_all',
    locationField: 'working_location_id',
    departmentField: 'department_id',
  },
  Transactions: {
    readAllPermission: 'payroll.read_all',
    locationField: 'working_location_id',
    departmentField: 'department_id',
  },
  Ikimina_memberships: {
    readAllPermission: 'ikimina.read_all',
    locationField: 'working_location_id',
    departmentField: 'department_id',
  },
};

/** Flat list of all valid permission keys. Used by guards. */
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_MODULES.flatMap(
  (m) => m.permissions.map((p) => p.key),
);

/**
 * Implied permissions — if a user has key A, they automatically get keys B, C.
 * Guards expand this set before checking.
 *
 * "read_all" permissions follow a consistent module-scoping pattern (see
 * WorkingLocationScopeInterceptor / PrismaService): holding "<module>.read_all"
 * lifts the default working-location filter for that module, so a user can
 * see records from every working_location instead of only their own. It
 * always implies the module's base "<module>.read" so granting it alone is
 * sufficient — you never need to grant both. SUPER_ADMIN bypasses all
 * scoping regardless of these permissions.
 */
export const IMPLIED_PERMISSIONS: Record<string, string[]> = {
  'employees.create': [
    'employees.read',
    'employees.update',
    'employees.suspend',
    'employees.transfer',
  ],
  'employees.read_all': ['employees.read'],
  'attendance.create': [
    'attendance.read',
    'attendance.update',
    'attendance.approve',
  ],
  'attendance.read_all': ['attendance.read'],
  'payroll.create':  ['payroll.read', 'payroll.manage'],
  'payroll.manage':  ['payroll.read', 'payroll.create', 'payroll.approve'],
  'payroll.read_all': ['payroll.read'],
  'payment-structures.create': [
    'payment-structures.read',
    'payment-structures.update',
    'payment-structures.delete',
  ],
  'payment-structures.read_all': ['payment-structures.read'],
  'users.create': [
    'users.read',
    'users.update',
    'users.approve',
    'users.suspend',
  ],
  'users.read_all': ['users.read'],
  'ikimina.manage': ['ikimina.read'],
  'ikimina.read_all': ['ikimina.read'],
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
