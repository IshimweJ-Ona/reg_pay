/**
 * ═══════════════════════════════════════════════════════════════════
 *  REG PAY — Complete Database Seed
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Execution order (every FK dependency respected):
 *
 *  PHASE 1 — Standalone tables (no user FK needed)
 *    1.  working_locations   (created_by = null initially)
 *    2.  roles
 *    3.  permissions
 *    4.  role_permissions    (join: roles × permissions)
 *    5.  employment_categories
 *    6.  system_config
 *
 *  PHASE 2 — Super Admin bootstrap
 *    7.  HQ department       (needed before any user can be placed)
 *    8.  super_admin user    (placed in HQ + HQ dept)
 *    9.  Patch working_locations.created_by → super_admin
 *
 *  PHASE 3 — Branch departments + Branch Manager users
 *    10. All branch departments (3 per location)
 *    11. Branch manager user accounts (1 per branch, ACTIVE)
 *    12. user_roles for super_admin + all branch managers
 *    13. user_departments    (links users to their home department)
 *    14. branch_managers     (official branch manager assignment)
 *    15. department_managers (manager assigned to admin dept of branch)
 *    16. user_sessions       (pre-seeded refresh token for each BM)
 *
 *  PHASE 4 — Employees
 *    17. employees × 400     (spread evenly across all branches)
 *    18. payment_structures  (1 per employee)
 *
 *  PHASE 5 — Notifications
 *    19. Welcome notifications for branch managers
 *    20. System-wide admin notification
 *
 * ═══════════════════════════════════════════════════════════════════
 *
 *  FIX NOTES (vs previous version):
 *  - The schema does NOT export generic enum names like
 *    WORKING_LOCATION_TYPE / EMPLOYMENT_TYPE / TAX_BEHAVIOUR /
 *    STATUS_USER. Shared concepts use shared enums (person_gender),
 *    while table-specific behavior keeps table-specific enum types
 *    (e.g. employment_categories_payroll_frequency vs
 *    payment_structures_payroll_frequency).
 *  - `updated_at` has no @default/@updatedAt in the schema, so it is
 *    now passed explicitly on every create() AND update() call.
 * ═══════════════════════════════════════════════════════════════════
 */


import {
  PrismaClient,
  working_locations_type,
  employment_categories_payroll_frequency,
  payment_structures_payroll_frequency,
  employment_categories_tax_behavior,
  person_gender,
  employees_status,
  users_status,
} from '@prisma/client';
import { generateUUID } from '../src/common/utils/uuid.util';
import { hashPassword } from '../src/auth/utils/password.util';
import { BASELINE_ROLE_PERMISSIONS, ALL_PERMISSION_KEYS } from '../src/common/constants/permissions.constants';
import * as crypto from 'crypto';


const prisma = new PrismaClient();




// ═══════════════════════════════════════════════════════════════════
// SECTION 3 — REG WORKING LOCATIONS
// ═══════════════════════════════════════════════════════════════════
// HQ is first — used for super admin placement.

const WORKING_LOCATIONS = [
  {
    name:      'REG Headquarters',
    type:       working_locations_type.HQ,
    address:    'KG 7 Ave, Kigali, Rwanda',
    isHQ:       true,
  },
  {
    name:       'REG Kicukiro Branch',
    type:        working_locations_type.BRANCH,
    address:     'KK 5 Rd, Kicukiro, Kigali',
    isHQ:        false,
  },
  {
    name:        'REG Musanze Branch',
    type:        working_locations_type.BRANCH,
    address:     'Musanze District, Northern Province',
    isHQ:         false,
  },
  {
    name:    'REG Rubavu Branch',
    type:    working_locations_type.BRANCH,
    address: 'Rubavu District, Western Province',
    isHQ:    false,
  },
  {
    name:    'REG Huye Branch',
    type:    working_locations_type.BRANCH,
    address: 'Huye District, Southern Province',
    isHQ:    false,
  },
  {
    name:    'REG Muhanga Branch',
    type:    working_locations_type.BRANCH,
    address: 'Muhanga District, Southern Province',
    isHQ:    false,
  },
  {
    name:    'REG Rusizi Branch',
    type:    working_locations_type.BRANCH,
    address: 'Rusizi District, Western Province',
    isHQ:    false,
  },
  {
    name:    'REG Nyagatare Branch',
    type:    working_locations_type.BRANCH,
    address: 'Nyagatare District, Eastern Province',
    isHQ:    false,
  },
  {
    name:    'REG Rwamagana Branch',
    type:    working_locations_type.BRANCH,
    address: 'Rwamagana District, Eastern Province',
    isHQ:    false,
  },
  {
    name:    'REG Karongi Branch',
    type:    working_locations_type.BRANCH,
    address: 'Karongi District, Western Province',
    isHQ:    false,
  },
] as const;

