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
  /** Plain-language explanation surfaced by GET /permissions for admin UIs. */
  description?: string;
}

export interface PermissionModule {
  module: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    module: 'USER_MANAGEMENT',
    permissions: [
      {
        key: 'users.read',
        name: 'View Users',
        description: 'See the list of staff accounts in your working location.',
      },
      {
        key: 'users.read_all',
        name: 'View Users (All Branches)',
        description:
          'See staff accounts across every working location, not just your own.',
      },
      {
        key: 'users.create',
        name: 'Add New User',
        description:
          'Manually create a staff account instead of waiting for self-registration.',
      },
      {
        key: 'users.approve',
        name: 'Approve User Registration',
        description:
          'Approve or reject accounts that registered themselves and are pending review.',
      },
      {
        key: 'users.update',
        name: 'Edit User Details',
        description:
          "Change a user's working location, department, or profile details.",
      },
      {
        key: 'users.suspend',
        name: 'Suspend/Deactivate User',
        description:
          'Block a user from logging in without deleting their account.',
      },
      {
        key: 'users.transfer',
        name: 'Transfer User',
        description:
          'Request moving a user to a different working location or department.',
      },
    ],
  },
  {
    module: 'RBAC',
    permissions: [
      {
        key: 'roles.manage',
        name: 'Manage Roles & Permissions (All)',
        description:
          'Create, edit, and delete roles for the whole system, in any working location.',
      },
      {
        key: 'roles.manage_own_location',
        name: 'Manage Roles (Own Branch Only)',
        description:
          'Create and edit roles scoped to your own working location only.',
      },
      {
        key: 'permissions.read',
        name: 'View Permission Settings',
        description:
          'See which permissions exist and which roles/users hold them.',
      },
      {
        key: 'permissions.assign',
        name: 'Assign Permissions to Users/Roles',
        description:
          'Grant or revoke individual permissions on a role or a specific user.',
      },
    ],
  },
  {
    module: 'ORGANIZATION',
    permissions: [
      {
        key: 'branches.manage',
        name: 'Manage Branches/Locations',
        description:
          'Create and edit working locations (branches/HQ). Also grants department management.',
      },
      {
        key: 'branches.read_all',
        name: 'View All Branches',
        description: 'See every working location instead of just your own.',
      },
      {
        key: 'departments.manage',
        name: 'Manage Departments',
        description: 'Create, rename, or archive departments.',
      },
      {
        key: 'branch-manager.manage',
        name: 'Assign/Remove Branch Managers',
        description: 'Choose who is the branch manager for a working location.',
      },
    ],
  },
  {
    module: 'EMPLOYEES',
    permissions: [
      {
        key: 'employees.create',
        name: 'Add New Employee',
        description: 'Register a new employee record.',
      },
      {
        key: 'employees.read',
        name: 'View Employees List',
        description: 'See employees in your own working location.',
      },
      {
        key: 'employees.read_all',
        name: 'View Employees (All Branches)',
        description: 'See employees across every working location.',
      },
      {
        key: 'employees.update',
        name: 'Edit Employee Details',
        description:
          'Change an employee’s profile, category, or contract details.',
      },
      {
        key: 'employees.approve',
        name: 'Approve Employee Registration',
        description:
          'Approve a newly added employee before they become active.',
      },
      {
        key: 'employees.transfer',
        name: 'Transfer Employee',
        description:
          'Request moving an employee to a different branch or department.',
      },
      {
        key: 'employees.transfer_approve',
        name: 'Approve Employee Transfer',
        description: 'Approve or reject a pending employee transfer request.',
      },
      {
        key: 'employees.suspend',
        name: 'Suspend/Deactivate Employee',
        description: 'Pause an employee’s active status (e.g. contract ended).',
      },
    ],
  },
  {
    module: 'ATTENDANCE',
    permissions: [
      {
        key: 'attendance.create',
        name: 'Log Attendance / Bulk Import',
        description: 'Record daily attendance manually or via bulk import.',
      },
      {
        key: 'attendance.read',
        name: 'View Attendance Records',
        description: 'See attendance history for your working location.',
      },
      {
        key: 'attendance.read_all',
        name: 'View Attendance (All Branches)',
        description: 'See attendance history across every working location.',
      },
      {
        key: 'attendance.update',
        name: 'Edit Attendance Records',
        description: 'Correct an already-logged attendance entry.',
      },
      {
        key: 'attendance.approve',
        name: 'Approve Attendance',
        description:
          'Approve submitted attendance records before payroll uses them.',
      },
    ],
  },
  {
    module: 'PAYMENT_STRUCTURES',
    permissions: [
      {
        key: 'payment-structures.create',
        name: 'Create Pay Rates / Scales',
        description: 'Set up a new pay rate/structure for an employee.',
      },
      {
        key: 'payment-structures.read',
        name: 'View Pay Rates & Scales',
        description: 'See employee pay rates and structures.',
      },
      {
        key: 'payment-structures.read_all',
        name: 'View Pay Rates (All Branches)',
        description:
          'See pay rates and structures across every working location.',
      },
      {
        key: 'payment-structures.update',
        name: 'Edit Pay Rates / Scales',
        description: 'Change an existing pay rate or structure.',
      },
      {
        key: 'payment-structures.delete',
        name: 'Delete Pay Rates / Scales',
        description: 'Remove a pay rate/structure.',
      },
      {
        key: 'allowances.manage',
        name: 'Manage Allowances',
        description: 'Add or remove allowances paid to an employee.',
      },
      {
        key: 'deductions.manage',
        name: 'Assign Employee Deductions / Taxes',
        description: 'Attach or remove custom taxes/deductions on an employee.',
      },
    ],
  },
  {
    module: 'PAYROLL',
    permissions: [
      {
        key: 'payroll.create',
        name: 'Generate Payroll Batch',
        description: 'Create a new payroll batch for a date range.',
      },
      {
        key: 'payroll.read',
        name: 'View Payroll Batches',
        description: 'See payroll batches for your working location.',
      },
      {
        key: 'payroll.read_all',
        name: 'View Payroll (All Branches)',
        description: 'See payroll batches across every working location.',
      },
      {
        key: 'payroll.manage',
        name: 'Run Payroll Calculation',
        description: 'Recalculate or adjust items within a payroll batch.',
      },
      {
        key: 'payroll.approve',
        name: 'Approve/Reject Payroll (Both Steps)',
        description:
          'Grants BOTH the initial and final approval steps below. Prefer granting the specific step instead.',
      },
      {
        key: 'payroll.approve_initial',
        name: 'Initial Payroll Approval',
        description:
          'First review step. Normally the branch manager. Sends the batch on for final approval.',
      },
      {
        key: 'payroll.approve_final',
        name: 'Final Payroll Approval',
        description:
          'Last, binding approval step for every branch. HR at headquarters approves; SUPER_ADMIN is the fallback only if headquarters has no active HR.',
      },
      {
        key: 'payroll.reports',
        name: 'View Payroll Reports',
        description: 'See payroll summary reports and exports.',
      },
    ],
  },
  {
    module: 'NOTIFICATIONS',
    permissions: [
      {
        key: 'notifications.read',
        name: 'View Notifications',
        description: 'See in-app notifications addressed to you or your role.',
      },
      {
        key: 'notifications.manage',
        name: 'Manage Notification Settings',
        description: 'Configure system-wide notification behavior.',
      },
    ],
  },
  {
    module: 'AUDIT',
    permissions: [
      {
        key: 'audit.view',
        name: 'View Audit Logs',
        description: 'See the audit trail for your working location.',
      },
      {
        key: 'audit.read_all',
        name: 'View Audit Logs (All Branches)',
        description: 'See the audit trail across every working location.',
      },
    ],
  },
  {
    module: 'IKIMINA',
    permissions: [
      {
        key: 'ikimina.manage',
        name: 'Register/Edit Savings Plan',
        description:
          'Enroll monthly employees in Ikimina and edit their contribution.',
      },
      {
        key: 'ikimina.read',
        name: 'View Savings Plans & Stats',
        description:
          'See Ikimina memberships and contribution totals for your working location.',
      },
      {
        key: 'ikimina.read_all',
        name: 'View Savings (All Branches)',
        description:
          'See Ikimina memberships across every working location, sorted by branch.',
      },
    ],
  },
  {
    module: 'SYSTEM_CONFIG',
    permissions: [
      {
        key: 'system-config.manage',
        name: 'Manage System Settings',
        description:
          'Change global settings like the overtime rate and default work hours.',
      },
    ],
  },
  {
    module: 'POSITIONS',
    permissions: [
      {
        key: 'positions.read',
        name: 'View Positions',
        description:
          'See the list of positions (e.g. Linesman, Driver, Electrician) for assigning employees.',
      },
      {
        key: 'positions.manage',
        name: 'Manage Positions',
        description:
          'Create, edit, and archive positions and their default pay/deduction/allowance templates.',
      },
    ],
  },
];

