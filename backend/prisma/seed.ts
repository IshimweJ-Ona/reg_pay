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

const firstNames = [
  'Aline',
  'Jean',
  'Claudine',
  'Eric',
  'Diane',
  'Patrick',
  'Grace',
  'Emmanuel',
  'Nadia',
  'Olivier',
  'Alice',
  'Theophile',
  'Chantal',
  'Fabrice',
  'Josiane',
  'Samuel',
  'Sandrine',
  'Bosco',
  'Yvette',
  'Claude',
];

const lastNames = [
  'Uwimana',
  'Niyonsenga',
  'Mukamana',
  'Habimana',
  'Uwamahoro',
  'Nkurunziza',
  'Ishimwe',
  'Bizimana',
  'Mutoni',
  'Twagirayezu',
  'Mukeshimana',
  'Nsengiyumva',
  'Uwizeyimana',
  'Hakizimana',
  'Mutesi',
  'Nshimiyimana',
  'Mugisha',
  'Kayitesi',
  'Rukundo',
  'Munyaneza',
];

type EmployeeSeedScope = {
  departmentId: bigint;
  workingLocationId: bigint;
};

function buildSeedEmployee(index: number, context: {
  creatorId: bigint;
  scopes: EmployeeSeedScope[];
  categoryIds: bigint[];
}) {
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  const sequence = index + 1;
  const operator = ['2', '3', '8', '9'][index % 4];
  const hasEmail = index % 3 !== 0;
  const hasPhone = index % 4 !== 0 || !hasEmail;
  const scope = context.scopes[index % context.scopes.length];

  return {
    uuid: generateUUID(),
    first_name: firstName,
    last_name: lastName,
    email: hasEmail
      ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${sequence}@${index % 2 === 0 ? 'reg.com' : 'gmail.com'}`
      : null,
    phone_number: hasPhone
      ? `+2507${operator}${String(1000000 + sequence).slice(-7)}`
      : null,
    national_id: `1199${String(700000000000 + sequence).padStart(12, '0')}`,
    gender: index % 2 === 0 ? GENDER.FEMALE : GENDER.MALE,
    hire_date: new Date(Date.UTC(2022 + (index % 4), index % 12, (index % 28) + 1)),
    department_id: scope.departmentId,
    working_location_id: scope.workingLocationId,
    employment_category_id: context.categoryIds[index % context.categoryIds.length],
    status: STATUS_USER.ACTIVE,
    created_by: context.creatorId,
  };
}

async function resolveEmployeeSeedScopes(fallback: EmployeeSeedScope) {
  try {
    const departments = await prisma.departments.findMany({
      where: {
        status: 'ACTIVE',
        working_location: { deleted_at: null },
      },
      select: {
        id: true,
        working_location_id: true,
      },
      orderBy: [{ working_location_id: 'asc' }, { name: 'asc' }],
    });

    if (!departments.length) {
      return [fallback];
    }

    return departments.map((department) => ({
      departmentId: department.id,
      workingLocationId: department.working_location_id,
    }));
  } catch {
    return [fallback];
  }
}

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
  await prisma.user_roles.deleteMany({
    where: { role: { name: { in: ['ADMIN', 'MANAGER', 'ON_MANAGER'] } } },
  });
  await prisma.role_permissions.deleteMany({
    where: { role: { name: { in: ['ADMIN', 'MANAGER', 'ON_MANAGER'] } } },
  });
  await prisma.roles.deleteMany({
    where: { name: { in: ['ADMIN', 'MANAGER', 'ON_MANAGER'] } },
  });

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

    await prisma.role_permissions.deleteMany({
      where: {
        role_id: role.id,
        permission: {
          permission_key: {
            notIn: keys,
          },
        },
      },
    });

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

  const monthlyCategory = await prisma.employment_categories.upsert({
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

  const dailyCategory = await prisma.employment_categories.upsert({
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

  const customCategory = await prisma.employment_categories.upsert({
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

  await prisma.system_config.upsert({
    where: { key: 'GLOBAL_TAX_RATE' },
    update: {},
    create: {
      uuid: generateUUID(),
      key: 'GLOBAL_TAX_RATE',
      value: '15',
      description: 'Global tax rate percentage applied to employees working > 21 days.',
    },
  });

  await prisma.system_config.upsert({
    where: { key: 'GLOBAL_TAX_DESCRIPTION' },
    update: {},
    create: {
      uuid: generateUUID(),
      key: 'GLOBAL_TAX_DESCRIPTION',
      value: 'Standard Income Tax',
      description: 'Description for the global tax rate.',
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

  const employeeContext = {
    creatorId: user.id,
    scopes: await resolveEmployeeSeedScopes({
      departmentId: department.id,
      workingLocationId: hq.id,
    }),
    categoryIds: [monthlyCategory.id, dailyCategory.id, customCategory.id],
    defaultRoleId: roles.get('USER') ?? (Array.from(roles.values())[0]),
  };

  const passwordHash = await hashPassword('ChangeMe123!');
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Clear existing time records and payment structures to avoid unique constraint issues during re-seed
  await prisma.time_records.deleteMany({});
  await prisma.payment_structures.deleteMany({});

  const seededEmployees: any[] = [];

  for (let index = 0; index < 400; index += 1) {
    const employeeData = buildSeedEmployee(index, employeeContext);
    
    // Create or update a corresponding User for each employee to make them "unique and different users"
    const userEmail = employeeData.email ?? `user${index + 1}@regpay.local`;
    const seededUser = await prisma.users.upsert({
      where: { email: userEmail },
      update: {
        status: STATUS_USER.ACTIVE,
        working_location_id: employeeData.working_location_id,
        department_id: employeeData.department_id,
      },
      create: {
        uuid: generateUUID(),
        first_name: employeeData.first_name,
        last_name: employeeData.last_name,
        email: userEmail,
        phone_number: employeeData.phone_number ?? `+2507${['2', '3', '8', '9'][index % 4]}${String(2000000 + index).slice(-7)}`,
        password_hash: passwordHash,
        gender: employeeData.gender,
        status: STATUS_USER.ACTIVE,
        working_location_id: employeeData.working_location_id,
        department_id: employeeData.department_id,
      },
    });

    // Ensure they have a basic user role
    const roleId = roles.get('USER') || Array.from(roles.values())[0];
    if (roleId) {
      await prisma.user_roles.upsert({
        where: {
          user_id_role_id: {
            user_id: seededUser.id,
            role_id: roleId,
          },
        },
        update: {},
        create: {
          user_id: seededUser.id,
          role_id: roleId,
        },
      });
    }

    const employee = await prisma.employees.upsert({
      where: { national_id: employeeData.national_id },
      update: {
        first_name: employeeData.first_name,
        last_name: employeeData.last_name,
        email: employeeData.email,
        phone_number: employeeData.phone_number,
        gender: employeeData.gender,
        hire_date: employeeData.hire_date,
        department_id: employeeData.department_id,
        working_location_id: employeeData.working_location_id,
        employment_category_id: employeeData.employment_category_id,
        status: employeeData.status,
        created_by: seededUser.id,
        deleted_at: null,
      },
      create: {
        ...employeeData,
        created_by: seededUser.id,
      },
    });

    seededEmployees.push(employee);

    // Seed Payment Structure for each employee
    await prisma.payment_structures.upsert({
      where: { uuid: employee.uuid }, // Using employee uuid as a trick for upsert uniqueness in seed, normally it would be its own uuid
      update: {},
      create: {
        uuid: generateUUID(),
        employee_id: employee.id,
        payroll_frequency: index % 3 === 0 ? EMPLOYMENT_TYPE.MONTHLY : (index % 3 === 1 ? EMPLOYMENT_TYPE.DAILY : EMPLOYMENT_TYPE.CUSTOM),
        basic_salary: 500000 + (index * 1000),
        daily_rate: 15000,
        overtime_rate: 2000,
        effective_from: thirtyDaysAgo,
      }
    });

    // Seed some notifications
    if (index < 10) {
      await prisma.notifications.create({
        data: {
          uuid: generateUUID(),
          user_id: seededUser.id,
          title: 'Welcome to RegPay',
          message: `Hello ${employee.first_name}, your account has been successfully created.`,
          type: 'SYSTEM_ALERT',
          is_read: false,
        }
      });
    }

    // Role-specific notification for Accountants
    if (index === 0) {
      await prisma.notifications.create({
        data: {
          uuid: generateUUID(),
          target_role: 'ACCOUNTANT',
          title: 'Monthly Payroll Review',
          message: 'Please review the monthly payroll figures for this period.',
          type: 'PAYROLL_ALERT',
          is_read: false,
        }
      });
    }

    // Department-specific notification
    if (index === 5) {
      await prisma.notifications.create({
        data: {
          uuid: generateUUID(),
          target_department_id: employee.department_id,
          title: 'Department Meeting',
          message: 'There will be a department-wide meeting tomorrow at 10 AM.',
          type: 'DEPARTMENT_ALERT',
          is_read: false,
        }
      });
    }
  }

  // Seed Admin notifications
  await prisma.notifications.create({
    data: {
      uuid: generateUUID(),
      user_id: null, // Global admin notification
      title: 'New Registration Requests',
      message: 'There are 5 new registration requests pending approval.',
      type: 'REGISTRATION_REQUEST',
      is_read: false,
    }
  });

  console.log(`Seeded super admin: ${email}`);
  console.log('Removed ADMIN, MANAGER, and ON_MANAGER seed roles.');
  console.log(`Seeded 400 unique users and employees across ${employeeContext.scopes.length} active department/location scope(s).`);
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
