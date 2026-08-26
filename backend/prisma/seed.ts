/**
 * ═══════════════════════════════════════════════════════════════════
 *  REG PAY — Complete Database Seed
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Execution order (every FK dependency respected):
 *
 *  PHASE 1 — Foundation tables
 *    working_locations (each now carries a unique `code`) → roles
 *    (permission_keys built per role, with any `audit.*` key stripped
 *    from every non-SUPER_ADMIN role) → employment_categories →
 *    positions (each position gets all 3 employment-category variants:
 *    Monthly / Daily / Custom, each with its own default pay) →
 *    system_config → monthly_taxes → deduction_types.
 *
 *  PHASE 2 — Super Admin bootstrap
 *    HQ department → super_admin user → patch working_locations.created_by.
 *
 *  PHASE 3 — Branch departments + Branch Managers
 *    3 departments per branch, 1 ACTIVE branch-manager user per branch,
 *    roles/user_departments/branch_managers/user_sessions/welcome notif.
 *
 *  PHASE 3.5 — Additional role users & workflow test accounts
 *    HR @ HQ (final payroll approver) + HR @ branch #1, ACCOUNTANT @ HQ,
 *    ATTENDANT @ branch #1, one PENDING applicant, one SUSPENDED user,
 *    one PAUSED-with-reason branch manager-adjacent case. Created here
 *    (moved up from the old "Phase 6") because payment_batches below
 *    needs a real HR-HQ user id to use as `approved_by`.
 *
 *  PHASE 4 — Employees × 400
 *    Spread across all branches, positions×categories decorrelated (every
 *    position gets employees under all 3 employment-category variants,
 *    not locked 1:1), payment_structures (MONTHLY daily_rate now derived
 *    from basic_salary/22 instead of a flat constant), allowances for
 *    MONTHLY + long-contract CUSTOM employees, ikimina_memberships for
 *    ~50% of ACTIVE employees, PAUSED employees get a pause_reason,
 *    Infrastructure Levy deduction assignment.
 *
 *  PHASE 5 — Attendance (time_records)
 *    ~2.5 months of weekday attendance for every ACTIVE/PAUSED employee,
 *    ~7% deterministic absence rate, batched createMany (skipDuplicates).
 *
 *  PHASE 6 — Payroll batches, transactions, payment_batch_items
 *    2-3 batches per working location across recent months, in a mix of
 *    statuses (APPROVED/PAID, PENDING or IN_REVIEW, REJECTED), with
 *    batch aggregate totals actually summed from their transactions.
 *
 *  PHASE 7 — System notifications + permission overrides
 *
 * ═══════════════════════════════════════════════════════════════════
 *
 *  FIX NOTES (vs previous version):
 *  - working_locations.code (new required unique column) is now set on
 *    every seeded location.
 *  - Positions now offer all 3 employment-category variants instead of
 *    being locked 1:1 to a single one, and employees are distributed
 *    across position × category combinations instead of a fixed i % 3
 *    lockstep, so every position has employees under more than one
 *    employment-category variant.
 *  - MONTHLY payment_structures.daily_rate is now basic_salary / 22
 *    (DEFAULT_MONTHLY_WORK_DAYS) instead of a flat 5000, matching
 *    calculateMonthlyDailyRate() semantics used by payroll.service.ts.
 *  - allowances, ikimina_memberships, time_records, and
 *    payment_batches/transactions/payment_batch_items are now seeded
 *    (previously all zero rows "by design").
 *  - audit.* permission keys are stripped from every non-SUPER_ADMIN
 *    role's permission_keys array at seed time.
 *  - permissions / role_permissions relational tables are intentionally
 *    NOT populated — nothing in src/ ever reads them; roles.permission_keys
 *    (JSON) is the sole source of truth (see effective-permissions.util.ts).
 *  - The schema does NOT export generic enum names like
 *    WORKING_LOCATION_TYPE / EMPLOYMENT_TYPE / TAX_BEHAVIOUR /
 *    STATUS_USER. Shared concepts use shared enums (person_gender),
 *    while table-specific behavior keeps table-specific enum types
 *    (e.g. employment_categories_payroll_frequency vs
 *    payment_structures_payroll_frequency).
 *  - `updated_at` has no @default/@updatedAt in the schema, so it is
 *    passed explicitly on every create() AND update() call.
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
  deduction_types_deduction_mode,
  time_records_attendance_status,
  payment_batches_status,
  payment_batch_items_status,
  transactions_transaction_status,
  transactions_payment_method,
} from '@prisma/client';
import { generateUUID } from '../src/common/utils/uuid.util';
import { hashPassword } from '../src/auth/utils/password.util';
import { BASELINE_ROLE_PERMISSIONS, ALL_PERMISSION_KEYS } from '../src/common/constants/permissions.constants';
import { calculateRwandaPaye } from '../src/common/utils/tax.util';
import { DEFAULT_MONTHLY_WORK_DAYS } from '../src/common/utils/payroll-calc.util';
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
  // Matches RWANDA_PHONE_REGEX = /^\+2507[2389][0-9]{7}$/ in
  // validation.constants.ts: +2507 then one of [2,3,8,9] then 7 digits.
  const prefixes = ['78', '79', '72', '73'];
  const prefix = prefixes[index % prefixes.length];
  const number = String(1000000 + index).slice(-7);
  return `+250${prefix}${number}`;
}

function generateEmail(firstName: string, lastName: string, index: number): string {
  // Matches REG_EMAIL_REGEX (gmail.com / reg.com / yahoo.com / reg.rw).
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
  // Matches RWANDA_NATIONAL_ID_REGEX = /^\d{16}$/.
  const year = 1970 + (index % 35); //1970-2004
  const seq = String(index + 1).padStart(11, '0');
  return `1${year}${seq}`;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function monthsBetweenInclusive(start: Date, end: Date): number {
  return (
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    end.getUTCMonth() -
    start.getUTCMonth() +
    1
  );
}

function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function buildEmployeeHireDates(
  totalEmployees: number,
  startMonth: Date,
  today: Date,
): Date[] {
  const monthCount = monthsBetweenInclusive(startMonth, today);
  const weights = Array.from({ length: monthCount }, (_, monthOffset) => {
    const baseline = 8 + ((monthOffset * 5) % 9);
    const hiringWave = monthOffset % 6 === 0 ? 10 : monthOffset % 5 === 0 ? 5 : 0;
    const quietMonth = monthOffset % 7 === 3 ? -4 : 0;
    return Math.max(4, baseline + hiringWave + quietMonth);
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const quotas = weights.map((weight) =>
    Math.floor((totalEmployees * weight) / totalWeight),
  );
  let assigned = quotas.reduce((sum, quota) => sum + quota, 0);

  const remainders = weights
    .map((weight, monthOffset) => ({
      monthOffset,
      remainder: (totalEmployees * weight) / totalWeight - quotas[monthOffset],
    }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let cursor = 0; assigned < totalEmployees; cursor += 1, assigned += 1) {
    quotas[remainders[cursor % remainders.length].monthOffset] += 1;
  }

  const dates: Date[] = [];
  quotas.forEach((quota, monthOffset) => {
    const monthStart = addUtcMonths(startMonth, monthOffset);
    const isCurrentMonth =
      monthStart.getUTCFullYear() === today.getUTCFullYear() &&
      monthStart.getUTCMonth() === today.getUTCMonth();
    const maxDay = isCurrentMonth
      ? today.getUTCDate()
      : daysInUtcMonth(monthStart.getUTCFullYear(), monthStart.getUTCMonth());
    const dayLimit = Math.min(maxDay, 28);

    for (let hireIndex = 0; hireIndex < quota; hireIndex += 1) {
      const day = 1 + ((hireIndex * 5 + monthOffset * 3) % dayLimit);
      dates.push(
        new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day)),
      );
    }
  });

  return dates;
}

function employeeSeedStatus(index: number, hireDate: Date, today: Date): employees_status {
  const monthsSinceHire =
    (today.getUTCFullYear() - hireDate.getUTCFullYear()) * 12 +
    today.getUTCMonth() -
    hireDate.getUTCMonth();

  if (monthsSinceHire <= 2 && index % 17 === 0) return employees_status.PENDING;
  if (monthsSinceHire <= 3 && index % 43 === 0) return employees_status.REJECTED;
  if (monthsSinceHire >= 6 && index % 37 === 0) return employees_status.PAUSED;
  if (monthsSinceHire >= 9 && index % 53 === 0) return employees_status.SUSPENDED;
  if (monthsSinceHire >= 12 && index % 61 === 0) return employees_status.INACTIVE;

  return employees_status.ACTIVE;
}

const PAUSE_REASONS = [
  'Contract renewal under review.',
  'Temporary leave of absence.',
  'Pending department reassignment.',
  'Awaiting updated background/security check.',
];

function pauseReasonFor(index: number): string {
  return PAUSE_REASONS[index % PAUSE_REASONS.length];
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
// working_locations.code is a new required unique column (max 12 chars).

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
// SECTION 9 — SMALL DETERMINISTIC PRNG
// ═══════════════════════════════════════════════════════════════════
// Seeded pseudo-random helpers so re-running the seed against a fresh DB
// always produces the same "randomized-looking" data (reproducible tests)
// without needing a real RNG dependency.

function seededRand(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randInt(seed: number, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(seededRand(seed) * (max - min + 1));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
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

  const today = startOfUtcDay(new Date());
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.1 — WORKING LOCATIONS
  console.log('   PHASE 1 — Foundation tables'  );
  console.log('   Seeding working locations...' );

  const locationRecords = new Map<string, { id: bigint; isHQ: boolean }>();

  for (const loc of WORKING_LOCATIONS) {
    const code = locationCode(loc.name);
    const record = await prisma.working_locations.upsert({
      where: { name: loc.name },
      update: { address: loc.address, type: loc.type, code, updated_at: new Date() },
      create: {
        uuid:    generateUUID(),
        name:    loc.name,
        code,
        type:    loc.type,
        address: loc.address,
        updated_at: new Date(),
      },
    });
    locationRecords.set(loc.name, { id: record.id, isHQ: loc.isHQ });
    console.log( `${loc.type === 'HQ' ? '' : ''} ${loc.name} [${code}]`);
  }

  const hqRecord = [...locationRecords.entries()].find(([, v]) => v.isHQ)!;
  const hqId = hqRecord[1].id;

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.2 — ROLES
  // level_order: 1 = highest privilege (SUPER_ADMIN), ascending down.
  // audit.* permission keys are admin-only: strip them from every role
  // except SUPER_ADMIN, even if BASELINE_ROLE_PERMISSIONS ever grants one.

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
      : (BASELINE_ROLE_PERMISSIONS[roleName] ?? []).filter((key) => !key.startsWith('audit.'));

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
    console.log(`  Role: ${roleName} (level ${role.level_order}, ${keys.length} permission keys)`);
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
  // PHASE 1.6 — POSITIONS + EMPLOYMENT-CATEGORY VARIANTS
  // Every position now offers all 3 employment-category variants
  // (Monthly / Daily / Custom), each with its own default salary — not
  // locked 1:1 to a single category the way the previous seed did.
  // Deduction types, extra taxes, and allowance *templates* for a
  // position are intentionally left unset here — those are configured
  // later through the running system's Positions UI, not seeded.

  console.log('\n   Seeding positions & their employment-category variants...');

  type VariantDefaults = {
    default_basic_salary: number | null;
    default_daily_rate: number | null;
    default_overtime_rate: number | null;
    default_custom_work_days: number | null;
  };

  const positionSeeds: Array<{
    name: string;
    description: string;
    variants: Record<'Monthly' | 'Daily' | 'Custom', VariantDefaults>;
  }> = [
    {
      name: 'Linesman',
      description: 'Maintains and repairs electricity distribution lines.',
      variants: {
        Monthly: { default_basic_salary: 380000, default_daily_rate: null, default_overtime_rate: 2500, default_custom_work_days: null },
        Daily:   { default_basic_salary: null, default_daily_rate: 7000, default_overtime_rate: 2500, default_custom_work_days: null },
        Custom:  { default_basic_salary: null, default_daily_rate: 7500, default_overtime_rate: 2500, default_custom_work_days: 22 },
      },
    },
    {
      name: 'Driver',
      description: 'Operates and maintains company vehicles for field operations.',
      variants: {
        Monthly: { default_basic_salary: 250000, default_daily_rate: null, default_overtime_rate: 2000, default_custom_work_days: null },
        Daily:   { default_basic_salary: null, default_daily_rate: 6000, default_overtime_rate: 2000, default_custom_work_days: null },
        Custom:  { default_basic_salary: null, default_daily_rate: 6500, default_overtime_rate: 2000, default_custom_work_days: 20 },
      },
    },
    {
      name: 'Electrician',
      description: 'Installs and services electrical systems on fixed-term contracts.',
      variants: {
        Monthly: { default_basic_salary: 420000, default_daily_rate: null, default_overtime_rate: 3000, default_custom_work_days: null },
        Daily:   { default_basic_salary: null, default_daily_rate: 9000, default_overtime_rate: 2500, default_custom_work_days: null },
        Custom:  { default_basic_salary: null, default_daily_rate: 9500, default_overtime_rate: 2500, default_custom_work_days: 20 },
      },
    },
  ];

  const positionIdMap = new Map<string, bigint>();
  // positionName -> categoryName -> variant defaults, used later when
  // assigning payment_structures to employees.
  const positionCategoryDefaults = new Map<string, Map<string, VariantDefaults>>();

  for (const pos of positionSeeds) {
    const record = await prisma.positions.upsert({
      where: { name: pos.name },
      update: {
        status: 'ACTIVE',
        updated_at: new Date(),
      },
      create: {
        uuid: generateUUID(),
        name: pos.name,
        description: pos.description,
        status: 'ACTIVE',
        updated_at: new Date(),
      },
    });
    positionIdMap.set(pos.name, record.id);

    const categoryDefaultsForPosition = new Map<string, VariantDefaults>();
    positionCategoryDefaults.set(pos.name, categoryDefaultsForPosition);

    for (const categoryName of ['Monthly', 'Daily', 'Custom'] as const) {
      const employmentCategoryId = catIdMap.get(categoryName)!;
      const variantData = { ...pos.variants[categoryName], updated_at: new Date() };

      await prisma.position_employment_categories.upsert({
        where: {
          position_id_employment_category_id: {
            position_id: record.id,
            employment_category_id: employmentCategoryId,
          },
        },
        update: variantData,
        create: {
          uuid: generateUUID(),
          position_id: record.id,
          employment_category_id: employmentCategoryId,
          ...variantData,
        },
      });

      categoryDefaultsForPosition.set(categoryName, pos.variants[categoryName]);
    }
    console.log(`   Position: ${pos.name} (Monthly + Daily + Custom variants)`);
  }

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.7 — SYSTEM CONFIG
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
  // PHASE 1.8 — MONTHLY TAXES
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
  // PHASE 1.9 — DEDUCTION TYPES
  // Created early (assignment to specific employees happens later, once
  // employees exist).
  console.log('\n   Seeding deduction types...');

  const infrastructureLevy = await prisma.deduction_types.upsert({
    where: { name: 'Infrastructure Levy' },
    update: { updated_at: new Date() },
    create: {
      uuid: generateUUID(),
      name: 'Infrastructure Levy',
      deduction_mode: deduction_types_deduction_mode.PERCENTAGE,
      amount: 0,
      percentage_value: 2,
      is_mandatory: false,
      updated_at: new Date(),
    },
  });

  // Assignable deduction_types matching the statutory monthly_taxes by name
  // (see employees page's assignableTaxOptions bridge, which pairs a
  // monthly_taxes row to a deduction_types row of the same name so HR can
  // opt an employee/position into it). PAYE/PIT is deliberately not mirrored
  // here - it applies automatically to every STANDARD employee, it is never
  // an opt-in assignment. Not auto-assigned to any position/employee here -
  // that assignment is left for HR to configure live in the running system.
  const rssbPension = await prisma.deduction_types.upsert({
    where: { name: 'RSSB Pension' },
    update: { updated_at: new Date() },
    create: {
      uuid: generateUUID(),
      name: 'RSSB Pension',
      deduction_mode: deduction_types_deduction_mode.PERCENTAGE,
      amount: 0,
      percentage_value: 3,
      is_mandatory: false,
      updated_at: new Date(),
    },
  });
  const maternityLeaveFund = await prisma.deduction_types.upsert({
    where: { name: 'Maternity Leave Fund' },
    update: { updated_at: new Date() },
    create: {
      uuid: generateUUID(),
      name: 'Maternity Leave Fund',
      deduction_mode: deduction_types_deduction_mode.PERCENTAGE,
      amount: 0,
      percentage_value: 0.3,
      is_mandatory: false,
      updated_at: new Date(),
    },
  });
  console.log('    Deduction types: Infrastructure Levy, RSSB Pension, Maternity Leave Fund');

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.9b — ALLOWANCE TYPES CATALOG
  // System-wide allowance catalog that Positions and Employees pick from
  // via dropdown (mirrors the deduction_types catalog above). Kept in sync
  // by name with the ALLOWANCE_POOL used later when seeding per-employee
  // allowances, so every seeded allowance row can link back to one of these.
  console.log('\n   Seeding allowance types...');

  const allowanceTypeSeeds = [
    { name: 'Transport Allowance', default_amount: 20000, description: 'Covers commuting costs for field staff.' },
    { name: 'Housing Allowance', default_amount: 45000, description: 'Monthly housing support for permanent staff.' },
    { name: 'Communication Allowance', default_amount: 7500, description: 'Covers work-related phone/data costs.' },
  ];
  const allowanceTypeIdMap = new Map<string, bigint>();
  for (const seed of allowanceTypeSeeds) {
    const record = await prisma.allowance_types.upsert({
      where: { name: seed.name },
      update: { default_amount: seed.default_amount, description: seed.description, updated_at: new Date() },
      create: {
        uuid: generateUUID(),
        name: seed.name,
        default_amount: seed.default_amount,
        description: seed.description,
        updated_at: new Date(),
      },
    });
    allowanceTypeIdMap.set(seed.name, record.id);
  }
  console.log('    Allowance types: Transport Allowance, Housing Allowance, Communication Allowance');

  // ─────────────────────────────────────────────────────────────────
  // PHASE 1.9c — ATTACH DEFAULT TAXES/DEDUCTIONS AND ALLOWANCE TEMPLATES
  // TO EACH POSITION, so the "assign an employee to Driver + Monthly and
  // it suggests Driver's configured allowance/tax" smart-default flow in
  // the Employees UI has real data to demonstrate.
  console.log('\n   Attaching default deductions/allowances to positions...');

  const positionDefaultDeductions: Record<string, typeof infrastructureLevy[]> = {
    Linesman: [infrastructureLevy, rssbPension],
    Driver: [rssbPension],
    Electrician: [infrastructureLevy, maternityLeaveFund],
  };
  const positionDefaultAllowances: Record<string, Array<{ name: string; amount: number }>> = {
    Linesman: [{ name: 'Transport Allowance', amount: 20000 }],
    Driver: [{ name: 'Transport Allowance', amount: 15000 }, { name: 'Communication Allowance', amount: 5000 }],
    Electrician: [{ name: 'Housing Allowance', amount: 45000 }],
  };

  for (const [posName, posId] of positionIdMap) {
    for (const deductionType of positionDefaultDeductions[posName] ?? []) {
      await prisma.position_deduction_types.upsert({
        where: {
          position_id_deduction_type_id: {
            position_id: posId,
            deduction_type_id: deductionType.id,
          },
        },
        update: {},
        create: {
          uuid: generateUUID(),
          position_id: posId,
          deduction_type_id: deductionType.id,
        },
      });
    }

    for (const allowance of positionDefaultAllowances[posName] ?? []) {
      const allowanceTypeId = allowanceTypeIdMap.get(allowance.name);
      const existing = await prisma.position_allowance_templates.findFirst({
        where: { position_id: posId, title: allowance.name },
      });
      if (existing) {
        await prisma.position_allowance_templates.update({
          where: { id: existing.id },
          data: { default_amount: allowance.amount, allowance_type_id: allowanceTypeId, updated_at: new Date() },
        });
      } else {
        await prisma.position_allowance_templates.create({
          data: {
            uuid: generateUUID(),
            position_id: posId,
            allowance_type_id: allowanceTypeId,
            title: allowance.name,
            default_amount: allowance.amount,
            updated_at: new Date(),
          },
        });
      }
    }
  }
  console.log('    Position defaults attached (deductions + allowance templates).');

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
  const branchManagerUserByLocation = new Map<bigint, bigint>();

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

    branchManagerUserByLocation.set(locData.id, bmUser.id);

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
  // PHASE 3.5 — ADDITIONAL ROLE USERS + WORKFLOW TEST ACCOUNTS
  // ─────────────────────────────────────────────────────────────────
  // Every phase above only ever created BRANCH_MANAGER users, so none of
  // the other baseline roles (HR, ACCOUNTANT, ATTENDANT) had a single real
  // account to log in as, and there was nothing to test approvals,
  // suspensions, or per-user permission overrides against. This phase adds
  // exactly enough of each to exercise those workflows end-to-end. It runs
  // BEFORE employees/payroll batches because Phase 6 (payroll batches)
  // needs a real HR-HQ user id to act as the final approver.
  //   - HR at HQ is the final payroll approver for every branch's batches;
  //     HR at branch #1 exists only to test branch-level workflows (they
  //     have no payroll final-approval authority themselves).
  //   - One PENDING user tests the registration-approval workflow.
  //   - One SUSPENDED user (at branch #2) tests suspend/reactivate and
  //     confirms a suspended user's still-valid token is rejected on the
  //     very next request (see jwt.strategy.ts).
  console.log('\n');
  console.log(' PHASE 3.5 — Additional role users & workflow test accounts');

  const staffPassword = 'Staff@RegPay2024!';
  const staffPasswordHash = await hashPassword(staffPassword);
  const staffSummary: Array<{
    role: string;
    branch: string;
    name: string;
    email: string;
    password: string;
    note?: string;
  }> = [];

  const [branch1Name, branch1Data] = branchLocations[0];
  const [branch2Name, branch2Data] = branchLocations[1] ?? branchLocations[0];
  const branch1Code = locationCode(branch1Name);
  const branch2Code = locationCode(branch2Name);
  const branch1AdminDeptId = deptMap.get(`${branch1Data.id}-ADMIN`) ?? null;
  const branch2AdminDeptId = deptMap.get(`${branch2Data.id}-ADMIN`) ?? null;

  async function upsertStaffUser(opts: {
    email: string;
    firstName: string;
    lastName: string;
    gender: person_gender;
    phoneIndex: number;
    workingLocationId: bigint | null;
    departmentId: bigint | null;
    status: users_status;
    roleName?: string;
  }) {
    const staffUser = await prisma.users.upsert({
      where: { email: opts.email },
      update: {
        status: opts.status,
        working_location_id: opts.workingLocationId,
        department_id: opts.departmentId,
        updated_at: new Date(),
      },
      create: {
        uuid: generateUUID(),
        first_name: opts.firstName,
        last_name: opts.lastName,
        email: opts.email,
        phone_number: generatePhone(9500 + opts.phoneIndex),
        password_hash: staffPasswordHash,
        gender: opts.gender,
        status: opts.status,
        working_location_id: opts.workingLocationId,
        department_id: opts.departmentId,
        avatar_url:
          opts.gender === person_gender.MALE
            ? maleAvatarUrl(50 + opts.phoneIndex)
            : femaleAvatarUrl(50 + opts.phoneIndex),
        updated_at: new Date(),
      },
    });

    if (opts.roleName) {
      const roleId = roleIdMap.get(opts.roleName)!;
      await prisma.user_roles.upsert({
        where: { user_id_role_id: { user_id: staffUser.id, role_id: roleId } },
        update: {},
        create: { user_id: staffUser.id, role_id: roleId },
      });
    }

    if (opts.departmentId) {
      await prisma.user_departments.upsert({
        where: {
          user_id_department_id: {
            user_id: staffUser.id,
            department_id: opts.departmentId,
          },
        },
        update: {},
        create: { user_id: staffUser.id, department_id: opts.departmentId },
      });
    }

    return staffUser;
  }

  const hrHq = await upsertStaffUser({
    email: 'hr.hq@reg.rw',
    firstName: 'Beatrice',
    lastName: 'Uwimana',
    gender: person_gender.FEMALE,
    phoneIndex: 1,
    workingLocationId: hqId,
    departmentId: hqDept.id,
    status: users_status.ACTIVE,
    roleName: 'HR',
  });
  staffSummary.push({
    role: 'HR',
    branch: 'REG Headquarters',
    name: `${hrHq.first_name} ${hrHq.last_name}`,
    email: hrHq.email!,
    password: staffPassword,
    note: 'Final approver for every branch payroll batch',
  });

  const hrBranch1 = await upsertStaffUser({
    email: `hr.${branch1Code.toLowerCase()}@reg.rw`,
    firstName: 'Jean',
    lastName: 'Habimana',
    gender: person_gender.MALE,
    phoneIndex: 2,
    workingLocationId: branch1Data.id,
    departmentId: branch1AdminDeptId,
    status: users_status.ACTIVE,
    roleName: 'HR',
  });
  staffSummary.push({
    role: 'HR',
    branch: branch1Name,
    name: `${hrBranch1.first_name} ${hrBranch1.last_name}`,
    email: hrBranch1.email!,
    password: staffPassword,
    note: 'Branch-level HR only — no payroll final-approval authority',
  });

  const accountantHq = await upsertStaffUser({
    email: 'accountant.hq@reg.rw',
    firstName: 'Claudine',
    lastName: 'Mukamana',
    gender: person_gender.FEMALE,
    phoneIndex: 3,
    workingLocationId: hqId,
    departmentId: hqDept.id,
    status: users_status.ACTIVE,
    roleName: 'ACCOUNTANT',
  });
  staffSummary.push({
    role: 'ACCOUNTANT',
    branch: 'REG Headquarters',
    name: `${accountantHq.first_name} ${accountantHq.last_name}`,
    email: accountantHq.email!,
    password: staffPassword,
  });

  const attendantBranch1 = await upsertStaffUser({
    email: `attendant.${branch1Code.toLowerCase()}@reg.rw`,
    firstName: 'Eric',
    lastName: 'Nkurunziza',
    gender: person_gender.MALE,
    phoneIndex: 4,
    workingLocationId: branch1Data.id,
    departmentId: branch1AdminDeptId,
    status: users_status.ACTIVE,
    roleName: 'ATTENDANT',
  });
  staffSummary.push({
    role: 'ATTENDANT',
    branch: branch1Name,
    name: `${attendantBranch1.first_name} ${attendantBranch1.last_name}`,
    email: attendantBranch1.email!,
    password: staffPassword,
  });

  const pendingApplicant = await upsertStaffUser({
    email: 'pending.applicant@reg.rw',
    firstName: 'Grace',
    lastName: 'Mutoni',
    gender: person_gender.FEMALE,
    phoneIndex: 5,
    workingLocationId: branch1Data.id,
    departmentId: null,
    status: users_status.PENDING,
  });
  staffSummary.push({
    role: '(unassigned — PENDING)',
    branch: branch1Name,
    name: `${pendingApplicant.first_name} ${pendingApplicant.last_name}`,
    email: pendingApplicant.email!,
    password: staffPassword,
    note: 'Awaiting approval — use to test the approve/reject registration workflow',
  });

  const suspendedStaff = await upsertStaffUser({
    email: `suspended.${branch2Code.toLowerCase()}@reg.rw`,
    firstName: 'Patrick',
    lastName: 'Bizimana',
    gender: person_gender.MALE,
    phoneIndex: 6,
    workingLocationId: branch2Data.id,
    departmentId: branch2AdminDeptId,
    status: users_status.SUSPENDED,
    roleName: 'ATTENDANT',
  });
  staffSummary.push({
    role: 'ATTENDANT',
    branch: branch2Name,
    name: `${suspendedStaff.first_name} ${suspendedStaff.last_name}`,
    email: suspendedStaff.email!,
    password: staffPassword,
    note: 'SUSPENDED — has a pre-seeded refresh token; both /auth/refresh and any API call using its access token must be rejected',
  });

  // A real pre-seeded session for the suspended account, so the
  // suspend/token-rejection scenario is directly testable against
  // /auth/refresh without needing to log in first (which would fail anyway
  // since the account is suspended).
  const suspendedExistingSession = await prisma.user_sessions.findFirst({
    where: { user_id: suspendedStaff.id },
  });
  if (!suspendedExistingSession) {
    const suspendedSessionExpiry = new Date();
    suspendedSessionExpiry.setDate(suspendedSessionExpiry.getDate() + 30);
    await prisma.user_sessions.create({
      data: {
        uuid: generateUUID(),
        user_id: suspendedStaff.id,
        refresh_token_hash: generateRefreshTokenHash(suspendedStaff.id, branch2Name),
        device_info: 'Seed Session — Suspended Test Account',
        ip_address: '127.0.0.1',
        is_revoked: false,
        expires_at: suspendedSessionExpiry,
      },
    });
  }

  console.log(`    ${staffSummary.length} additional staff/test accounts created`);

  // ─────────────────────────────────────────────────────────────────
  // PHASE 4 — EMPLOYEES × 400
  // Spread evenly across all 10 working locations. Position and
  // employment-category are decorrelated (not a fixed i % 3 lockstep) so
  // every position ends up with employees under more than one
  // employment-category variant.

  console.log('\n');
  console.log(' PHASE 4 — Seeding 400 employees across a two-year hiring timeline...');

  const allLocations = [...locationRecords.entries()];
  const categoryNames = ['Monthly', 'Daily', 'Custom'] as const;
  const positionNames = ['Linesman', 'Driver', 'Electrician'];
  const TOTAL_EMPLOYEES = 400;
  const employeeSeedStartMonth = new Date(Date.UTC(
    today.getUTCFullYear() - 2,
    today.getUTCMonth(),
    1,
  ));
  const employeeHireDates = buildEmployeeHireDates(
    TOTAL_EMPLOYEES,
    employeeSeedStartMonth,
    today,
  );

  // Pre-collect all department IDs per location for fast lookup
  const locationDeptIds = new Map<bigint, bigint[]>();

  for (const [, locData] of allLocations) {
    const depts = await prisma.departments.findMany({
      where: { working_location_id: locData.id, status: 'ACTIVE' },
      select: { id: true },
    });
    locationDeptIds.set(locData.id, depts.map((d) => d.id));
  }

  // 200 female + 200 male employees (i alternates even/odd below) — build
  // that many guaranteed-unique name pairs per gender up front instead of
  // repeatedly wrapping around the ~42-44 first names mid-loop.
  const employeeMaleNamePairs = buildUniqueNamePairs(
    MALE_FIRST_NAMES,
    LAST_NAMES,
    Math.ceil(TOTAL_EMPLOYEES / 2),
  );
  const employeeFemaleNamePairs = buildUniqueNamePairs(
    FEMALE_FIRST_NAMES,
    LAST_NAMES,
    Math.floor(TOTAL_EMPLOYEES / 2),
  );

  const ALLOWANCE_POOL = [
    { title: 'Transport Allowance', min: 15000, max: 25000 },
    { title: 'Housing Allowance', min: 30000, max: 60000 },
    { title: 'Communication Allowance', min: 5000, max: 10000 },
  ];

  // In-memory records used by later phases (time_records / payment_batches)
  // so we don't have to re-query the DB for every employee.
  type EmployeeSeedRecord = {
    id: bigint;
    workingLocationId: bigint;
    departmentId: bigint | null;
    status: employees_status;
    hireDate: Date;
    contractEndDate: Date | null;
    categoryName: (typeof categoryNames)[number];
  };
  const employeeRecords: EmployeeSeedRecord[] = [];

  type PaymentStructureInfo = {
    id: bigint;
    frequency: payment_structures_payroll_frequency;
    basicSalary: number;
    dailyRate: number;
    overtimeRate: number;
    customWorkDays: number | null;
  };
  const paymentStructureByEmployee = new Map<string, PaymentStructureInfo>();
  const allowanceTotalByEmployee = new Map<string, number>();

  // Clear previously-seeded bulk rows so re-running the seed against the
  // same DB doesn't duplicate them (allowances/ikimina have no natural
  // per-row unique key to upsert against the way named rows do).
  await prisma.allowances.deleteMany({});

  for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
    const gender = i % 2 === 0 ? person_gender.FEMALE : person_gender.MALE;
    const genderIndex = Math.floor(i / 2);
    const [firstName, lastName] = gender === person_gender.FEMALE
      ? employeeFemaleNamePairs[genderIndex]
      : employeeMaleNamePairs[genderIndex];
    const avatar = gender === person_gender.FEMALE ? femaleAvatarUrl(i) : maleAvatarUrl(i);

    // spread employees across locations
    const locEntry = allLocations[i % allLocations.length];
    const locId    = locEntry[1].id;
    const deptIds  = locationDeptIds.get(locId) ?? [];
    const deptId   = deptIds.length > 0 ? deptIds[i % deptIds.length] : null;

    // Position and employment-category are decorrelated: positionIndex
    // cycles every employee, categoryIndex cycles every 3 employees, so
    // for a fixed position (i % 3 constant), successive employees under
    // that position walk through Monthly/Daily/Custom in turn instead of
    // always landing on the same one.
    const positionIndex = i % 3;
    const categoryIndex = Math.floor(i / 3) % 3;
    const positionName = positionNames[positionIndex];
    const categoryName = categoryNames[categoryIndex];
    const positionId = positionIdMap.get(positionName)!;

    const email = generateEmail(firstName, lastName, i);
    const phone = generatePhone(i);
    const nationalId = generateNationalId(i);
    const hireDate = employeeHireDates[i];
    const createdAt = new Date(hireDate);
    createdAt.setUTCHours(8 + (i % 9), (i * 7) % 60, 0, 0);
    const employeeStatus = employeeSeedStatus(i, hireDate, today);
    const pauseReason = employeeStatus === employees_status.PAUSED ? pauseReasonFor(i) : null;

    const isContractBased = categoryName === 'Daily' || categoryName === 'Custom';

    // Contract dates only apply to DAILY/CUSTOM employees — MONTHLY
    // employees are salaried and don't have a fixed contract end date.
    let contractStartDate: Date | null = null;
    let contractEndDate: Date | null = null;
    let contractLengthDays: number | null = null;

    if (isContractBased) {
      // Contract length varies between 8 and 27 days across employees
      // (8, 9, 10, ..., 27 — 20 distinct lengths, cycling by index).
      contractLengthDays = 8 + (i % 20);

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
        position_id:            positionId,
        employment_category_id: catIdMap.get(categoryName)!,
        status:                 employeeStatus,
        pause_reason:           pauseReason,
        avatar_url:             avatar,
        created_by:             superAdmin.id,
        created_at:             createdAt,
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
        position_id:            positionId,
        employment_category_id: catIdMap.get(categoryName)!,
        status:                 employeeStatus,
        pause_reason:           pauseReason,
        avatar_url:             avatar,
        created_by:             superAdmin.id,
        created_at:             createdAt,
        updated_at:             new Date(),
      },
    });

    employeeRecords.push({
      id: employee.id,
      workingLocationId: locId,
      departmentId: deptId,
      status: employeeStatus,
      hireDate,
      contractEndDate,
      categoryName,
    });

    // ── Payment Structure for this employee ───────────────────────
    // Each employee gets exactly one active payment structure. Basic
    // salary/daily rate are taken directly from the position×category
    // variant defaults set on the Positions page - an employee's pay is
    // whatever their assigned position offers for their employment
    // category, not an individually-randomized number. (Previously this
    // applied a +/-10% "variance factor" per employee so reports wouldn't
    // show identical pay within a bucket - removed: identical pay within
    // the same position+category is the correct, expected behavior.)
    const freq =
      categoryName === 'Monthly'
        ? payment_structures_payroll_frequency.MONTHLY
        : categoryName === 'Daily'
          ? payment_structures_payroll_frequency.DAILY
          : payment_structures_payroll_frequency.CUSTOM;

    const variantDefaults = positionCategoryDefaults.get(positionName)!.get(categoryName)!;

    const basicSalary =
      freq === payment_structures_payroll_frequency.MONTHLY
        ? (variantDefaults.default_basic_salary ?? 150000)
        : 0;

    // FIX: MONTHLY daily_rate used to be hardcoded to a flat 5000 regardless
    // of basic_salary, which made absence-deduction math nonsensical. It's
    // now basic_salary / DEFAULT_MONTHLY_WORK_DAYS, matching
    // calculateMonthlyDailyRate() in payroll-calc.util.ts.
    const dailyRate =
      freq === payment_structures_payroll_frequency.MONTHLY
        ? Math.round(basicSalary / DEFAULT_MONTHLY_WORK_DAYS)
        : (variantDefaults.default_daily_rate ?? 3000);

    const overtimeRate = variantDefaults.default_overtime_rate ?? 2000;
    const customWorkDays =
      freq === payment_structures_payroll_frequency.CUSTOM
        ? variantDefaults.default_custom_work_days ?? 20
        : null;

    // tax_percentage is written for schema completeness only — real payroll
    // calc (payroll.service.ts) reads monthly_taxes for MONTHLY and uses 0
    // for DAILY/CUSTOM instead of this column.
    const taxPct = categoryName === 'Daily' ? 0 : 15;
    const effectiveFrom = new Date(hireDate);

    let paymentStructureId: bigint;
    const existingPS = await prisma.payment_structures.findFirst({
      where: { employee_id: employee.id },
    });

    if (existingPS) {
      // Re-running the seed against an already-seeded DB must still sync
      // pay to the position's current defaults - otherwise a fix here
      // (e.g. removing the old per-employee variance) would silently keep
      // every previously-seeded employee on their stale, varied numbers.
      await prisma.payment_structures.update({
        where: { id: existingPS.id },
        data: {
          payroll_frequency: freq,
          basic_salary:      basicSalary,
          daily_rate:        dailyRate,
          overtime_rate:     overtimeRate,
          custom_work_days:  customWorkDays,
          tax_percentage:    taxPct,
          updated_at:        new Date(),
        },
      });
      paymentStructureId = existingPS.id;
    } else {
      const createdPS = await prisma.payment_structures.create({
        data: {
          uuid:        generateUUID(),
          employee_id:       employee.id,
          payroll_frequency: freq,
          basic_salary:      basicSalary,
          daily_rate:        dailyRate,
          overtime_rate:     overtimeRate,
          custom_work_days:  customWorkDays,
          tax_percentage:    taxPct,
          effective_from:    effectiveFrom,
          effective_to:      null,                 // currently active
          updated_at:        new Date(),
        },
      });
      paymentStructureId = createdPS.id;
    }

    paymentStructureByEmployee.set(employee.id.toString(), {
      id: paymentStructureId,
      frequency: freq,
      basicSalary,
      dailyRate,
      overtimeRate,
      customWorkDays,
    });

    // ── Allowances ──────────────────────────────────────────────
    // All MONTHLY employees, plus CUSTOM employees on a contract longer
    // than 21 days, get 1-2 realistic allowances.
    const qualifiesForAllowances =
      categoryName === 'Monthly' ||
      (categoryName === 'Custom' && (contractLengthDays ?? 0) > 21);

    if (qualifiesForAllowances) {
      const allowanceCount = i % 2 === 0 ? 2 : 1;
      const startOffset = i % ALLOWANCE_POOL.length;
      let allowanceTotal = 0;

      for (let a = 0; a < allowanceCount; a++) {
        const pool = ALLOWANCE_POOL[(startOffset + a) % ALLOWANCE_POOL.length];
        const amount = randInt(i * 31 + a * 17 + 3, pool.min, pool.max);
        allowanceTotal += amount;

        await prisma.allowances.create({
          data: {
            uuid: generateUUID(),
            employee_id: employee.id,
            allowance_type_id: allowanceTypeIdMap.get(pool.title),
            title: pool.title,
            amount,
            description: `${pool.title} — standard rate.`,
            is_active: true,
            updated_at: new Date(),
          },
        });
      }

      allowanceTotalByEmployee.set(employee.id.toString(), allowanceTotal);
    }

    // ── Ikimina savings membership ─────────────────────────────
    // ~50% of ACTIVE employees get enrolled, matching their own branch and
    // department so the Ikimina Savings page has real data across branches.
    if (employeeStatus === employees_status.ACTIVE && randInt(i * 11 + 5, 0, 99) < 50) {
      const monthlyAmount = randInt(i * 19 + 9, 5000, 20000);
      await prisma.ikimina_memberships.upsert({
        where: { employee_id: employee.id },
        update: {
          monthly_amount: monthlyAmount,
          is_active: true,
          working_location_id: locId,
          department_id: deptId,
          updated_at: new Date(),
        },
        create: {
          uuid: generateUUID(),
          employee_id: employee.id,
          monthly_amount: monthlyAmount,
          is_active: true,
          joined_at: hireDate,
          created_by: superAdmin.id,
          working_location_id: locId,
          department_id: deptId,
          updated_at: new Date(),
        },
      });
    }

    if ((i + 1) % 50 === 0) {
      console.log(` ${i + 1}/${TOTAL_EMPLOYEES} employees seeded...`)
    }
  }

  console.log(`   All ${TOTAL_EMPLOYEES} employees, payment structures, allowances & ikimina memberships seeded`);

  // ── Infrastructure Levy deduction assignment ─────────────────────
  const monthlyEmployeesForTax = await prisma.employees.findMany({
    where: {
      employment_categories: { name: 'Monthly' },
      working_location_id: { in: [hqId, branch1Data.id] },
      status: employees_status.ACTIVE,
    },
    select: { id: true },
    take: 6,
  });

  for (const emp of monthlyEmployeesForTax) {
    const existingAssignment = await prisma.employee_deductions.findFirst({
      where: { employee_id: emp.id, deduction_type_id: infrastructureLevy.id },
    });
    if (!existingAssignment) {
      await prisma.employee_deductions.create({
        data: {
          uuid: generateUUID(),
          employee_id: emp.id,
          deduction_type_id: infrastructureLevy.id,
          start_date: monthStart,
          is_active: true,
        },
      });
    }
  }
  console.log(`    Infrastructure Levy assigned to ${monthlyEmployeesForTax.length} monthly employees`);

  // ─────────────────────────────────────────────────────────────────
  // PHASE 5 — ATTENDANCE (time_records)
  // ─────────────────────────────────────────────────────────────────
  // Roughly the last 2.5 months of weekday attendance for every
  // ACTIVE/PAUSED employee — PRESENT on most working weekdays, ~7%
  // deterministic ABSENT rate, batched createMany (skipDuplicates) so a
  // few hundred employees × ~55 weekdays doesn't run as one row per query.
  console.log('\n');
  console.log(' PHASE 5 — Seeding attendance (time_records)...');

  await prisma.time_records.deleteMany({});

  const ATTENDANCE_LOOKBACK_DAYS = 75; // ~2.5 months of calendar days
  const attendanceRangeStart = new Date(today);
  attendanceRangeStart.setUTCDate(attendanceRangeStart.getUTCDate() - ATTENDANCE_LOOKBACK_DAYS);

  const attendanceEligible = employeeRecords.filter(
    (e) => e.status === employees_status.ACTIVE || e.status === employees_status.PAUSED,
  );

  let timeRecordRows: Array<{
    uuid: string;
    employee_id: bigint;
    attendance_date: Date;
    overtime_hours: number;
    attendance_status: time_records_attendance_status;
    working_location_id: bigint;
    department_id: bigint | null;
    updated_at: Date;
  }> = [];

  let totalTimeRecordsPlanned = 0;

  for (let empIdx = 0; empIdx < attendanceEligible.length; empIdx++) {
    const emp = attendanceEligible[empIdx];
    const rangeStart = emp.hireDate > attendanceRangeStart ? startOfUtcDay(emp.hireDate) : attendanceRangeStart;
    const rangeEnd =
      emp.contractEndDate && emp.contractEndDate < today ? startOfUtcDay(emp.contractEndDate) : today;

    if (rangeStart > rangeEnd) continue;

    const cursor = new Date(rangeStart);
    let dayIdx = 0;
    while (cursor <= rangeEnd) {
      const dayOfWeek = cursor.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const isAbsent = randInt(empIdx * 977 + dayIdx * 131 + 3, 0, 99) < 7;
        const hasOvertime = !isAbsent && randInt(empIdx * 421 + dayIdx * 67 + 11, 0, 99) < 10;
        const overtimeHours = hasOvertime ? randInt(empIdx * 613 + dayIdx * 89 + 17, 1, 4) : 0;

        timeRecordRows.push({
          uuid: generateUUID(),
          employee_id: emp.id,
          attendance_date: new Date(cursor),
          overtime_hours: overtimeHours,
          attendance_status: isAbsent
            ? time_records_attendance_status.ABSENT
            : time_records_attendance_status.PRESENT,
          working_location_id: emp.workingLocationId,
          department_id: emp.departmentId,
          updated_at: new Date(),
        });
        totalTimeRecordsPlanned++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      dayIdx++;
    }

    // Flush in chunks so memory/query size stays bounded even across 400
    // employees × ~55 weekdays each.
    if (timeRecordRows.length >= 1500) {
      const chunks = chunkArray(timeRecordRows, 1500);
      for (const chunk of chunks) {
        await prisma.time_records.createMany({ data: chunk, skipDuplicates: true });
      }
      timeRecordRows = [];
    }
  }

  if (timeRecordRows.length > 0) {
    for (const chunk of chunkArray(timeRecordRows, 1500)) {
      await prisma.time_records.createMany({ data: chunk, skipDuplicates: true });
    }
  }

  console.log(`    ~${totalTimeRecordsPlanned} attendance records seeded for ${attendanceEligible.length} employees`);

  // ─────────────────────────────────────────────────────────────────
  // PHASE 6 — PAYROLL BATCHES, TRANSACTIONS, PAYMENT_BATCH_ITEMS
  // ─────────────────────────────────────────────────────────────────
  // 3 batches per working location covering the current + previous 2
  // months, in a deliberate mix of statuses: last month → APPROVED with
  // PAID transactions, two months ago → REJECTED with a rejected_reason,
  // current month → PENDING or IN_REVIEW (awaiting review). Batch totals
  // are summed from the transactions actually created, not left at 0.
  console.log('\n');
  console.log(' PHASE 6 — Seeding payroll batches, transactions & batch items...');

  await prisma.payment_batch_items.deleteMany({});
  await prisma.ikimina_contributions.deleteMany({});
  await prisma.transactions.deleteMany({});
  await prisma.payment_batches.deleteMany({});

  function periodFor(monthsAgo: number): { month: number; year: number; start: Date; end: Date } {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // 1-12
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0)); // last calendar day of month
    return { month, year, start, end };
  }

  const categoryTaxBehaviorByName: Record<string, 'STANDARD' | 'EXEMPT' | 'PERIODIC'> = {
    Monthly: 'STANDARD',
    Daily: 'EXEMPT',
    Custom: 'PERIODIC',
  };

  function buildTransactionFigures(params: {
    ps: PaymentStructureInfo;
    categoryName: string;
    allowanceAmount: number;
    seed: number;
  }) {
    const expectedWorkDays =
      params.ps.frequency === payment_structures_payroll_frequency.MONTHLY
        ? DEFAULT_MONTHLY_WORK_DAYS
        : params.ps.customWorkDays ?? 20;

    const absenceDays = randInt(params.seed, 0, 3);
    const attendanceDays = Math.max(expectedWorkDays - absenceDays, Math.round(expectedWorkDays * 0.85));
    const overtimeDaysCount = randInt(params.seed + 1, 0, 2);
    const overtimeAmount = overtimeDaysCount * params.ps.overtimeRate;

    const baseAmount =
      params.ps.frequency === payment_structures_payroll_frequency.MONTHLY
        ? Math.round((params.ps.basicSalary / expectedWorkDays) * attendanceDays)
        : Math.round(params.ps.dailyRate * attendanceDays);

    const grossAmount = baseAmount + params.allowanceAmount + overtimeAmount;

    const taxBehavior = categoryTaxBehaviorByName[params.categoryName] ?? 'STANDARD';
    let taxAmount = 0;
    if (taxBehavior === 'STANDARD') {
      taxAmount = calculateRwandaPaye(grossAmount);
    } else if (taxBehavior === 'PERIODIC' && attendanceDays > 21) {
      taxAmount = Math.round(grossAmount * 0.1);
    }

    const totalDeductions = taxAmount;
    const netAmount = Math.max(0, grossAmount - totalDeductions);

    return { expectedWorkDays, attendanceDays, baseAmount, overtimeAmount, grossAmount, taxAmount, totalDeductions, netAmount };
  }

  const PAYMENT_METHODS = [
    transactions_payment_method.BANK,
    transactions_payment_method.MOMO,
    transactions_payment_method.CASH,
  ];

  let seededBatchCount = 0;
  let seededTransactionCount = 0;

  for (let locIdx = 0; locIdx < allLocations.length; locIdx++) {
    const [locName, locData] = allLocations[locIdx];
    const locCode = locationCode(locName);
    const submittedById = locData.isHQ ? accountantHq.id : branchManagerUserByLocation.get(locData.id) ?? superAdmin.id;

    const employeesAtLocation = employeeRecords.filter(
      (e) => e.workingLocationId === locData.id && e.status === employees_status.ACTIVE,
    );
    const batchEmployees = employeesAtLocation.slice(0, Math.min(employeesAtLocation.length, 18));

    if (batchEmployees.length === 0) continue;

    // 3 recent periods per location: [current(0), last month(1), 2 months ago(2)]
    const periodPlans: Array<{ monthsAgo: number; status: payment_batches_status }> = [
      { monthsAgo: 0, status: locIdx % 2 === 0 ? payment_batches_status.PENDING : payment_batches_status.IN_REVIEW },
      { monthsAgo: 1, status: payment_batches_status.APPROVED },
      { monthsAgo: 2, status: payment_batches_status.REJECTED },
    ];

    for (const plan of periodPlans) {
      const { month, year, start, end } = periodFor(plan.monthsAgo);
      const eligibleForPeriod = batchEmployees.filter((e) => e.hireDate <= end);
      if (eligibleForPeriod.length === 0) continue;

      const batchCode = `PAY-${year}-${String(month).padStart(2, '0')}-${locCode}`;
      const paymentDate = new Date(end);
      paymentDate.setUTCDate(paymentDate.getUTCDate() + 5);
      const submittedAt = new Date(end);
      submittedAt.setUTCDate(submittedAt.getUTCDate() + 1);

      const isApproved = plan.status === payment_batches_status.APPROVED;
      const isRejected = plan.status === payment_batches_status.REJECTED;

      const batch = await prisma.payment_batches.create({
        data: {
          uuid: generateUUID(),
          batch_code: batchCode,
          working_location_id: locData.id,
          payroll_month: month,
          payroll_year: year,
          status: plan.status,
          description: `Payroll for ${locName} — ${month}/${year}`,
          attachments: [],
          rejected_reason: isRejected
            ? 'Attendance discrepancies found for several employees; batch returned for correction and resubmission.'
            : null,
          submitted_by: submittedById,
          approved_by: isApproved ? hrHq.id : null,
          submitted_at: submittedAt,
          approved_at: isApproved ? new Date(paymentDate) : null,
          updated_at: new Date(),
        },
      });
      seededBatchCount++;

      let batchTotalAmount = 0;
      let batchTotalGross = 0;
      let batchTotalAllowances = 0;
      let batchTotalDeductions = 0;
      let batchTotalTax = 0;

      const itemStatus: payment_batch_items_status =
        plan.status === payment_batches_status.PENDING
          ? payment_batch_items_status.PENDING
          : plan.status === payment_batches_status.IN_REVIEW
            ? payment_batch_items_status.IN_REVIEW
            : plan.status === payment_batches_status.APPROVED
              ? payment_batch_items_status.APPROVED
              : payment_batch_items_status.REJECTED;

      const transactionStatus: transactions_transaction_status = isApproved
        ? transactions_transaction_status.PAID
        : isRejected
          ? transactions_transaction_status.REJECTED
          : transactions_transaction_status.PENDING;

      for (let empIdx = 0; empIdx < eligibleForPeriod.length; empIdx++) {
        const emp = eligibleForPeriod[empIdx];
        const ps = paymentStructureByEmployee.get(emp.id.toString());
        if (!ps) continue;

        const allowanceAmount = allowanceTotalByEmployee.get(emp.id.toString()) ?? 0;
        const figures = buildTransactionFigures({
          ps,
          categoryName: emp.categoryName,
          allowanceAmount,
          seed: locIdx * 10007 + plan.monthsAgo * 733 + empIdx * 97 + 41,
        });

        const paymentMethod = PAYMENT_METHODS[(locIdx + empIdx) % PAYMENT_METHODS.length];

        const transaction = await prisma.transactions.create({
          data: {
            uuid: generateUUID(),
            employee_id: emp.id,
            payment_structure_id: ps.id,
            payroll_month: month,
            payroll_year: year,
            gross_amount: figures.grossAmount,
            base_amount: figures.baseAmount,
            allowance_amount: allowanceAmount,
            tax_amount: figures.taxAmount,
            attendance_days: figures.attendanceDays,
            payroll_work_days: figures.expectedWorkDays,
            payroll_start_date: start,
            payroll_end_date: end,
            total_deductions: figures.totalDeductions,
            net_amount: figures.netAmount,
            payment_date: paymentDate,
            payment_method: paymentMethod,
            transaction_status: transactionStatus,
            approved_by: isApproved ? hrHq.id : null,
            working_location_id: locData.id,
            department_id: emp.departmentId,
            updated_at: new Date(),
          },
        });
        seededTransactionCount++;

        await prisma.payment_batch_items.create({
          data: {
            uuid: generateUUID(),
            payment_batch_id: batch.id,
            employee_id: emp.id,
            transaction_id: transaction.id,
            status: itemStatus,
            rejection_reason: isRejected ? 'Attendance discrepancy pending correction.' : null,
            approved_by: isApproved ? hrHq.id : null,
            approved_at: isApproved ? new Date(paymentDate) : null,
          },
        });

        batchTotalAmount += figures.netAmount;
        batchTotalGross += figures.grossAmount;
        batchTotalAllowances += allowanceAmount;
        batchTotalDeductions += figures.totalDeductions;
        batchTotalTax += figures.taxAmount;
      }

      await prisma.payment_batches.update({
        where: { id: batch.id },
        data: {
          total_employees: eligibleForPeriod.length,
          total_amount: batchTotalAmount,
          total_gross: batchTotalGross,
          total_allowances: batchTotalAllowances,
          total_deductions: batchTotalDeductions,
          total_tax: batchTotalTax,
          updated_at: new Date(),
        },
      });
    }
  }

  console.log(`    ${seededBatchCount} payroll batches and ${seededTransactionCount} transactions seeded`);

  // ─────────────────────────────────────────────────────────────────
  // PHASE 7 — SYSTEM NOTIFICATIONS + PERMISSION OVERRIDES
  // ─────────────────────────────────────────────────────────────────

  console.log('\n');
  console.log(' PHASE 7 — System notifications & permission overrides');

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

  // Per-user permission overrides — proves the override system actually
  // works: revoke something HR's role would normally grant, and grant the
  // accountant a permission their role normally doesn't have.
  await prisma.user_permission_overrides.upsert({
    where: {
      user_id_permission_key: {
        user_id: hrBranch1.id,
        permission_key: 'employees.suspend',
      },
    },
    update: {
      is_allowed: false,
      reason: 'Seed demo: role grants this, override revokes it for this specific user.',
    },
    create: {
      uuid: generateUUID(),
      user_id: hrBranch1.id,
      permission_key: 'employees.suspend',
      is_allowed: false,
      changed_by: superAdmin.id,
      reason: 'Seed demo: role grants this, override revokes it for this specific user.',
      updated_at: new Date(),
    },
  });

  await prisma.user_permissions.upsert({
    where: {
      user_id_permission_key: {
        user_id: accountantHq.id,
        permission_key: 'employees.read_all',
      },
    },
    update: {},
    create: {
      user_id: accountantHq.id,
      permission_key: 'employees.read_all',
      granted_by: superAdmin.id,
    },
  });

  console.log('    Permission overrides seeded (1 revoke override, 1 direct grant)');

  // ═══════════════════════════════════════════════════════════════════
  // TERMINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  const [
    workingLocationCount,
    departmentCount,
    roleCount,
    userCount,
    employeeCount,
    positionCount,
    positionEmploymentCategoryCount,
    allowanceCount,
    employeeDeductionCount,
    ikiminaMembershipCount,
    timeRecordCount,
    paymentBatchCount,
    transactionCount,
  ] = await Promise.all([
    prisma.working_locations.count(),
    prisma.departments.count(),
    prisma.roles.count(),
    prisma.users.count(),
    prisma.employees.count(),
    prisma.positions.count(),
    prisma.position_employment_categories.count(),
    prisma.allowances.count(),
    prisma.employee_deductions.count(),
    prisma.ikimina_memberships.count(),
    prisma.time_records.count(),
    prisma.payment_batches.count(),
    prisma.transactions.count(),
  ]);

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
  console.log(' ADDITIONAL STAFF & TEST ACCOUNTS  (password for all: Staff@RegPay2024!)');
  console.log('─────────────────────────────────────────────────────────────────');
  for (const staff of staffSummary) {
    console.log(`   Role     : ${staff.role}`);
    console.log(`   Branch   : ${staff.branch}`);
    console.log(`   Name     : ${staff.name}`);
    console.log(`   Email    : ${staff.email}`);
    if (staff.note) console.log(`   Note     : ${staff.note}`);
    console.log('   ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·');
  }

  console.log('');
  console.log(' TEST SCENARIOS READY TO EXERCISE');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('   - Registration approval: pending.applicant@reg.rw is PENDING.');
  console.log('   - Suspension / token rejection: suspended.* is SUSPENDED — its');
  console.log('     pre-seeded session should be rejected on the very next request.');
  console.log('   - Reactivation: several employees are seeded directly as PAUSED');
  console.log('     with a pause_reason — use them to test the Reactivate action.');
  console.log('   - Permission overrides: hrBranch1 has employees.suspend revoked;');
  console.log('     accountant.hq@reg.rw has employees.read_all granted directly.');
  console.log('   - Payroll batches exist in PENDING/IN_REVIEW, APPROVED (paid), and');
  console.log('     REJECTED states across every branch — ready for the Payroll');
  console.log('     Engine and Ikimina Savings pages to demo immediately.');
  console.log('');
  console.log(' STATISTICS');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(`   Working locations         : ${workingLocationCount}`);
  console.log(`   Departments                : ${departmentCount}`);
  console.log(`   Roles                      : ${roleCount}`);
  console.log(`   Permissions (code registry): ${ALL_PERMISSION_KEYS.length}`);
  console.log(`   Users                      : ${userCount}`);
  console.log(`   Branch managers            : ${branchManagerSummary.length}`);
  console.log(`   Additional staff           : ${staffSummary.length}`);
  console.log(`   Employees                  : ${employeeCount}`);
  console.log(`   Positions                  : ${positionCount}`);
  console.log(`   Position × category rows   : ${positionEmploymentCategoryCount}`);
  console.log(`   Allowances                 : ${allowanceCount}`);
  console.log(`   Employee deductions        : ${employeeDeductionCount}`);
  console.log(`   Ikimina memberships        : ${ikiminaMembershipCount}`);
  console.log(`   Attendance (time_records)  : ${timeRecordCount}`);
  console.log(`   Payroll batches            : ${paymentBatchCount}`);
  console.log(`   Transactions               : ${transactionCount}`);
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