/**
 * Registry used by PrismaService's query scoping extension: every model
 * listed here is auto-filtered to the caller's working_location_id unless
 * they hold `readAllPermission` (SUPER_ADMIN always skips the filter).
 * `locationField` is the actual column filtered on. `departmentField` is
 * only a denormalized column for service-layer use - it is NOT enforced
 * by the Prisma extension. Models without their own working_location_id
 * column don't belong here; scope those at the service layer instead.
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
export const ALL_PERMISSION_KEYS: string[] = PERMISSION_MODULES.flatMap((m) =>
  m.permissions.map((p) => p.key),
);

/**
 * Implied permissions - if a user has key A, they automatically get keys B, C.
 * Guards expand this set before checking. "<module>.read_all" always implies
 * "<module>.read", so granting read_all alone is enough to also get read.
 */
export const IMPLIED_PERMISSIONS: Record<string, string[]> = {
  'employees.read_all': ['employees.read'],
  'attendance.read_all': ['attendance.read'],
  'attendance.create': ['attendance.read'],
  'payroll.create': ['payroll.read', 'payroll.manage'],
  'payroll.manage': ['payroll.read'],
  'payroll.read_all': ['payroll.read'],
  'payroll.approve': [
    'payroll.approve_initial',
    'payroll.approve_final',
    'payroll.read',
  ],
  'payroll.approve_initial': ['payroll.read'],
  'payroll.approve_final': ['payroll.read'],
  'payment-structures.read_all': ['payment-structures.read'],
  'deductions.manage': ['payment-structures.read'],
  'users.read_all': ['users.read'],
  'users.create': ['users.read'],
  'ikimina.manage': ['ikimina.read'],
  'ikimina.read_all': ['ikimina.read'],
  'audit.read_all': ['audit.view'],
  'branches.manage': ['departments.manage', 'branch-manager.manage'],
  'positions.manage': ['positions.read'],
};

