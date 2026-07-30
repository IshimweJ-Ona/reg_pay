export interface PermissionDefinition {
  key: string;
  name: string;
  /** Plain-language explanation shown under the permission name in the UI. */
  description?: string;
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
      { key: 'users.read',       name: 'View Users',     description: 'See the list of staff accounts in your working location.' },
      { key: 'users.read_all',   name: 'View Users (All Branches)', description: 'See staff accounts across every working location, not just your own.' },
      { key: 'users.create',     name: 'Add New User',   description: 'Manually create a staff account instead of waiting for self-registration.' },
      { key: 'users.approve',    name: 'Approve User Registration', description: 'Approve or reject accounts that registered themselves and are pending review.' },
      { key: 'users.update',     name: 'Edit User Details', description: "Change a user's working location, department, or profile details." },
      { key: 'users.suspend',    name: 'Suspend/Deactivate User', description: 'Block a user from logging in without deleting their account.' },
      { key: 'users.transfer',   name: 'Transfer User', description: 'Request moving a user to a different working location or department.' },
    ],
  },
  {
    module: 'RBAC',
    permissions: [
      { key: 'roles.manage',              name: 'Manage Roles & Permissions (All)', description: 'Create, edit, and delete roles for the whole system, in any working location.' },
      { key: 'roles.manage_own_location', name: 'Manage Roles (Own Branch Only)', description: 'Create and edit roles scoped to your own working location only.' },
      { key: 'permissions.read',          name: 'View Permission Settings', description: 'See which permissions exist and which roles/users hold them.' },
      { key: 'permissions.assign',        name: 'Assign Permissions to Users/Roles', description: 'Grant or revoke individual permissions on a role or a specific user.' },
    ],
  },
  {
    module: 'ORGANIZATION',
    permissions: [
      { key: 'branches.manage',       name: 'Manage Branches/Locations', description: 'Create and edit working locations (branches/HQ). Also grants department management.' },
      { key: 'branches.read_all',     name: 'View All Branches', description: 'See every working location instead of just your own.' },
      { key: 'departments.manage',    name: 'Manage Departments', description: 'Create, rename, or archive departments.' },
      { key: 'branch-manager.manage', name: 'Assign/Remove Branch Managers', description: 'Choose who is the branch manager for a working location.' },
    ],
  },
  {
    module: 'EMPLOYEES',
    permissions: [
      { key: 'employees.create',   name: 'Add New Employee', description: 'Register a new employee record.' },
      { key: 'employees.read',     name: 'View Employees List', description: 'See employees in your own working location.' },
      { key: 'employees.read_all', name: 'View Employees (All Branches)', description: 'See employees across every working location.' },
      { key: 'employees.update',   name: 'Edit Employee Details', description: 'Change an employee’s profile, category, or contract details.' },
      { key: 'employees.approve',  name: 'Approve Employee Registration', description: 'Approve a newly added employee before they become active.' },
      { key: 'employees.transfer', name: 'Transfer Employee', description: 'Request moving an employee to a different branch or department.' },
      { key: 'employees.transfer_approve', name: 'Approve Employee Transfer', description: 'Approve or reject a pending employee transfer request.' },
      { key: 'employees.suspend',  name: 'Suspend/Deactivate Employee', description: 'Pause an employee’s active status (e.g. contract ended).' },
    ],
  },
  {
    module: 'ATTENDANCE',
    permissions: [
      { key: 'attendance.create',  name: 'Log Attendance / Bulk Import', description: 'Record daily attendance manually or via bulk import.' },
      { key: 'attendance.read',    name: 'View Attendance Records', description: 'See attendance history for your working location.' },
      { key: 'attendance.read_all', name: 'View Attendance (All Branches)', description: 'See attendance history across every working location.' },
      { key: 'attendance.update',  name: 'Edit Attendance Records', description: 'Correct an already-logged attendance entry.' },
      { key: 'attendance.approve', name: 'Approve Attendance', description: 'Approve submitted attendance records before payroll uses them.' },
    ],
  },
  {
    module: 'PAYMENT_STRUCTURES',
    permissions: [
      { key: 'payment-structures.create', name: 'Create Pay Rates / Scales', description: 'Set up a new pay rate/structure for an employee.' },
      { key: 'payment-structures.read',   name: 'View Pay Rates & Scales', description: 'See employee pay rates and structures.' },
      { key: 'payment-structures.read_all', name: 'View Pay Rates (All Branches)', description: 'See pay rates and structures across every working location.' },
      { key: 'payment-structures.update', name: 'Edit Pay Rates / Scales', description: 'Change an existing pay rate or structure.' },
      { key: 'payment-structures.delete', name: 'Delete Pay Rates / Scales', description: 'Remove a pay rate/structure.' },
      { key: 'allowances.manage',         name: 'Manage Allowances', description: 'Add or remove allowances paid to an employee.' },
      { key: 'deductions.manage',         name: 'Assign Employee Deductions / Taxes', description: 'Attach or remove custom taxes/deductions on an employee.' },
    ],
  },
  {
    module: 'PAYROLL',
    permissions: [
      { key: 'payroll.create',  name: 'Generate Payroll Batch', description: 'Create a new payroll batch for a date range.' },
      { key: 'payroll.read',    name: 'View Payroll Batches', description: 'See payroll batches for your working location.' },
      { key: 'payroll.read_all', name: 'View Payroll (All Branches)', description: 'See payroll batches across every working location.' },
      { key: 'payroll.manage',  name: 'Run Payroll Calculation', description: 'Recalculate or adjust items within a payroll batch.' },
      { key: 'payroll.approve', name: 'Approve/Reject Payroll (Both Steps)', description: 'Grants BOTH the initial and final approval steps below. Prefer granting the specific step instead — this is a broad, all-in-one permission.' },
      { key: 'payroll.approve_initial', name: 'Initial Payroll Approval', description: 'First review step. Normally the branch manager. Sends the batch on for final approval.' },
      { key: 'payroll.approve_final', name: 'Final Payroll Approval', description: 'Last, binding approval step that marks a batch APPROVED and payable, for every branch. HR at headquarters approves; SUPER_ADMIN is the fallback only if headquarters has no active HR.' },
      { key: 'payroll.reports', name: 'View Payroll Reports', description: 'See payroll summary reports and exports.' },
    ],
  },
  {
    module: 'NOTIFICATIONS',
    permissions: [
      { key: 'notifications.read',   name: 'View Notifications', description: 'See in-app notifications addressed to you or your role.' },
      { key: 'notifications.manage', name: 'Manage Notification Settings', description: 'Configure system-wide notification behavior.' },
    ],
  },
  {
    module: 'AUDIT',
    permissions: [
      { key: 'audit.view', name: 'View Audit Logs', description: 'See the audit trail for your working location.' },
      { key: 'audit.read_all', name: 'View Audit Logs (All Branches)', description: 'See the audit trail across every working location.' },
    ],
  },
  {
    module: 'IKIMINA',
    permissions: [
      { key: 'ikimina.manage',   name: 'Register/Edit Savings Plan', description: 'Enroll monthly employees in Ikimina and edit their contribution.' },
      { key: 'ikimina.read',     name: 'View Savings Plans & Stats', description: 'See Ikimina memberships and contribution totals for your working location.' },
      { key: 'ikimina.read_all', name: 'View Savings (All Branches)', description: 'See Ikimina memberships across every working location, sorted by branch.' },
    ],
  },
  {
    module: 'SYSTEM_CONFIG',
    permissions: [
      { key: 'system-config.manage', name: 'Manage System Settings', description: 'Change global settings like the overtime rate and default work hours.' },
    ],
  },
];

export const ALL_PERMISSION_KEYS = PERMISSION_MODULES.flatMap(
  (m) => m.permissions.map((p) => p.key),
);

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
};

export function expandPermissionKeys(permissions: string[]) {
  const expanded = new Set(permissions.filter(Boolean));
  let changed = true;

  while (changed) {
    changed = false;
    for (const permission of Array.from(expanded)) {
      for (const implied of IMPLIED_PERMISSIONS[permission] ?? []) {
        if (!expanded.has(implied)) {
          expanded.add(implied);
          changed = true;
        }
      }
    }
  }

  return Array.from(expanded);
}
