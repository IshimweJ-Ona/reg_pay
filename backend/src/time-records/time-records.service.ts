import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  audit_logs_activity_type as ACTIVITY_TYPE,
  audit_logs_action as AUDIT_ACTION,
} from '@prisma/client';
import { AttendanceStatus as ATTENDANCE_STATUS } from './dto/create-time-record.dto';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { hasEffectivePermission } from '../common/utils/effective-permissions.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveTimeRecordDto } from './dto/approve-time-record.dto';
import { CreateTimeRecordDto } from './dto/create-time-record.dto';
import { UpdateTimeRecordDto } from './dto/update-time-record.dto';
import { BulkAttendanceStatus, BulkImportDto } from './dto/bulk-import.dto';
import dayjs from 'dayjs';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TimeRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateTimeRecordDto, actor: CurrentUserType) {
    const employeeId = this.toBigInt(dto.employee_id, 'employee_id');
    const employee = await this.ensureEmployee(employeeId);
    this.ensureActorCanAccessEmployee(actor, employee);

    const attendanceDate = new Date(dto.attendance_date);
    const existing = await this.prisma.time_records.findFirst({
      where: { employee_id: employeeId, attendance_date: attendanceDate },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'Time record already exists for this employee and date.',
      );
    }

    const overtime_hours = this.normalizeHours(
      dto.attendance_status ?? ('PRESENT' as any),
      dto.overtime_hours,
    );

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.time_records.create({
        data: {
          uuid: generateUUID(),
          employee_id: employeeId,
          attendance_date: attendanceDate,
          overtime_hours,
          attendance_status: dto.attendance_status ?? ('PRESENT' as any),
          // Denormalized from the employee at write-time so permission-driven
          // query scoping (MODULE_SCOPE_CONFIG) can filter this table
          // directly without a relation join.
          working_location_id: employee.working_location_id,
          department_id: employee.department_id,
          updated_at: new Date(),
        },
        include: this.includes() as any,
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: employeeId,
          entity_table: 'time_records',
          entity_id: created.id,
          module_name: 'ATTENDANCE',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: 'Created attendance record.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            employee_id: employeeId.toString(),
            attendance_date: attendanceDate.toISOString(),
          },
        },
      });

      return created;
    });

    this.notificationsService.broadcast({ type: 'attendance_updated' });
    this.notificationsService.broadcast({ type: 'employees_updated' });

    return this.serialize(record);
  }

  async bulkCreate(dto: BulkImportDto, actor: CurrentUserType) {
    const records = dto.records || [];

    if (records.length === 0) {
      throw new BadRequestException('No records to import.');
    }

    let dateFrom: Date;
    let dateTo: Date;

    if (dto.date_from && dto.date_to) {
      dateFrom = new Date(dto.date_from);
      dateTo = new Date(dto.date_to);
    } else {
      const recordDates = records
        .map((r) => new Date(r.attendance_date))
        .filter((d) => !isNaN(d.getTime()));

      if (recordDates.length === 0) {
        throw new BadRequestException(
          'No valid attendance_date values found in records.',
        );
      }

      dateFrom = new Date(Math.min(...recordDates.map((d) => d.getTime())));
      dateTo = new Date(Math.max(...recordDates.map((d) => d.getTime())));
    }

    if (dateTo.getTime() < dateFrom.getTime()) {
      throw new BadRequestException(
        'date_to must be greater than or equal to date_from.',
      );
    }

    // Resolve working_location and department from names if provided
    let scopeWorkingLocationId: bigint | null = null;
    let scopeDepartmentId: bigint | null = null;

    if (dto.working_location) {
      const wl = await this.prisma.working_locations.findFirst({
        where: { name: dto.working_location, deleted_at: null },
        select: { id: true },
      });
      if (!wl) {
        throw new BadRequestException(
          `Working location "${dto.working_location}" not found.`,
        );
      }
      scopeWorkingLocationId = wl.id;
    }

    if (dto.department) {
      const dept = await this.prisma.departments.findFirst({
        where: { name: dto.department },
        select: { id: true },
      });
      if (!dept) {
        throw new BadRequestException(
          `Department "${dto.department}" not found.`,
        );
      }
      scopeDepartmentId = dept.id;
    }

    const errors: Array<{
      row: number;
      employee_id?: string;
      message: string;
    }> = [];

    const employeeIdStrings = records
      .map((r) => r.employee_id)
      .filter((id) => /^\d+$/.test(id));
    const uniqueEmployeeIds = [...new Set(employeeIdStrings)].map((id) =>
      BigInt(id),
    );

    const employees = await this.prisma.employees.findMany({
      where: { id: { in: uniqueEmployeeIds }, deleted_at: null },
      select: { id: true, working_location_id: true, department_id: true },
    });

    const employeeMap = new Map<
      string,
      {
        id: bigint;
        working_location_id?: bigint | null;
        department_id?: bigint | null;
      }
    >();
    for (const emp of employees) {
      employeeMap.set(emp.id.toString(), emp);
    }

    for (let i = 0; i < records.length; i++) {
      const row = i + 1;
      const recordDto = records[i];

      if (!recordDto.employee_id) {
        errors.push({ row, message: 'employee_id is required' });
        continue;
      }

      if (!/^\d+$/.test(recordDto.employee_id)) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: 'employee_id must be a numeric ID',
        });
        continue;
      }

      const employee = employeeMap.get(recordDto.employee_id);
      if (!employee) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: 'Employee does not exist',
        });
        continue;
      }

      // If working_location scope is set, filter employees by that location
      if (
        scopeWorkingLocationId &&
        employee.working_location_id !== scopeWorkingLocationId
      ) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: `Employee does not belong to working location "${dto.working_location}"`,
        });
        continue;
      }

      // If department scope is set, filter employees by that department
      if (scopeDepartmentId && employee.department_id !== scopeDepartmentId) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: `Employee does not belong to department "${dto.department}"`,
        });
        continue;
      }

      try {
        this.ensureActorCanAccessEmployee(actor, employee);
      } catch (err: any) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message:
            err.message || 'Actor is not allowed to manage this employee',
        });
      }

      const attendanceStatus = recordDto.attendance_status;
      if (!attendanceStatus) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: 'attendance_status is required',
        });
      } else if (
        !Object.values(BulkAttendanceStatus).includes(attendanceStatus)
      ) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: 'attendance_status must be exactly PRESENT or ABSENT',
        });
      }

      if (
        attendanceStatus === BulkAttendanceStatus.ABSENT &&
        (recordDto.overtime_hours ?? 0) > 0
      ) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: 'overtime_hours must be 0 when attendance_status is ABSENT',
        });
      }

      if (!recordDto.attendance_date) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: 'attendance_date is required',
        });
      } else {
        const attendanceDate = new Date(recordDto.attendance_date);
        if (isNaN(attendanceDate.getTime())) {
          errors.push({
            row,
            employee_id: recordDto.employee_id,
            message: 'attendance_date must be a valid date',
          });
        } else if (
          attendanceDate.getTime() < dateFrom.getTime() ||
          attendanceDate.getTime() > dateTo.getTime()
        ) {
          errors.push({
            row,
            employee_id: recordDto.employee_id,
            message: `attendance_date must be within the range [${dto.date_from || dateFrom.toISOString().split('T')[0]}, ${dto.date_to || dateTo.toISOString().split('T')[0]}]`,
          });
        }
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        success: false,
        count: 0,
        rejected: errors.length,
        errors,
      });
    }

    const syncedRecords = await this.prisma.$transaction(async (tx) => {
      const results: any[] = [];
      for (const recordDto of records) {
        const employeeId = BigInt(recordDto.employee_id);
        const attendanceDate = new Date(recordDto.attendance_date);
        const emp = employeeMap.get(recordDto.employee_id);

        const overtime_hours = this.normalizeHours(
          recordDto.attendance_status,
          recordDto.overtime_hours,
        );

        const upserted = await tx.time_records.upsert({
          where: {
            employee_id_attendance_date: {
              employee_id: employeeId,
              attendance_date: attendanceDate,
            },
          },
          update: {
            attendance_status: recordDto.attendance_status,
            overtime_hours,
          },
          create: {
            uuid: generateUUID(),
            employee_id: employeeId,
            attendance_date: attendanceDate,
            attendance_status: recordDto.attendance_status,
            overtime_hours,
            working_location_id: emp?.working_location_id ?? null,
            department_id: emp?.department_id ?? null,
            updated_at: new Date(),
          },
        });
        results.push(upserted);
      }
      return results;
    });

    this.notificationsService.broadcast({ type: 'attendance_updated' });
    this.notificationsService.broadcast({ type: 'employees_updated' });

    return {
      success: true,
      count: syncedRecords.length,
      rejected: 0,
      errors: [],
    };
  }

  async update(uuid: string, dto: UpdateTimeRecordDto, actor: CurrentUserType) {
    const timeRecord = await this.findByUuidOrThrow(uuid);
    this.ensureActorCanAccessEmployee(actor, timeRecord.employees);
    this.ensureActorCanAccessEmployee(actor, timeRecord.employees);

    const resolvedStatus =
      dto.attendance_status ?? timeRecord.attendance_status;
    const overtime_hours = this.normalizeHours(
      resolvedStatus,
      dto.overtime_hours ?? Number(timeRecord.overtime_hours ?? 0),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.time_records.update({
        where: { id: timeRecord.id },
        data: {
          overtime_hours,
          attendance_status: dto.attendance_status ?? undefined,
        },
        include: this.includes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: timeRecord.employee_id,
          entity_table: 'time_records',
          entity_id: timeRecord.id,
          module_name: 'ATTENDANCE',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated attendance record.',
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            overtime_hours,
            attendance_status: dto.attendance_status ?? undefined,
          },
          changed_fields: ['overtime_hours', 'attendance_status'],
        },
      });

      return saved;
    });

    return this.serialize(updated);
  }

  async approve(
    uuid: string,
    dto: ApproveTimeRecordDto,
    actor: CurrentUserType,
  ) {
    const timeRecord = await this.findByUuidOrThrow(uuid);
    this.ensureActorCanAccessEmployee(actor, timeRecord.employees);

    const approved = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.time_records.update({
        where: { id: timeRecord.id },
        data: { approved_by: BigInt(actor.userId) },
        include: this.includes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: timeRecord.employee_id,
          entity_table: 'time_records',
          entity_id: timeRecord.id,
          module_name: 'ATTENDANCE',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: dto.comment
            ? `Approved attendance record: ${dto.comment}`
            : 'Approved attendance record.',
          action: AUDIT_ACTION.APPROVED,
          new_values: { approved_by: actor.userId },
          changed_fields: ['approved_by'],
        },
      });

      return saved;
    });

    return this.serialize(approved);
  }

  async findAll(
    actor: CurrentUserType,
    filters?: {
      start_date?: string;
      end_date?: string;
      working_location_id?: string;
      employee_id?: string;
    },
  ) {
    const where: any = {
      employees: {
        deleted_at: null,
        ...this.employeeScopeWhere(actor),
      },
    };

    if (filters?.start_date || filters?.end_date) {
      where.attendance_date = {};
      if (filters.start_date)
        where.attendance_date.gte = new Date(filters.start_date);
      if (filters.end_date)
        where.attendance_date.lte = new Date(filters.end_date);
    }

    if (filters?.employee_id) {
      where.employee_id = this.toBigInt(filters.employee_id, 'employee_id');
    }

    if (filters?.working_location_id) {
      const wlId = await this.resolveWorkingLocationId(
        filters.working_location_id,
      );
      if (wlId === null) return [];
      where.employees = { ...where.employees, working_location_id: wlId };
    }

    const records = await this.prisma.time_records.findMany({
      where,
      include: this.includes(),
      orderBy: { attendance_date: 'desc' },
    });

    return records.map((r) => this.serialize(r));
  }

  private async resolveWorkingLocationId(
    value: string,
  ): Promise<bigint | null> {
    if (/^\d+$/.test(value)) return BigInt(value);

    const wlByUuid = await this.prisma.working_locations.findUnique({
      where: { uuid: value },
      select: { id: true },
    });
    if (wlByUuid) return wlByUuid.id;

    const wlByName = await this.prisma.working_locations.findFirst({
      where: { name: value, deleted_at: null },
      select: { id: true },
    });
    return wlByName?.id ?? null;
  }

  async findPending(
    actor: CurrentUserType,
    filters?: {
      start_date?: string;
      end_date?: string;
      working_location_id?: string;
      category?: string;
    },
  ) {
    const { start, end } = this.resolvePendingPeriod(
      filters?.start_date,
      filters?.end_date,
    );
    const dates = this.enumerateDateKeys(start, end);

    const employeeWhere: any = {
      status: 'ACTIVE',
      deleted_at: null,
      ...this.employeeScopeWhere(actor),
    };

    if (filters?.working_location_id) {
      const wlId = await this.resolveWorkingLocationId(
        filters.working_location_id,
      );
      if (wlId === null) return this.emptyPendingResponse(start, end);

      if (
        !this.isSystemAdmin(actor) &&
        !hasEffectivePermission(actor, 'attendance.read_all') &&
        actor.working_location_id !== wlId.toString()
      ) {
        throw new ForbiddenException(
          'You can only view pending attendance in your working location.',
        );
      }

      employeeWhere.working_location_id = wlId;
    }

    const category = filters?.category?.trim();
    if (category && category.toUpperCase() !== 'ALL') {
      employeeWhere.employment_categories = {
        name: this.normalizeCategoryName(category),
      };
    }

    const employees = await this.prisma.employees.findMany({
      where: employeeWhere,
      select: {
        id: true,
        uuid: true,
        first_name: true,
        last_name: true,
        working_location_id: true,
        department_id: true,
        departments: { select: { uuid: true, name: true } },
        working_locations: { select: { uuid: true, name: true } },
        positions: {
          select: {
            uuid: true,
            name: true,
          },
        },
        employment_categories: {
          select: { uuid: true, name: true, payroll_frequency: true },
        },
      },
      orderBy: [{ first_name: 'asc' }, { last_name: 'asc' }],
    });

    if (!employees.length) return this.emptyPendingResponse(start, end);

    const employeeIds = employees.map((employee) => employee.id);
    const records = await this.prisma.time_records.findMany({
      where: {
        employee_id: { in: employeeIds },
        attendance_date: {
          gte: start,
          lte: end,
        },
      },
      select: {
        employee_id: true,
        attendance_date: true,
      },
    });

    const recordedDatesByEmployee = new Map<string, Set<string>>();
    for (const record of records) {
      const employeeId = record.employee_id.toString();
      const dateSet =
        recordedDatesByEmployee.get(employeeId) ?? new Set<string>();
      dateSet.add(this.dateKey(record.attendance_date));
      recordedDatesByEmployee.set(employeeId, dateSet);
    }

    const pending = employees
      .map((employee) => {
        const employeeId = employee.id.toString();
        const recordedDates =
          recordedDatesByEmployee.get(employeeId) ?? new Set<string>();
        const missing_dates = dates.filter((date) => !recordedDates.has(date));

        return {
          employee_id: employeeId,
          employee_uuid: employee.uuid,
          employee_name: `${employee.first_name} ${employee.last_name}`.trim(),
          working_location_id: employee.working_location_id?.toString() ?? null,
          working_location: employee.working_locations
            ? {
                uuid: employee.working_locations.uuid,
                name: employee.working_locations.name,
              }
            : null,
          department_id: employee.department_id?.toString() ?? null,
          department: employee.departments
            ? {
                uuid: employee.departments.uuid,
                name: employee.departments.name,
              }
            : null,
          position: employee.positions
            ? {
                uuid: employee.positions.uuid,
                name: employee.positions.name,
                payroll_frequency:
                  employee.employment_categories?.payroll_frequency ?? null,
              }
            : null,
          missing_dates,
          missing_count: missing_dates.length,
        };
      })
      .filter((employee) => employee.missing_count > 0);

    return {
      start_date: this.dateKey(start),
      end_date: this.dateKey(end),
      total_pending_employees: pending.length,
      total_missing_entries: pending.reduce(
        (sum, employee) => sum + employee.missing_count,
        0,
      ),
      pending,
    };
  }

  async findByEmployee(
    employeeIdInput: string,
    actor: CurrentUserType,
    filters?: { start_date?: string; end_date?: string },
  ) {
    const employeeId = this.toBigInt(employeeIdInput, 'employee_id');
    const employee = await this.ensureEmployee(employeeId);
    this.ensureActorCanReadEmployee(actor, employee);

    const where: any = { employee_id: employeeId };
    if (filters?.start_date || filters?.end_date) {
      where.attendance_date = {};
      if (filters.start_date)
        where.attendance_date.gte = new Date(filters.start_date);
      if (filters.end_date)
        where.attendance_date.lte = new Date(filters.end_date);
    }

    const records = await this.prisma.time_records.findMany({
      where,
      include: this.includes(),
      orderBy: { attendance_date: 'desc' },
    });

    return records.map((r) => this.serialize(r));
  }

  private async findByUuidOrThrow(uuid: string) {
    const record = await this.prisma.time_records.findUnique({
      where: { uuid },
      include: { employees: true },
    });

    if (!record) throw new NotFoundException('Time record not found.');
    return record;
  }

  private async ensureEmployee(employeeId: bigint) {
    const employee = await this.prisma.employees.findFirst({
      where: { id: employeeId, deleted_at: null },
      select: { id: true, working_location_id: true, department_id: true },
    });

    if (!employee) throw new BadRequestException('Employee does not exist.');
    return employee;
  }

  private includes() {
    return {
      employees: {
        include: {
          positions: true,
          employment_categories: true,
          departments: true,
          working_locations: true,
        },
      },
      users: true,
    };
  }

  private serialize(record: Record<string, any>) {
    const emp = record.employees;
    return {
      ...record,
      id: record.id.toString(),
      employee_id: record.employee_id.toString(),
      approved_by: record.approved_by?.toString() ?? null,
      overtime_hours: record.overtime_hours?.toString() ?? null,
      employee: emp
        ? {
            ...emp,
            id: emp.id.toString(),
            created_by: emp.created_by?.toString() ?? null,
            department_id: emp.department_id?.toString() ?? null,
            working_location_id: emp.working_location_id?.toString() ?? null,
            position_id: emp.position_id?.toString() ?? null,
            department: emp.departments ?? undefined,
            working_location: emp.working_locations ?? undefined,
            // Top-level, matching employees.service.ts's serializeEmployee
            // shape exactly - the attendance page's Monthly/Daily/Custom tab
            // filter reads employee.employment_category.name (not nested
            // under .position), same as the employee list/dropdown does.
            employment_category: emp.employment_categories
              ? {
                  uuid: emp.employment_categories.uuid,
                  name: emp.employment_categories.name,
                }
              : null,
            // Also kept nested under position for any caller already reading
            // it there.
            position: emp.positions
              ? {
                  uuid: emp.positions.uuid,
                  name: emp.positions.name,
                  payroll_frequency:
                    emp.employment_categories?.payroll_frequency ?? null,
                  tax_behavior: emp.employment_categories?.tax_behavior ?? null,
                  employment_category: emp.employment_categories
                    ? {
                        uuid: emp.employment_categories.uuid,
                        name: emp.employment_categories.name,
                      }
                    : null,
                }
              : undefined,
          }
        : undefined,
      approvedBy: record.approvedBy
        ? {
            ...record.approvedBy,
            id: record.approvedBy.id.toString(),
            department_id: record.approvedBy.department_id?.toString() ?? null,
            working_location_id:
              record.approvedBy.working_location_id?.toString() ?? null,
          }
        : null,
    };
  }

  private normalizeHours(status: any, overtimeHours?: number): number {
    if (status === 'ABSENT') {
      return 0;
    }
    return overtimeHours ?? 0;
  }

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(
        `Please choose a valid ${fieldName.replace('_', ' ')}.`,
      );
    }
    return BigInt(value);
  }

  private resolvePendingPeriod(startInput?: string, endInput?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = startInput
      ? new Date(startInput)
      : new Date(today.getFullYear(), today.getMonth(), 1);
    const end = endInput ? new Date(endInput) : today;

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException(
        'Please choose a valid attendance date range.',
      );
    }

    if (end.getTime() < start.getTime()) {
      throw new BadRequestException(
        'end_date must be greater than or equal to start_date.',
      );
    }

    return { start, end };
  }

  private enumerateDateKeys(start: Date, end: Date) {
    const dates: string[] = [];
    const cursor = new Date(start);

    while (cursor.getTime() <= end.getTime()) {
      dates.push(this.dateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  private dateKey(date: Date) {
    return dayjs(date).format('YYYY-MM-DD');
  }

  private emptyPendingResponse(start: Date, end: Date) {
    return {
      start_date: this.dateKey(start),
      end_date: this.dateKey(end),
      total_pending_employees: 0,
      total_missing_entries: 0,
      pending: [],
    };
  }

  private normalizeCategoryName(category: string) {
    const normalized = category.trim().toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private isSystemAdmin(actor?: CurrentUserType) {
    return !!actor?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
  }

  private employeeScopeWhere(actor: CurrentUserType) {
    if (this.isSystemAdmin(actor)) return {};
    if (hasEffectivePermission(actor, 'attendance.read_all')) return {};

    const where: Record<string, any> = {};
    if (actor.working_location_id) {
      where.working_location_id = BigInt(actor.working_location_id);
    }

    // BRANCH_MANAGER and HR manage the whole working location, not just the
    // department their own user row happens to belong to. Mirrors the same
    // exemption in employees.service.ts.
    const isExempt = actor.roles.some((role) =>
      ['BRANCH_MANAGER', 'HR'].includes(role),
    );

    if (!isExempt && actor.department_id) {
      where.department_id = BigInt(actor.department_id);
    }
    return where;
  }

  private ensureActorCanAccessEmployee(
    actor: CurrentUserType,
    employee: {
      working_location_id?: bigint | null;
      department_id?: bigint | null;
    },
  ) {
    if (this.isSystemAdmin(actor)) return;

    if (
      actor.working_location_id &&
      employee.working_location_id?.toString() !== actor.working_location_id
    ) {
      throw new ForbiddenException(
        'You can only manage attendance in your working location.',
      );
    }

    // See employeeScopeWhere() above: branch managers and HR are scoped to
    // their working location only, never additionally to a single department.
    const isExempt = actor.roles.some((role) =>
      ['BRANCH_MANAGER', 'HR'].includes(role),
    );

    if (
      !isExempt &&
      actor.department_id &&
      employee.department_id?.toString() !== actor.department_id
    ) {
      throw new ForbiddenException(
        'You can only manage attendance for your department.',
      );
    }
  }

  private ensureActorCanReadEmployee(
    actor: CurrentUserType,
    employee: {
      working_location_id?: bigint | null;
      department_id?: bigint | null;
    },
  ) {
    if (this.isSystemAdmin(actor)) return;
    if (hasEffectivePermission(actor, 'attendance.read_all')) return;
    this.ensureActorCanAccessEmployee(actor, employee);
  }
}
