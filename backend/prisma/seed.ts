import {
  PrismaClient,
  EMPLOYMENT_TYPE,
  GENDER,
  STATUS_USER,
  TAX_BEHAVIOUR,
  WORKING_LOCATION_TYPE,
} from '@prisma/client';
import { hashPassword } from '../src/auth/utils/password.util';
import { generateUUID } from '../src/common/utils/uuid.util';

const prisma = new PrismaClient();

const permissions = [
  ['Users Read', 'USER_MANAGEMENT', 'users.read'],
  ['Users Create', 'USER_MANAGEMENT', 'users.create'],
  ['Users Approve', 'USER_MANAGEMENT', 'users.approve'],
  ['Users Update', 'USER_MANAGEMENT', 'users.update'],
  ['Users Suspend', 'USER_MANAGEMENT', 'users.suspend'],
  ['Users Transfer', 'USER_MANAGEMENT', 'users.transfer'],
  ['Roles Manage', 'RBAC', 'roles.manage'],
  ['Permissions Manage', 'RBAC', 'permissions.manage'],
  ['Permissions Create', 'RBAC', 'permissions.create'],
  ['Permissions Read', 'RBAC', 'permissions.read'],
  ['Permissions Assign', 'RBAC', 'permissions.assign'],
  ['Branches Manage', 'ORGANIZATION', 'branches.manage'],
  ['Departments Manage', 'ORGANIZATION', 'departments.manage'],
  ['Branch Manager', 'ORGANIZATION', 'branch-manager.manage'],
  ['Create Employees', 'EMPLOYEES', 'employees.create'],
  ['Employees Read', 'EMPLOYEES', 'employees.read'],
  ['Employees Update', 'EMPLOYEES', 'employees.update'],
  ['Employees Approve', 'EMPLOYEES', 'employees.approve'],
  ['Employees Transfer', 'EMPLOYEES', 'employees.transfer'],
  ['Employees Suspend', 'EMPLOYEES', 'employees.suspend'],
  ['Time Records', 'ATTENDANCE', 'attendance.create'],
  ['Attendance Read', 'ATTENDANCE', 'attendance.read'],
  ['Attendance Update', 'ATTENDANCE', 'attendance.update'],
  ['Attendance Approve', 'ATTENDANCE', 'attendance.approve'],
  ['Payment Structures Create', 'PAYMENT_STRUCTURES', 'payment-structures.create'],
  ['Payment Structures Read', 'PAYMENT_STRUCTURES', 'payment-structures.read'],
  ['Payment Structures Update', 'PAYMENT_STRUCTURES', 'payment-structures.update'],
  ['Payment Structures Delete', 'PAYMENT_STRUCTURES', 'payment-structures.delete'],
  ['Batch Creation', 'PAYROLL', 'payroll.create'],
  ['Payroll Read', 'PAYROLL', 'payroll.read'],
  ['Payroll Manage', 'PAYROLL', 'payroll.manage'],
  ['Payroll Approve', 'PAYROLL', 'payroll.approve'],
  ['Payroll Reports', 'PAYROLL', 'payroll.reports'],
  ['Allowances Manage', 'PAYMENT_STRUCTURES', 'allowances.manage'],
  ['Notifications Read', 'NOTIFICATIONS', 'notifications.read'],
  ['Notifications Manage', 'NOTIFICATIONS', 'notifications.manage'],
] as const;

const rolePermissionKeys: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map(([, , key]) => key),
  ADMIN: permissions.map(([, , key]) => key),
  MANAGER: [
    'users.read',
    'users.approve',
    'users.update',
    'employees.create',
    'employees.read',
    'employees.update',
    'employees.suspend',
    'attendance.create',
    'attendance.read',
    'attendance.update',
    'attendance.approve',
    'payroll.read',
    'payroll.approve',
    'notifications.read',
    'notifications.manage',
  ],
  ON_MANAGER: [
    'users.read',
    'users.approve',
    'users.update',
    'employees.create',
    'employees.read',
    'employees.update',
    'employees.suspend',
    'attendance.create',
    'attendance.read',
    'attendance.update',
    'attendance.approve',
    'payroll.read',
    'payroll.approve',
    'notifications.read',
    'notifications.manage',
  ],
  ACCOUNTANT: [
    'employees.read',
    'attendance.read',
    'payment-structures.create',
    'payment-structures.read',
    'payment-structures.update',
    'allowances.manage',
    'payroll.create',
    'payroll.read',
    'payroll.manage',
    'payroll.reports',
    'notifications.read',
  ],
  HR: [
    'employees.create',
    'employees.read',
    'employees.update',
    'employees.suspend',
    'payment-structures.create',
    'payment-structures.read',
    'payment-structures.update',
    'notifications.read',
  ],
  ATTENDANT: [
    'employees.read',
    'attendance.create',
    'attendance.read',
    'attendance.update',
    'notifications.read',
  ],
  BRANCH_MANAGER: [
    'users.read',
    'users.approve',
    'users.update',
    'employees.create',
    'employees.read',
    'employees.update',
    'employees.suspend',
    'attendance.create',
    'attendance.read',
    'attendance.update',
    'attendance.approve',
    'payroll.read',
    'payroll.approve',
  ],
  FINANCE: [
    'employees.read',
    'attendance.read',
    'payment-structures.create',
    'payment-structures.read',
    'payment-structures.update',
    'payroll.create',
    'payroll.read',
    'payroll.manage',
    'payroll.reports',
  ],
};

