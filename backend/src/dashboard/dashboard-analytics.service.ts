import { BadRequestException, Injectable } from '@nestjs/common';
import { employees_status, payment_batches_status } from '@prisma/client';

import type { CurrentUserType } from '../auth/types/current-user.type';
import { hasEffectivePermission } from '../common/utils/effective-permissions.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmployeeAnalyticsQueryDto,
  PayrollAnalyticsQueryDto,
} from './dto/dashboard-analytics-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

type Interval = 'day' | 'week' | 'month' | 'year';

type AnalyticsScope = {
  canViewAll: boolean;
  workingLocationId?: bigint;
  response: {
    mode: 'GLOBAL' | 'WORKING_LOCATION';
    can_select_working_location: boolean;
    requested_working_location_id: string | null;
    applied_working_location_id: string | null;
    was_overridden: boolean;
    label: string;
  };
};

type DateBucket = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

@Injectable()
export class DashboardAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async employeeAnalytics(
    actor: CurrentUserType,
    query: EmployeeAnalyticsQueryDto,
  ) {
    const range = this.resolveRange(query.from, query.to);
    const scope = await this.resolveScope(
      actor,
      query.working_location_id,
      this.canViewAllEmployeeAnalytics(actor),
    );

    const employeeWhere: Record<string, any> = { deleted_at: null };

    if (scope.workingLocationId !== undefined) {
      employeeWhere.working_location_id = scope.workingLocationId;
    }
    if (query.department_id) {
      employeeWhere.department_id = this.parseId(
        query.department_id,
        'department_id',
      );
    }
    if (query.position_id) {
      employeeWhere.position_id = this.parseId(
        query.position_id,
        'position_id',
      );
    }
    if (query.employment_category_id) {
      employeeWhere.positions = {
        employment_category_id: this.parseId(
          query.employment_category_id,
          'employment_category_id',
        ),
      };
    }
    if (query.status) {
      employeeWhere.status = query.status;
    }

    const [employees, filters] = await Promise.all([
      this.prisma.employees.findMany({
        where: employeeWhere,
        select: {
          id: true,
          created_at: true,
          hire_date: true,
          status: true,
        },
        orderBy: { created_at: 'asc' },
      }),
      this.employeeFilters(scope),
    ]);

    const buckets = this.buildBuckets(range.from, range.to, range.interval);
    const trend = buckets.map((bucket) => {
      const added = employees.filter((employee) =>
        this.isWithin(
          this.employeeTrendDate(employee),
          bucket.start,
          bucket.end,
        ),
      );
      const headcount = employees.filter(
        (employee) => this.employeeTrendDate(employee) <= bucket.end,
      );

      return {
        period: bucket.key,
        label: bucket.label,
        total: headcount.length,
        active: headcount.filter(
          (employee) => employee.status === employees_status.ACTIVE,
        ).length,
        added: added.length,
      };
    });

    const employeesAtRangeEnd = employees.filter(
      (employee) => this.employeeTrendDate(employee) <= range.to,
    );

    return {
      scope: scope.response,
      applied_filters: {
        from: this.toDateInputValue(range.from),
        to: this.toDateInputValue(range.to),
        interval: range.interval,
        working_location_id: scope.response.applied_working_location_id,
        department_id: query.department_id ?? null,
        position_id: query.position_id ?? null,
        employment_category_id: query.employment_category_id ?? null,
        status: query.status ?? null,
      },
      summary: {
        total_employees: employeesAtRangeEnd.length,
        active_employees: employeesAtRangeEnd.filter(
          (employee) => employee.status === employees_status.ACTIVE,
        ).length,
        new_employees: employees.filter((employee) =>
          this.isWithin(this.employeeTrendDate(employee), range.from, range.to),
        ).length,
      },
      headcount_trend: trend,
      filters,
    };
  }

  async payrollAnalytics(
    actor: CurrentUserType,
    query: PayrollAnalyticsQueryDto,
  ) {
    const range = this.resolveRange(query.from, query.to);
    const scope = await this.resolveScope(
      actor,
      query.working_location_id,
      this.canViewAllPayrollAnalytics(actor),
    );

    const payrollWhere: Record<string, any> = {};
    if (scope.workingLocationId !== undefined) {
      payrollWhere.working_location_id = scope.workingLocationId;
    }
    if (query.status) {
      payrollWhere.status = query.status;
    }

    const departmentId = this.parseOptionalId(
      query.department_id,
      'department_id',
    );
    const positionId = this.parseOptionalId(query.position_id, 'position_id');
    if (departmentId !== undefined || positionId !== undefined) {
      payrollWhere.payment_batch_items = {
        some: {
          employees: {
            ...(departmentId !== undefined
              ? { department_id: departmentId }
              : {}),
            ...(positionId !== undefined ? { position_id: positionId } : {}),
          },
        },
      };
    }

    const fromPeriod = this.periodIndex(
      range.from.getFullYear(),
      range.from.getMonth() + 1,
    );
    const toPeriod = this.periodIndex(
      range.to.getFullYear(),
      range.to.getMonth() + 1,
    );

    payrollWhere.payroll_year = {
      gte: range.from.getFullYear(),
      lte: range.to.getFullYear(),
    };

    const [rawBatches, filters] = await Promise.all([
      this.prisma.payment_batches.findMany({
        where: payrollWhere,
        select: {
          id: true,
          payroll_month: true,
          payroll_year: true,
          total_employees: true,
          total_amount: true,
          total_gross: true,
          total_allowances: true,
          total_deductions: true,
          total_tax: true,
          status: true,
        },
        orderBy: [{ payroll_year: 'asc' }, { payroll_month: 'asc' }],
      }),
      this.payrollFilters(scope),
    ]);

    const batches = rawBatches.filter((batch) => {
      const index = this.periodIndex(batch.payroll_year, batch.payroll_month);
      return index >= fromPeriod && index <= toPeriod;
    });

    const interval: Interval =
      this.daysBetween(range.from, range.to) > 1095 ? 'year' : 'month';
    const buckets = this.buildBuckets(
      this.startOfMonth(range.from),
      this.endOfMonth(range.to),
      interval,
    );

    const trend = buckets.map((bucket) => {
      const bucketBatches = batches.filter((batch) =>
        this.isWithin(this.batchPeriodDate(batch), bucket.start, bucket.end),
      );

      return {
        period: bucket.key,
        label: bucket.label,
        batch_count: bucketBatches.length,
        employee_count: bucketBatches.reduce(
          (sum, batch) => sum + Number(batch.total_employees ?? 0),
          0,
        ),
        gross: this.sumMoney(bucketBatches, 'total_gross'),
        net: this.sumMoney(bucketBatches, 'total_amount'),
        tax: this.sumMoney(bucketBatches, 'total_tax'),
        deductions: this.sumMoney(bucketBatches, 'total_deductions'),
        allowances: this.sumMoney(bucketBatches, 'total_allowances'),
      };
    });

    const statusMap = new Map<
      payment_batches_status,
      { count: number; gross: number; net: number }
    >();
    for (const batch of batches) {
      const current = statusMap.get(batch.status) ?? {
        count: 0,
        gross: 0,
        net: 0,
      };
      current.count += 1;
      current.gross += Number(batch.total_gross ?? 0);
      current.net += Number(batch.total_amount ?? 0);
      statusMap.set(batch.status, current);
    }

    const statusDistribution = Array.from(statusMap.entries())
      .map(([status, totals]) => ({
        status,
        label: this.labelize(status),
        count: totals.count,
        gross: totals.gross,
        net: totals.net,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    return {
      scope: scope.response,
      applied_filters: {
        from: this.toDateInputValue(range.from),
        to: this.toDateInputValue(range.to),
        interval,
        working_location_id: scope.response.applied_working_location_id,
        department_id: query.department_id ?? null,
        position_id: query.position_id ?? null,
        status: query.status ?? null,
      },
      summary: {
        batch_count: batches.length,
        total_gross: this.sumMoney(batches, 'total_gross'),
        total_net: this.sumMoney(batches, 'total_amount'),
        total_tax: this.sumMoney(batches, 'total_tax'),
        pending_batches: batches.filter((batch) =>
          (
            [
              payment_batches_status.PENDING,
              payment_batches_status.IN_REVIEW,
              payment_batches_status.MANAGER_APPROVED,
            ] as payment_batches_status[]
          ).includes(batch.status),
        ).length,
      },
      batch_trend: trend,
      status_distribution: statusDistribution,
      filters,
    };
  }

  private canViewAllEmployeeAnalytics(actor: CurrentUserType) {
    return (
      actor.roles.includes('SUPER_ADMIN') ||
      hasEffectivePermission(actor, 'employees.read_all')
    );
  }

  private canViewAllPayrollAnalytics(actor: CurrentUserType) {
    return (
      actor.roles.includes('SUPER_ADMIN') ||
      hasEffectivePermission(actor, 'payroll.read_all')
    );
  }

  private async resolveScope(
    actor: CurrentUserType,
    requestedWorkingLocationId: string | undefined,
    canViewAll: boolean,
  ): Promise<AnalyticsScope> {
    let workingLocationId: bigint | undefined;
    let wasOverridden = false;

    if (canViewAll) {
      workingLocationId = this.parseOptionalId(
        requestedWorkingLocationId,
        'working_location_id',
      );
    } else if (actor.working_location_id) {
      workingLocationId = BigInt(actor.working_location_id);
      wasOverridden =
        !!requestedWorkingLocationId &&
        requestedWorkingLocationId !== 'all' &&
        requestedWorkingLocationId !== actor.working_location_id;
    } else {
      workingLocationId = BigInt(0);
      wasOverridden = !!requestedWorkingLocationId;
    }

    const location =
      workingLocationId !== undefined && workingLocationId !== BigInt(0)
        ? await this.prisma.working_locations.findFirst({
            where: { id: workingLocationId, deleted_at: null },
            select: { id: true, name: true },
          })
        : null;

    const appliedWorkingLocationId =
      workingLocationId !== undefined && workingLocationId !== BigInt(0)
        ? workingLocationId.toString()
        : null;

    return {
      canViewAll,
      workingLocationId,
      response: {
        mode:
          canViewAll && !appliedWorkingLocationId
            ? 'GLOBAL'
            : 'WORKING_LOCATION',
        can_select_working_location: canViewAll,
        requested_working_location_id:
          requestedWorkingLocationId && requestedWorkingLocationId !== 'all'
            ? requestedWorkingLocationId
            : null,
        applied_working_location_id: appliedWorkingLocationId,
        was_overridden: wasOverridden,
        label:
          canViewAll && !appliedWorkingLocationId
            ? 'All working locations'
            : (location?.name ?? 'Assigned working location'),
      },
    };
  }

  private async employeeFilters(scope: AnalyticsScope) {
    const departmentWhere: Record<string, any> = { status: 'ACTIVE' };
    if (scope.workingLocationId !== undefined) {
      departmentWhere.working_location_id = scope.workingLocationId;
    }

    const [locations, departments, positions, categories] = await Promise.all([
      this.prisma.working_locations.findMany({
        where: this.locationOptionsWhere(scope),
        select: { id: true, name: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.departments.findMany({
        where: departmentWhere,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.positions.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.employment_categories.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      working_locations: locations.map((location) => this.option(location)),
      departments: departments.map((department) => this.option(department)),
      positions: positions.map((position) => this.option(position)),
      employment_categories: categories.map((category) =>
        this.option(category),
      ),
      statuses: Object.values(employees_status).map((status) => ({
        value: status,
        label: this.labelize(status),
      })),
    };
  }

  private async payrollFilters(scope: AnalyticsScope) {
    const departmentWhere: Record<string, any> = { status: 'ACTIVE' };
    if (scope.workingLocationId !== undefined) {
      departmentWhere.working_location_id = scope.workingLocationId;
    }

    const [locations, departments, positions] = await Promise.all([
      this.prisma.working_locations.findMany({
        where: this.locationOptionsWhere(scope),
        select: { id: true, name: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.departments.findMany({
        where: departmentWhere,
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.positions.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      working_locations: locations.map((location) => this.option(location)),
      departments: departments.map((department) => this.option(department)),
      positions: positions.map((position) => this.option(position)),
      statuses: Object.values(payment_batches_status).map((status) => ({
        value: status,
        label: this.labelize(status),
      })),
    };
  }

  private locationOptionsWhere(scope: AnalyticsScope) {
    return {
      deleted_at: null,
      ...(!scope.canViewAll && scope.workingLocationId !== undefined
        ? { id: scope.workingLocationId }
        : {}),
    };
  }

  private option(record: { id: bigint; name: string }) {
    return {
      value: record.id.toString(),
      label: record.name,
    };
  }

  private resolveRange(fromInput?: string, toInput?: string) {
    const now = new Date();
    const from =
      this.parseDate(fromInput, 'from', 'start') ??
      this.startOfMonth(new Date(now.getFullYear(), now.getMonth() - 24, 1));
    const to = this.parseDate(toInput, 'to', 'end') ?? this.endOfDay(now);

    if (to < from) {
      throw new BadRequestException('The to date must be after the from date.');
    }

    return {
      from,
      to,
      interval: this.intervalForRange(from, to),
    };
  }

  private parseDate(
    value: string | undefined,
    label: string,
    boundary: 'start' | 'end',
  ) {
    if (!value) return null;

    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(
      dateOnly
        ? `${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}`
        : value,
    );

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${label} must be a valid date.`);
    }

    return boundary === 'start'
      ? this.startOfDay(parsed)
      : this.endOfDay(parsed);
  }

  private parseOptionalId(value: string | undefined, label: string) {
    if (!value || value === 'all') return undefined;
    return this.parseId(value, label);
  }

  private parseId(value: string, label: string) {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(`${label} must be a numeric identifier.`);
    }
    return BigInt(value);
  }

  private intervalForRange(from: Date, to: Date): Interval {
    const days = this.daysBetween(from, to);
    if (days <= 45) return 'day';
    if (days <= 185) return 'week';
    if (days <= 1095) return 'month';
    return 'year';
  }

  private buildBuckets(from: Date, to: Date, interval: Interval): DateBucket[] {
    const buckets: DateBucket[] = [];
    let cursor = this.alignDate(from, interval);

    while (cursor <= to) {
      const start = new Date(cursor);
      const next = this.nextDate(cursor, interval);
      const end = new Date(Math.min(next.getTime() - 1, to.getTime()));
      buckets.push({
        key: this.bucketKey(start, interval),
        label: this.bucketLabel(start, interval),
        start,
        end,
      });
      cursor = next;
    }

    return buckets;
  }

  private alignDate(date: Date, interval: Interval) {
    if (interval === 'year') return new Date(date.getFullYear(), 0, 1);
    if (interval === 'month') return this.startOfMonth(date);
    return this.startOfDay(date);
  }

  private nextDate(date: Date, interval: Interval) {
    if (interval === 'year') return new Date(date.getFullYear() + 1, 0, 1);
    if (interval === 'month') {
      return new Date(date.getFullYear(), date.getMonth() + 1, 1);
    }
    if (interval === 'week') return new Date(date.getTime() + 7 * DAY_MS);
    return new Date(date.getTime() + DAY_MS);
  }

  private bucketKey(date: Date, interval: Interval) {
    if (interval === 'year') return `${date.getFullYear()}`;
    if (interval === 'month') {
      return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}`;
    }
    return this.toDateInputValue(date);
  }

  private bucketLabel(date: Date, interval: Interval) {
    if (interval === 'year') return `${date.getFullYear()}`;
    if (interval === 'month') {
      return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
    }
    if (interval === 'week') {
      return `Week of ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
    }
    return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
  }

  private batchPeriodDate(batch: {
    payroll_year: number;
    payroll_month: number;
  }) {
    return new Date(batch.payroll_year, batch.payroll_month - 1, 1);
  }

  private employeeTrendDate(employee: {
    hire_date: Date | null;
    created_at: Date;
  }) {
    return employee.hire_date ?? employee.created_at;
  }

  private periodIndex(year: number, month: number) {
    return year * 12 + month;
  }

  private isWithin(date: Date, from: Date, to: Date) {
    return date >= from && date <= to;
  }

  private sumMoney(rows: Record<string, any>[], key: string) {
    return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
  }

  private daysBetween(from: Date, to: Date) {
    return Math.ceil(
      (this.endOfDay(to).getTime() - this.startOfDay(from).getTime()) / DAY_MS,
    );
  }

  private startOfDay(date: Date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0,
      0,
      0,
      0,
    );
  }

  private endOfDay(date: Date) {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      23,
      59,
      59,
      999,
    );
  }

  private startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  private endOfMonth(date: Date) {
    return new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
  }

  private toDateInputValue(date: Date) {
    return `${date.getFullYear()}-${this.pad(date.getMonth() + 1)}-${this.pad(
      date.getDate(),
    )}`;
  }

  private pad(value: number) {
    return String(value).padStart(2, '0');
  }

  private labelize(value: string) {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