// ═══════════════════════════════════════════════════════════════════
// SECTION 4 — DEPARTMENT TEMPLATES
// ═══════════════════════════════════════════════════════════════════
// 3 departments created per working location.
// code is prefixed with location abbreviation to ensure uniqueness
// within each location (DB unique key: working_location_id + code).

const DEPT_TEMPLATES = [
  { suffix: 'ADMIN', name: 'Administration', description: 'Administrative and management.' },
  { suffix: 'FIN',   name: 'Finance',        description: 'Financial management and payroll processing.' },
  { suffix: 'ICT',   name: 'Information & Communication Technology',  description: 'Tech operations and systems maintenance and support.'},
] as const;

// ═══════════════════════════════════════════════════════════════════
// SECTION 5 — EMPLOYEE NAME POOLS (names — 60+ unique)
// ═══════════════════════════════════════════════════════════════════

const MALE_FIRST_NAMES = [
  'Jean', 'Eric', 'Patrick', 'Emmanuel', 'Olivier', 'Theophile', 'Fabrice',
  'Samuel', 'Bosco', 'Claude', 'Alexis', 'Celestin', 'Desire', 'Fidele',
  'Gerard', 'Herve', 'Innocent', 'Jacques', 'Kevin', 'Leon', 'Marcel',
  'Nathan', 'Oscar', 'Pierre', 'Raphael', 'Serge', 'Thierry', 'Ulysse',
  'Vincent', 'Xavier', 'Yves', 'Zacharie', 'Arnaud', 'Bernard', 'Cedric',
  'Didier', 'Edouard', 'Florent', 'Guillaume', 'Hugo', 'Ignace', 'Jerome',
];

const FEMALE_FIRST_NAMES = [
  'Aline', 'Claudine', 'Diane', 'Grace', 'Nadia', 'Alice', 'Chantal',
  'Josiane', 'Sandrine', 'Yvette', 'Amina', 'Beatrice', 'Clarisse',
  'Delphine', 'Esperance', 'Francine', 'Germaine', 'Helene', 'Immaculee',
  'Jacqueline', 'Ketty', 'Laetitia', 'Marie', 'Nadege', 'Olive',
  'Pascaline', 'Rachelle', 'Solange', 'Therese', 'Ursule', 'Valerie',
  'Wivine', 'Xaverie', 'Yvonne', 'Zoe', 'Agnes', 'Brigitte', 'Celestine',
  'Denise', 'Elise', 'Fabiola', 'Georgette', 'Honorine', 'Isabelle',
];

const LAST_NAMES = [
  'Uwimana', 'Niyonsenga', 'Mukamana', 'Habimana', 'Uwamahoro',
  'Nkurunziza', 'Ishimwe', 'Bizimana', 'Mutoni', 'Twagirayezu',
  'Mukeshimana', 'Nsengiyumva', 'Uwizeyimana', 'Hakizimana', 'Mutesi',
  'Nshimiyimana', 'Mugisha', 'Kayitesi', 'Rukundo', 'Munyaneza',
  'Ndayisaba', 'Uwase', 'Gasana', 'Kanyamibwa', 'Nzeyimana',
  'Irakoze', 'Byiringiro', 'Ntakirutimana', 'Uwiringiyimana', 'Habiyaremye',
  'Nsabimana', 'Tuyisenge', 'Ndagijimana', 'Uwingabire', 'Kamanzi',
  'Musabimana', 'Ruremesha', 'Niragire', 'Hategekimana', 'Niyomugabo',
  'Kabagwira', 'Mukansanga', 'Nyiraneza', 'Uwantege', 'Nzabonimpa',
  'Dusabimana', 'Twagirimana', 'Niyigena', 'Bucyensenge', 'Nyirakamana',
];