async function main() {
  const hq = await prisma.working_locations.upsert({
    where: { name: 'REG HQ' },
    update: {},
    create: {
      uuid: generateUUID(),
      name: 'REG HQ',
      type: WORKING_LOCATION_TYPE.HQ,
      address: 'Headquarters',
    },
  });

  const department =
    (await prisma.departments.findFirst({
      where: { code: 'HQ-ADMIN', working_location_id: hq.id },
    })) ??
    (await prisma.departments.create({
      data: {
        uuid: generateUUID(),
        code: 'HQ-ADMIN',
        name: 'HQ Administration',
        description: 'Initial administration department for system bootstrap.',
        working_location_id: hq.id,
      },
    }));

  const permissionByKey = new Map<string, bigint>();
  for (const [name, moduleName, permissionKey] of permissions) {
    const permission = await prisma.permissions.upsert({
      where: { permission_key: permissionKey },
      update: {},
      create: {
        uuid: generateUUID(),
        name,
        module_name: moduleName,
        permission_key: permissionKey,
      },
    });
    permissionByKey.set(permissionKey, permission.id);
  }

  const roles = new Map<string, bigint>();
  let levelOrder = 1;
  for (const [roleName, keys] of Object.entries(rolePermissionKeys)) {
    const role = await prisma.roles.upsert({
      where: { name: roleName },
      update: {
        description: roleName === 'SUPER_ADMIN'
          ? 'Full platform administrator.'
          : `${roleName.replace(/_/g, ' ')} role.`,
        level_order: levelOrder,
      },
      create: {
        uuid: generateUUID(),
        name: roleName,
        description: roleName === 'SUPER_ADMIN'
          ? 'Full platform administrator.'
          : `${roleName.replace(/_/g, ' ')} role.`,
        level_order: levelOrder,
      },
    });
    roles.set(roleName, role.id);
    levelOrder += 1;

    for (const key of keys) {
      const permissionId = permissionByKey.get(key);
      if (!permissionId) continue;

      await prisma.role_permissions.upsert({
        where: {
          role_id_permission_id: {
            role_id: role.id,
            permission_id: permissionId,
          },
        },
        update: {},
        create: {
          role_id: role.id,
          permission_id: permissionId,
        },
      });
    }
  }

  await prisma.employment_categories.upsert({
    where: { name: 'Monthly' },
    update: {},
    create: {
      uuid: generateUUID(),
      name: 'Monthly',
      payroll_frequency: EMPLOYMENT_TYPE.MONTHLY,
      tax_behavior: TAX_BEHAVIOUR.STANDARD,
      description: 'Standard monthly payroll category.',
    },
  });

  await prisma.employment_categories.upsert({
    where: { name: 'Daily' },
    update: {},
    create: {
      uuid: generateUUID(),
      name: 'Daily',
      payroll_frequency: EMPLOYMENT_TYPE.DAILY,
      tax_behavior: TAX_BEHAVIOUR.EXEMPT,
      description: 'Attendance-based daily payroll category.',
    },
  });

  await prisma.employment_categories.upsert({
    where: { name: 'Custom' },
    update: {},
    create: {
      uuid: generateUUID(),
      name: 'Custom',
      payroll_frequency: EMPLOYMENT_TYPE.CUSTOM,
      tax_behavior: TAX_BEHAVIOUR.PERIODIC,
      description: 'Custom contract payroll category.',
    },
  });

  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@regpay.local';
  const phoneNumber = process.env.SEED_SUPER_ADMIN_PHONE ?? '+250788000000';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const user = await prisma.users.upsert({
    where: { email },
    update: {
      status: STATUS_USER.ACTIVE,
      working_location_id: hq.id,
      department_id: department.id,
    },
    create: {
      uuid: generateUUID(),
      first_name: 'System',
      last_name: 'Administrator',
      email,
      phone_number: phoneNumber,
      password_hash: await hashPassword(password),
      gender: GENDER.MALE,
      status: STATUS_USER.ACTIVE,
      working_location_id: hq.id,
      department_id: department.id,
    },
  });

  await prisma.user_roles.upsert({
    where: {
      user_id_role_id: {
        user_id: user.id,
              role_id: roles.get('SUPER_ADMIN')!,
      },
    },
    update: {},
    create: {
      user_id: user.id,
      role_id: roles.get('SUPER_ADMIN')!,
    },
  });

  console.log(`Seeded super admin: ${email}`);
  console.log(`Default password: ${password}`);
  console.log('Set SEED_SUPER_ADMIN_PASSWORD before seeding production data.');
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