/**
 * Role → permission keys for the baseline system roles seeded into the DB.
 * SUPER_ADMIN bypasses all checks — not listed here.
 * Additional roles created by SUPER_ADMIN at runtime use the same keys.
 */
export const BASELINE_ROLE_PERMISSIONS: Record<string, string[]> = {
  BRANCH_MANAGER: [
    'users.read',
    'users.create',
    'users.update',
    'users.approve',
    'users.suspend',
    'users.transfer',
    'roles.manage_own_location',
    'permissions.read',
    'permissions.assign',
    'employees.create',
    'employees.read',
    'employees.update',
    'employees.approve',
    'employees.transfer',
    'employees.transfer_approve',
    'employees.suspend',
    'attendance.create',
    'attendance.read',
    'attendance.update',
    'attendance.approve',
    'payment-structures.create',
    'payment-structures.read',
    'payment-structures.update',
    'payment-structures.delete',
    'allowances.manage',
    'deductions.manage',
    'payroll.create',
    'payroll.read',
    'payroll.manage',
    // Branch managers do the FIRST approval step only. Final approval
    // belongs to HR at headquarters (see resolveFinalApprovalAuthority()).
    'payroll.approve_initial',
    'payroll.reports',
    'ikimina.manage',
    'ikimina.read',
    'notifications.read',
    'notifications.manage',
    'audit.view',
    'positions.read',
    'positions.manage',
    // system-config.manage is deliberately NOT granted here - overtime
    // settings are a single global row with no per-branch column, so
    // editing it would change company-wide behavior, not just this branch.
  ],
  ACCOUNTANT: [
    'employees.read',
    'attendance.read',
    'payment-structures.create',
    'payment-structures.read',
    'payment-structures.update',
    'allowances.manage',
    'deductions.manage',
    'payroll.create',
    'payroll.read',
    'payroll.manage',
    'payroll.reports',
    'notifications.read',
    'positions.read',
  ],
  HR: [
    'employees.create',
    'employees.read',
    'employees.update',
    'employees.suspend',
    'payment-structures.create',
    'payment-structures.read',
    'payment-structures.update',
    'deductions.manage',
    'notifications.read',
    // HR at headquarters gives the FINAL payroll approval for every branch;
    // SUPER_ADMIN is the fallback only if HQ has no active HR. See
    // PayrollService.resolveFinalApprovalAuthority().
    'payroll.approve_final',
    'payroll.reports',
    'positions.read',
    'positions.manage',
  ],
  ATTENDANT: [
    'employees.read',
    'attendance.create',
    'attendance.read',
    'attendance.update',
    'notifications.read',
  ],
  FINANCE: [
    'employees.read',
    'attendance.read',
    'payment-structures.create',
    'payment-structures.read',
    'payment-structures.update',
    'deductions.manage',
    'payroll.create',
    'payroll.read',
    'payroll.manage',
    'payroll.reports',
    'positions.read',
  ],
};