// ═══════════════════════════════════════════════════════════════════
// SECTION 5B — UNIQUE NAME-PAIR GENERATOR
// ═══════════════════════════════════════════════════════════════════
// The old approach (`firstNames[i % firstNames.length]`, similarly for
// last names) wraps around every ~42-50 iterations, so with 400 employees
// split across two gender pools of ~200 each, the SAME first+last name
// combination reused every couple dozen rows — looking like duplicated
// data even though every employee row is otherwise distinct. This walks
// both pools with different strides and skips any (first, last) pair
// already used, guaranteeing distinct full names up to
// firstNames.length * lastNames.length combinations.
function buildUniqueNamePairs(
  firstNames: readonly string[],
  lastNames: readonly string[],
  count: number,
): Array<[string, string]> {
  const maxCombinations = firstNames.length * lastNames.length;
  if (count > maxCombinations) {
    throw new Error(
      `Requested ${count} unique name pairs but only ${maxCombinations} combinations are possible with the given name pools.`,
    );
  }

  const pairs: Array<[string, string]> = [];
  const used = new Set<string>();
  let firstCursor = 0;
  let lastCursor = 0;

  while (pairs.length < count) {
    const first = firstNames[firstCursor % firstNames.length];
    const last = lastNames[lastCursor % lastNames.length];
    const key = `${first}|${last}`;

    if (!used.has(key)) {
      used.add(key);
      pairs.push([first, last]);
    }

    firstCursor += 1;
    lastCursor += 7; // coprime-ish stride vs. most pool sizes used here, so both fields cycle through their full range instead of just one of them
  }

  return pairs;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 6 — AVATAR URL GENERATORS
// ═══════════════════════════════════════════════════════════════════
// randomuser.me provides real human face photos, served over HTTPS,
// and renders correctly in any browser. 99 unique per gender.

function maleAvatarUrl(index: number): string {
  return `https://randomuser.me/api/portraits/men/${(index % 99) + 1}.jpg`;
}

function femaleAvatarUrl(index: number): string {
  return `https://randomuser.me/api/portraits/women/${(index % 99) + 1}.jpg`;
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 7 — UNIQUE DATA GENERATORS
// ═══════════════════════════════════════════════════════════════════

function generatePhone(index: number): string {
  // MTN/Airtel mobile prefixes, WITHOUT the leading 0 — that 0 is only used
  // in local dialing format (078...); in E.164 international format
  // (+250...) it's dropped, giving +250 78 XXX XXXX (9 digits after +250).
  const prefixes = ['78', '79', '72', '73'];
  const prefix = prefixes[index % prefixes.length];
  const number = String(1000000 + index).slice(-7);
  return `+250${prefix}${number}`;
}

function generateEmail(firstName: string, lastName: string, index: number): string {
  const domain = index % 3 === 0 ? 'reg.rw' : index % 3 === 1 ? 'gmail.com' : 'yahoo.com';
  const base = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
  // Add index suffix to guarantee uniqueness even if names collide
  return `${base}${index + 1}@${domain}`;
}

function generateNationalId(index: number): string {
  // Rwandan National ID: 16 digits, format: 1 YYYY XXXXXXXXXXX
  //  - "1"  : 1 digit  (nationality/category marker)
  //  - YYYY : 4 digits (birth year)
  //  - X*11 : 11 digits (sequence) — 1 + 4 + 11 = 16 total.
  const year = 1970 + (index % 35); //1970-2004
  const seq = String(index + 1).padStart(11, '0');
  return `1${year}${seq}`;
}

// Deterministic fake refresh token for seeded sessions
function generateRefreshTokenHash(userId: bigint, locationName: string): string {
  return crypto
    .createHash('sha256')
    .update(`seed-refresh-${userId}-${locationName}-regpay2026`)
    .digest('hex');
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 8 — LOCATION CODE ABBREVIATION
// ═══════════════════════════════════════════════════════════════════

function locationCode(locationName: string): string {
  const map: Record<string, string> = {
    'REG Headquarters':        'HQ',
    'REG Kicukiro Branch':    'KIC',
    'REG Musanze Branch':  'MSZ',
    'REG Rubavu Branch':   'RBV',
    'REG Huye Branch':     'HUY',
    'REG Muhanga Branch':  'MHG',
    'REG Rusizi Branch':   'RSZ',
    'REG Nyagatare Branch':'NYG',
    'REG Rwamagana Branch':'RWM',
    'REG Karongi Branch':  'KRG',
  };
  return map[locationName] ?? locationName.substring(0, 3).toUpperCase();
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           REG PAY — DATABASE SEED STARTING              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.1 — WORKING LOCATIONS
  console.log('   PHASE 1 — Foundation tables'  );
  console.log('   Seeding working locations...' );

  const locationRecords = new Map<string, { id: bigint; isHQ: boolean }>();

  for (const loc of WORKING_LOCATIONS) {
    const record = await prisma.working_locations.upsert({
      where: { name: loc.name },
      update: { address: loc.address, type: loc.type, updated_at: new Date() },
      create: {
        uuid:    generateUUID(),
        name:    loc.name,
        type:    loc.type,
        address: loc.address,
        updated_at: new Date(),
      },
    });
    locationRecords.set(loc.name, { id: record.id, isHQ: loc.isHQ });
    console.log( `${loc.type === 'HQ' ? '' : ''} ${loc.name}`);
  }

  const hqRecord = [...locationRecords.entries()].find(([, v]) => v.isHQ)!;
  const hqId = hqRecord[1].id;

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.2 — ROLES
  // level_order: 1 = highest privilege (SUPER_ADMIN), ascending down.
  
  console.log('\n   Seeding roles...');

  const roleIdMap = new Map<string, bigint>();
  let levelOrder  = 1;
  const rolesToSeed = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'HR', 'ATTENDANT', 'FINANCE'];

  for (const roleName of rolesToSeed) {
    const desc = roleName === 'SUPER_ADMIN'
      ? 'Full platform administrator with unrestricted access.'
      : roleName === 'BRANCH_MANAGER'
        ? 'Branch administrator, full control scoped to their assigned branch.'
        : `${roleName.replace(/_/g, ' ')} role.`;

    const keys = roleName === 'SUPER_ADMIN'
      ? ALL_PERMISSION_KEYS
      : (BASELINE_ROLE_PERMISSIONS[roleName] ?? []);

    // Use findFirst + create/update instead of upsert because Prisma runtime
    // rejects `null` in composite unique key fields (uq_role_name_per_location).
    let role = await prisma.roles.findFirst({
      where: { name: roleName, working_location_id: null },
    });

    if (role) {
      role = await prisma.roles.update({
        where: { id: role.id },
        data:  { description: desc, level_order: levelOrder, permission_keys: keys },
      });
    } else {
      role = await prisma.roles.create({
        data: {
          uuid:            generateUUID(),
          name:            roleName,
          description:     desc,
          level_order:     levelOrder,
          permission_keys: keys,
          working_location_id: null, // global/system role, not scoped to a branch
        },
      });
    }

    roleIdMap.set(roleName, role.id);
    levelOrder++;
    console.log(`  Role: ${roleName} (level ${role.level_order})`);
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.5 — EMPLOYMENT CATEGORIES
  // status field is required — original seed was missing this.

  console.log('\n   Seeding employment categories...');
  
  const catIdMap = new Map<string, bigint>();
  
  const categories = [
    { name: 'Monthly', freq: employment_categories_payroll_frequency.MONTHLY, tax: employment_categories_tax_behavior.STANDARD, desc: 'Salaried employees on monthly payroll with standard income tax.' },
    { name: 'Daily',   freq: employment_categories_payroll_frequency.DAILY,   tax: employment_categories_tax_behavior.EXEMPT,   desc: 'Attendance-based workers paid per day, tax-exempt.' },
    { name: 'Custom',  freq: employment_categories_payroll_frequency.CUSTOM,  tax: employment_categories_tax_behavior.PERIODIC,  desc: 'Contract workers with custom schedules and periodic tax treatment.' },
  ];
  
  for (const cat of categories) {
    const record = await prisma.employment_categories.upsert({
      where:  { name: cat.name },
      update: { status: 'ACTIVE', updated_at: new Date() },
      create: {
        uuid:              generateUUID(),
        name:              cat.name,
        payroll_frequency: cat.freq,
        tax_behavior:      cat.tax,
        description:       cat.desc,
        status:            'ACTIVE',
        updated_at:        new Date(),
      },
    });
    catIdMap.set(cat.name, record.id);
    console.log(`   Category: ${cat.name} (${cat.freq} / ${cat.tax})`);
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.6 — SYSTEM CONFIG
  // Key-value store for global settings. update: {} to preserve
  // any manual changes made in production after initial seed.
  
  console.log('\n   Seeding system config...');
  
  const systemConfigs = [
    { key: 'GLOBAL_TAX_RATE',        value: '15',                 desc: 'Global tax rate (%) for employees working > 21 days/month.' },
    { key: 'GLOBAL_TAX_DESCRIPTION', value: 'Standard Income Tax', desc: 'Tax label shown on payslips and payroll reports.' },
    { key: 'DEFAULT_WORK_HOURS',     value: '8',                  desc: 'Default working hours per day. Hours worked beyond this on a given day trigger the flat overtime bonus (OVERTIME_RATE_PER_HOUR).' },
    { key: 'OVERTIME_RATE_PER_HOUR', value: '2500',                desc: 'Flat overtime bonus (RWF) paid for any day worked beyond DEFAULT_WORK_HOURS.' },
  ];
  
  for (const cfg of systemConfigs) {
    await prisma.system_config.upsert({
      where:  { key: cfg.key },
      update: { updated_at: new Date() },
      create: { uuid: generateUUID(), key: cfg.key, value: cfg.value, description: cfg.desc, updated_at: new Date() },
    });
    console.log(`    Config: ${cfg.key} = ${cfg.value}`);
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.7 — MONTHLY TAXES
  console.log('\n   Seeding monthly taxes...');
  const monthlyTaxes = [
    { name: 'PAYE (Income Tax)', rate: 15 },
    { name: 'RSSB Pension', rate: 3 },
    { name: 'Maternity Leave Fund', rate: 0.3 },
  ];

  for (const tax of monthlyTaxes) {
    const existingTax = await prisma.monthly_taxes.findFirst({
      where: { name: tax.name },
    });

    if (existingTax) {
      await prisma.monthly_taxes.update({
        where: { id: existingTax.id },
        data: { rate: tax.rate, is_active: true, updated_at: new Date() },
      });
    } else {
      await prisma.monthly_taxes.create({
        data: {
          uuid: generateUUID(),
          name: tax.name,
          rate: tax.rate,
          effective_from: new Date(Date.UTC(2024, 0, 1)), // Jan 1st 2024
          is_active: true,
          updated_at: new Date(),
        },
      });
    }
    console.log(`    Tax: ${tax.name} (${tax.rate}%)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 2 — SUPER ADMIN BOOTSTRAP
  // ─────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log(' PHASE 2 — Super Admin bootstrap');

  const hqDept = await prisma.departments.upsert({
    where: { working_location_id_code: { working_location_id: hqId, code: 'HQ-ADMIN' } },
    update: { status: 'ACTIVE', updated_at: new Date() },
    create: {
      uuid:       generateUUID(),
      working_location_id: hqId,
      code:     'HQ-ADMIN',
      name:    'Administration',
      description:  'HQ administration and system management department.',
      status:              'ACTIVE',
      updated_at: new Date(),
    },
  });

  console.log(`    HQ department created: ${hqDept.name}`);

  // Create super admin user
  const adminEmail    = process.env.SEED_SUPER_ADMIN_EMAIL    ?? 'admin@reg.rw';
  const adminPhone    = process.env.SEED_SUPER_ADMIN_PHONE    ?? '+250788000000';
  const adminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'Admin@RegPay2024!';

  const superAdmin = await prisma.users.upsert({
    where: { email: adminEmail },
    update: {
      status:    users_status.ACTIVE,
      working_location_id: hqId,
      department_id:   hqDept.id,
      updated_at: new Date(),
    },
    create: {
      uuid:                generateUUID(),
      first_name:          'System',
      last_name:           'Administrator',
      email:               adminEmail,
      phone_number:        adminPhone,
      password_hash:       await hashPassword(adminPassword),
      gender:              person_gender.MALE,
      status:              users_status.ACTIVE,
      working_location_id: hqId,
      department_id:       hqDept.id,
      avatar_url:          'https://randomuser.me/api/portraits/men/0.jpg',
      updated_at:          new Date(),
    },
  });

  console.log(`    Super admin created: ${adminEmail}`);

  // Assign SUPER_ADMIN role
  await prisma.user_roles.upsert({
    where: { user_id_role_id: { user_id: superAdmin.id, role_id: roleIdMap.get('SUPER_ADMIN')! } },
    update: {},
    create: { user_id: superAdmin.id, role_id: roleIdMap.get('SUPER_ADMIN')! },
  });

  // Link super admin to HQ department in user_departments
  await prisma.user_departments.upsert({
    where: { user_id_department_id: { user_id: superAdmin.id, department_id: hqDept.id } },
    update: {},
    create: { user_id: superAdmin.id, department_id: hqDept.id },
  });

  await prisma.working_locations.updateMany({
    where: { created_by: null },
    data:  { created_by: superAdmin.id, updated_at: new Date() },
  });
  
  console.log(`    working_locations.created_by patched → super admin`);

  // ─────────────────────────────────────────────────────────────────
  // PHASE 3 — BRANCH DEPARTMENTS + BRANCH MANAGERS
  // ─────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log(' PHASE 3 — Branch departments & Branch Managers');
  
  const bmPassword = 'Branch@Manager2024!';
  const bmPasswordHash = await hashPassword(bmPassword);
  
  // Track all created departments keyed by "locationId-suffix"
  const deptMap = new Map<string, bigint>();
  // Store branch managers for terminal summary
  const branchManagerSummary: Array<{
    branch: string;
    name: string;
    email: string;
    phone: string;
    password: string;
  }> = [];
  
  // Get only branch locations (not HQ)
  const branchLocations = [...locationRecords.entries()].filter(([, v]) => !v.isHQ);

  // Reserve unique name pairs for branch managers up front (gender alternates
  // by branch index below: even -> MALE, odd -> FEMALE), so no two branch
  // managers ever get the same full name, and the reservation is sized
  // exactly to how many of each gender we'll actually create.
  const bmMaleCount = Math.ceil(branchLocations.length / 2);
  const bmFemaleCount = Math.floor(branchLocations.length / 2);
  const bmMaleNamePairs = buildUniqueNamePairs(MALE_FIRST_NAMES, LAST_NAMES, bmMaleCount);
  const bmFemaleNamePairs = buildUniqueNamePairs(FEMALE_FIRST_NAMES, LAST_NAMES, bmFemaleCount);

  let bmAvatarIndex = 1;
  
  for (const [locName, locData] of branchLocations) {
    const locCode = locationCode(locName);
    console.log(`\n    Setting up ${locName}...`);
  
    // ── Create 3 departments for this branch ──────────────────────
    let adminDeptId: bigint | null = null;
  
    for (const tmpl of DEPT_TEMPLATES) {
      const code = `${locCode}-${tmpl.suffix}`;
      const dept = await prisma.departments.upsert({
        where: { working_location_id_code: { working_location_id: locData.id, code } },
        update: { status: 'ACTIVE', updated_at: new Date() },
        create: {
          uuid:                generateUUID(),
          working_location_id: locData.id,
          code,
          name:                tmpl.name,
          description:         `${tmpl.description} — ${locName}`,
          status:              'ACTIVE',
          updated_at:          new Date(),
        },
      });
  
      deptMap.set(`${locData.id}-${tmpl.suffix}`, dept.id);
      if (tmpl.suffix === 'ADMIN') adminDeptId = dept.id;
  
      console.log(`       Dept: ${dept.name} [${code}]`);
    }
  
    // ── Create Branch Manager user ────────────────────────────────
    // Gender alternates per branch for variety
    const bmIndex = branchLocations.indexOf(branchLocations.find(([n]) => n === locName)!);
    const bmGender = bmIndex % 2 === 0 ? person_gender.MALE : person_gender.FEMALE;
    const bmGenderIndex = Math.floor(bmIndex / 2);
    const [bmFirstName, bmLastName] = bmGender === person_gender.MALE
      ? bmMaleNamePairs[bmGenderIndex]
      : bmFemaleNamePairs[bmGenderIndex];
    const bmEmail     = `bm.${locCode.toLowerCase()}@reg.rw`;
    const bmPhone     = generatePhone(9000 + bmIndex); // offset to avoid employee conflicts
    const bmAvatar    = bmGender === person_gender.MALE
      ? maleAvatarUrl(bmAvatarIndex)
      : femaleAvatarUrl(bmAvatarIndex);
    bmAvatarIndex++;
  
    const bmUser = await prisma.users.upsert({
      where:  { email: bmEmail },
      update: {
        status:              users_status.ACTIVE,
        working_location_id: locData.id,
        department_id:       adminDeptId,
        updated_at:          new Date(),
      },
      create: {
        uuid:                generateUUID(),
        first_name:          bmFirstName,
        last_name:           bmLastName,
        email:               bmEmail,
        phone_number:        bmPhone,
        password_hash:       bmPasswordHash,
        gender:              bmGender,
        status:              users_status.ACTIVE,   // ACTIVE = approved, can login immediately
        working_location_id: locData.id,
        department_id:       adminDeptId,
        avatar_url:          bmAvatar,
        updated_at:          new Date(),
      },
    });
  
    // ── Assign BRANCH_MANAGER role ────────────────────────────────
    await prisma.user_roles.upsert({
      where: { user_id_role_id: { user_id: bmUser.id, role_id: roleIdMap.get('BRANCH_MANAGER')! } },
      update: {},
      create: { user_id: bmUser.id, role_id: roleIdMap.get('BRANCH_MANAGER')! },
    });
  
    // ── Link to admin department in user_departments ──────────────
    if (adminDeptId) {
      await prisma.user_departments.upsert({
        where: { user_id_department_id: { user_id: bmUser.id, department_id: adminDeptId } },
        update: {},
        create: { user_id: bmUser.id, department_id: adminDeptId },
      });
    }
  
    // ── Register in branch_managers table ─────────────────────────
    // assigned_by = super admin, is_active = true
    const existingBm = await prisma.branch_managers.findFirst({
      where: { working_location_id: locData.id, user_id: bmUser.id },
    });
  
    if (!existingBm) {
      await prisma.branch_managers.create({
        data: {
          uuid:                generateUUID(),
          working_location_id: locData.id,
          user_id:             bmUser.id,
          is_active:           true,
          assigned_by:         superAdmin.id,
        },
      });
    }
  
    // ── Create pre-seeded user session (so BM can login immediately) ──
    // This gives them a valid refresh token without needing to call /auth/login first.
    // The token hash is deterministic — useful for testing API calls directly.
    const tokenHash = generateRefreshTokenHash(bmUser.id, locName);
    const sessionExpiry = new Date();
    sessionExpiry.setDate(sessionExpiry.getDate() + 30); // 30 days from seed date
  
    const existingSession = await prisma.user_sessions.findFirst({
      where: { user_id: bmUser.id },
    });
  
    if (!existingSession) {
      await prisma.user_sessions.create({
        data: {
          uuid:               generateUUID(),
          user_id:            bmUser.id,
          refresh_token_hash: tokenHash,
          device_info:        'Seed Session — Testing Device',
          ip_address:         '127.0.0.1',
          is_revoked:         false,
          expires_at:         sessionExpiry,
        },
      });
    }
  
    // ── Welcome notification for this branch manager ──────────────
    await prisma.notifications.create({
      data: {
        uuid:      generateUUID(),
        user_id:   bmUser.id,
        sender_id: superAdmin.id,
        title:     'Welcome to REG Pay',
        message:   `Hello ${bmFirstName}, you have been assigned as Branch Manager for ${locName}. Your account is active and ready.`,
        type:      'SYSTEM_ALERT',
        is_read:   false,
        updated_at: new Date(),
      },
    });
  
    branchManagerSummary.push({
      branch:   locName,
      name:     `${bmFirstName} ${bmLastName}`,
      email:    bmEmail,
      phone:    bmPhone,
      password: bmPassword,
    });
  
    console.log(`       Branch Manager: ${bmFirstName} ${bmLastName} <${bmEmail}>`);
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 4 — EMPLOYEES × 400
  // Spread evenly across all 10 working locations.
  // Each employee gets a payment_structure immediately.

  console.log('\n');
  console.log(' PHASE 4 — Seeding 400 employees...');

  const allLocations = [...locationRecords.entries()];
  const categoryNames = ['Monthly', 'Daily', 'Custom'];
  const TOTAL_EMPLOYEES = 400;

  // Pre-collect all department IDs per location for fast lookup
  const locationDeptIds = new Map<bigint, bigint[]>();

  for (const [, locData] of allLocations) {
    const depts = await prisma.departments.findMany({
      where: { working_location_id: locData.id, status: 'ACTIVE' },
      select: { id: true},
    });
    locationDeptIds.set(locData.id, depts.map((d) => d.id));
  }

  // 200 female + 200 male employees (i alternates even/odd below) — build
  // that many guaranteed-unique name pairs per gender up front instead of
  // repeatedly wrapping around the ~42-44 first names mid-loop.
  const employeeMaleNamePairs = buildUniqueNamePairs(MALE_FIRST_NAMES, LAST_NAMES, Math.ceil(TOTAL_EMPLOYEES / 2));
  const employeeFemaleNamePairs = buildUniqueNamePairs(FEMALE_FIRST_NAMES, LAST_NAMES, Math.floor(TOTAL_EMPLOYEES / 2));

  for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
    const gender = i % 2 === 0 ? person_gender.FEMALE : person_gender.MALE;
    const genderIndex = Math.floor(i / 2);
    const [firstName, lastName] = gender === person_gender.FEMALE
      ? employeeFemaleNamePairs[genderIndex]
      : employeeMaleNamePairs[genderIndex];
    const avatar = gender === person_gender.FEMALE ? femaleAvatarUrl(i): maleAvatarUrl(i);

    // spread employees across locations
    const locEntry = allLocations[i % allLocations.length];
    const locId    = locEntry[1].id;
    const deptIds  = locationDeptIds.get(locId) ?? [];
    const deptId   = deptIds.length > 0 ? deptIds[i % deptIds.length] : null;
    const categoryId = catIdMap.get(categoryNames[i % 3])!;

    const email = generateEmail(firstName, lastName, i);
    const phone = generatePhone(i);
    const nationalId = generateNationalId(i);
    const hireDate = new Date(Date.UTC(2019 + (i % 6), i % 12, (i % 28) + 1));

    const categoryName = categoryNames[i % 3]; // 'Monthly' | 'Daily' | 'Custom'
    const isContractBased = categoryName === 'Daily' || categoryName === 'Custom';

    // Contract dates only apply to DAILY/CUSTOM employees — MONTHLY
    // employees are salaried and don't have a fixed contract end date.
    let contractStartDate: Date | null = null;
    let contractEndDate: Date | null = null;

    if (isContractBased) {
      // Contract length varies between 8 and 27 days across employees
      // (8, 9, 10, ..., 27 — 20 distinct lengths, cycling by index).
      const contractLengthDays = 8 + (i % 20);

      // Stagger start dates relative to "today" so the seeded data has a
      // realistic mix: some contracts already ended (exercises the
      // auto-pause-on-expiry job), some end soon, some just started.
      const daysOffsetFromToday = (i % 40) - 20; // -20..19
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      start.setUTCDate(start.getUTCDate() + daysOffsetFromToday);

      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + contractLengthDays);

      contractStartDate = start;
      contractEndDate = end;
    }

    const employee = await prisma.employees.upsert({
      where: { national_id: nationalId },
      update: {
        first_name:     firstName,
        last_name:      lastName,
        email:                  email,
        phone_number:           phone,
        gender:                 gender,
        hire_date:              hireDate,
        contract_start_date:    contractStartDate,
        contract_end_date:      contractEndDate,
        department_id:          deptId,
        working_location_id:    locId,
        employment_category_id: categoryId,
        status:                 employees_status.ACTIVE,
        avatar_url:             avatar,
        created_by:             superAdmin.id,
        deleted_at:             null,
        updated_at:             new Date(),
      },
      create: {
        uuid:                   generateUUID(),
        first_name:             firstName,
        last_name:              lastName,
        email:                  email,
        phone_number:           phone,
        national_id:            nationalId,
        gender:                 gender,
        hire_date:              hireDate,
        contract_start_date:    contractStartDate,
        contract_end_date:      contractEndDate,
        department_id:          deptId,
        working_location_id:    locId,
        employment_category_id: categoryId,
        status:                 employees_status.ACTIVE,
        avatar_url:             avatar,
        created_by:             superAdmin.id,
        updated_at:             new Date(),
      },
    });

    // ── Payment Structure for this employee ───────────────────────
    // Each employee gets exactly one active payment structure.
    // basic_salary scales with index so data looks varied in reports.
    // tax_percentage matches GLOBAL_TAX_RATE for STANDARD, 0 for EXEMPT.

    const freq = i % 3 === 0
      ? payment_structures_payroll_frequency.MONTHLY
      : i % 3 === 1
        ? payment_structures_payroll_frequency.DAILY
        : payment_structures_payroll_frequency.CUSTOM;

    const taxPct = categoryNames[i % 3] === 'Daily' ? 0 : 15;
    const effectiveFrom = new Date(hireDate);

    const existingPS = await prisma.payment_structures.findFirst({
      where: { employee_id: employee.id },
    });

    if (!existingPS) {
      await prisma.payment_structures.create({
        data: {
          uuid:        generateUUID(),
          employee_id:       employee.id,
          payroll_frequency: freq,
          basic_salary:      freq === payment_structures_payroll_frequency.MONTHLY ? 150000 : 0,
          daily_rate:        freq === payment_structures_payroll_frequency.MONTHLY ? 5000 : 3000,
          overtime_rate:     2000,
          custom_work_days:  null,
          tax_percentage:    taxPct,
          effective_from:    effectiveFrom,
          effective_to:      null,                 // currently active
          updated_at:        new Date(),
        },
      });
    }

    if ((i + 1) % 50 === 0) {
      console.log(` ${i + 1}/${TOTAL_EMPLOYEES} employees seeded...`)
    }
  }

  console.log(`   All ${TOTAL_EMPLOYEES} employees and payment structures seeded`);

  // ─────────────────────────────────────────────────────────────────
  // PHASE 5 — SYSTEM NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────

  console.log('\n');
  console.log(' PHASE 5 — System notifications');

  // Global admin notification (no specific user — broadcast type)
  await prisma.notifications.create({
    data: {
      uuid:        generateUUID(),
      user_id:     superAdmin.id,
      sender_id:   null,
      target_role: null,
      title:       'System Seeded Successfully',
      message:     `REG Pay has been seeded with ${TOTAL_EMPLOYEES} employees across ${allLocations.length} working locations and ${branchLocations.length} branch managers.`,
      type:        'SYSTEM_ALERT',
      is_read:     false,
      updated_at:  new Date(),
    },
  });

  // Accountant role broadcast (payroll review reminder)
  await prisma.notifications.create({
    data: {
      uuid:        generateUUID(),
      user_id:     null,
      sender_id:   superAdmin.id,
      target_role: 'ACCOUNTANT',
      title:       'Monthly Payroll Review Pending',
      message:     'Please review and process the monthly payroll figures for the current period.',
      type:        'PAYROLL_ALERT',
      is_read:     false,
      updated_at:  new Date(),
    },
  });

  console.log('    System notifications created');

  // ═══════════════════════════════════════════════════════════════════
  // TERMINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    SEED COMPLETE — SUMMARY                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(' SUPER ADMIN');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`   Email    : ${adminEmail}`);
  console.log(`   Password : ${adminPassword}`);
  console.log(`   Location : REG Headquarters`);
  console.log('');
  console.log(' BRANCH MANAGERS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  for (const bm of branchManagerSummary) {
    console.log(`   Branch   : ${bm.branch}`);
    console.log(`   Name     : ${bm.name}`);
    console.log(`   Email    : ${bm.email}`);
    console.log(`   Phone    : ${bm.phone}`);
    console.log(`   Password : ${bm.password}`);
    console.log('   Status   : ACTIVE  (can login immediately)');
    console.log('   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·');
  }
  
  console.log('');
  console.log(' STATISTICS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`   Working locations : ${allLocations.length} (1 HQ + ${branchLocations.length} branches)`);
  console.log(`   Departments       : ${allLocations.length * 3} (3 per location)`);
  console.log(`   Roles             : ${roleIdMap.size}`);
  console.log(`   Permissions       : ${ALL_PERMISSION_KEYS.length}`);
  console.log(`   Branch managers   : ${branchManagerSummary.length}`);
  console.log(`   Employees         : ${TOTAL_EMPLOYEES}`);
  console.log(`   Payment structures: ${TOTAL_EMPLOYEES}`);
  console.log('');
  console.log('  SECURITY REMINDER');
  console.log('   Set SEED_SUPER_ADMIN_PASSWORD env var before seeding production.');
  console.log('   Branch manager password should be rotated after first login.');
  console.log('');
}

// ═══════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════
main()
  .catch(async (error) => {
    console.error('\n SEED FAILED:', error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
