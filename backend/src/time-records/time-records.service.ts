import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ACTIVITY_TYPE, ATTENDANCE_STATUS, AUDIT_ACTION } from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { ApproveTimeRecordDto } from './dto/approve-time-record.dto';
import { CreateTimeRecordDto } from './dto/create-time-record.dto';
import { UpdateTimeRecordDto } from './dto/update-time-record.dto';
import { BulkImportDto } from './dto/bulk-import.dto';
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

    const { hours_worked, overtime_hours } = this.normalizeHours(
      dto.attendance_status ?? ATTENDANCE_STATUS.PRESENT,
      dto.hours_worked,
      dto.overtime_hours,
    );

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.time_records.create({
        data: {
          uuid: generateUUID(),
          employee_id: employeeId,
          attendance_date: attendanceDate,
          hours_worked,
          overtime_hours,
          attendance_status: dto.attendance_status ?? ATTENDANCE_STATUS.PRESENT,
        },
        include: this.includes(),
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

    if ( records.length === 0) {
      throw new BadRequestException('No records to import.')
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
    string, {
      id: bigint,
      working_location_id?: bigint | null;
      department_id?: bigint | null;
    }>();
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

      try {
        this.ensureActorCanAccessEmployee(actor, employee);
      } catch (err: any) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: err.message || 'Actor is not allowed to manage this employee',
        });
      }

      if (!recordDto.attendance_status) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: 'attendance_status is required',
        });
      } else if (
        recordDto.attendance_status !== 'PRESENT' &&
        recordDto.attendance_status !== 'ABSENT'
      ) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message: 'attendance_status must be exactly PRESENT or ABSENT',
        });
      }

      if (
        recordDto.attendance_status === 'ABSENT' &&
        ((recordDto.hours_worked ?? 0) > 0 || (recordDto.overtime_hours ?? 0) > 0)
      ) {
        errors.push({
          row,
          employee_id: recordDto.employee_id,
          message:
            'hours_worked and overtime_hours must be 0 when attendance_status is ABSENT',
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

        const { hours_worked, overtime_hours } = this.normalizeHours(
          recordDto.attendance_status,
          recordDto.hours_worked,
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
            hours_worked,
            overtime_hours,
          },
          create: {
            uuid: generateUUID(),
            employee_id: employeeId,
            attendance_date: attendanceDate,
            attendance_status: recordDto.attendance_status,
            hours_worked,
            overtime_hours,
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

  async batchSync(
    dto: { records: CreateTimeRecordDto[] },
    actor: CurrentUserType,
  ) {
    if (!dto.records?.length) {
      return { success: true, count: 0 };
    }

    const employeeIds = [
      ...new Set(
        dto.records.map((r) =>
          this.toBigInt(r.employee_id, 'employee_id').toString(),
        ),
      ),
    ].map((id) => BigInt(id));

    const employees = await this.prisma.employees.findMany({
      where: { id: { in: employeeIds }, deleted_at: null },
      select: { id: true, working_location_id: true, department_id: true },
    });

    if (employees.length !== employeeIds.length) {
      throw new BadRequestException('One or more employees do not exist.');
    }

    employees.forEach((emp) => this.ensureActorCanAccessEmployee(actor, emp));

    const results = await this.prisma.$transaction(async (tx) => {
      const synced: any[] = [];

      for (const recordDto of dto.records) {
        const employeeId = this.toBigInt(recordDto.employee_id, 'employee_id');
        const attendanceDate = new Date(recordDto.attendance_date);

        const { hours_worked, overtime_hours } = this.normalizeHours(
          recordDto.attendance_status,
          recordDto.hours_worked,
          recordDto.overtime_hours,
        );

        const record = await tx.time_records.upsert({
          where: {
            employee_id_attendance_date: {
              employee_id: employeeId,
              attendance_date: attendanceDate,
            },
          },
          update: {
            hours_worked,
            overtime_hours: overtime_hours ?? undefined,
            attendance_status:
              recordDto.attendance_status ?? ATTENDANCE_STATUS.PRESENT,
          },
          create: {
            uuid: generateUUID(),
            employee_id: employeeId,
            attendance_date: attendanceDate,
            hours_worked,
            overtime_hours,
            attendance_status:
              recordDto.attendance_status ?? ATTENDANCE_STATUS.PRESENT,
          },
        });
        synced.push(record);
      }

      return synced;
    });

    this.notificationsService.broadcast({ type: 'attendance_updated' });
    this.notificationsService.broadcast({ type: 'employees_updated' });

    return { success: true, count: results.length };
  }

  async update(
    uuid: string,
    dto: UpdateTimeRecordDto,
    actor: CurrentUserType,
  ) {
    const record = await this.findByUuidOrThrow(uuid);
    this.ensureActorCanAccessEmployee(actor, record.employee);

    const resolvedStatus = dto.attendance_status ?? record.attendance_status;
    const { hours_worked, overtime_hours } = this.normalizeHours(
      resolvedStatus,
      dto.hours_worked ?? Number(record.hours_worked ?? 0),
      dto.overtime_hours ?? Number(record.overtime_hours ?? 0),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.time_records.update({
        where: { id: record.id },
        data: {
          hours_worked,
          overtime_hours,
          attendance_status: dto.attendance_status ?? undefined,
        },
        include: this.includes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: record.employee_id,
          entity_table: 'time_records',
          entity_id: record.id,
          module_name: 'ATTENDANCE',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated attendance record.',
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            hours_worked,
            overtime_hours,
            attendance_status: dto.attendance_status ?? undefined,
          },
          changed_fields: ['hours_worked', 'overtime_hours', 'attendance_status'],
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
    const record = await this.findByUuidOrThrow(uuid);
    this.ensureActorCanAccessEmployee(actor, record.employee);

    const approved = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.time_records.update({
        where: { id: record.id },
        data: { approved_by: BigInt(actor.userId) },
        include: this.includes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: record.employee_id,
          entity_table: 'time_records',
          entity_id: record.id,
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
      employee: {
        deleted_at: null,
        ...this.employeeScopeWhere(actor),
      },
    };

    if (filters?.start_date || filters?.end_date) {
      where.attendance_date = {};
      if (filters.start_date) where.attendance_date.gte = new Date(filters.start_date);
      if (filters.end_date) where.attendance_date.lte = new Date(filters.end_date);
    }

    if (filters?.employee_id) {
      where.employee_id = this.toBigInt(filters.employee_id, 'employee_id');
    }

    if (filters?.working_location_id) {
      const wlId = await this.resolveWorkingLocationId(filters.working_location_id);
      if (wlId === null) return [];
      where.employee = { ...where.employee, working_location_id: wlId };
    }

    const records = await this.prisma.time_records.findMany({
      where,
      include: this.includes(),
      orderBy: { attendance_date: 'desc' },
    });

    return records.map((r) => this.serialize(r));
  }

  private async resolveWorkingLocationId(value: string): Promise<bigint | null> {
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

  async findToday(
    workingLocationId?: string,
    category?: string,
    actor?: CurrentUserType,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = { attendance_date: today };

    if (workingLocationId) {
      const wlId = await this.resolveWorkingLocationId(workingLocationId);

      if (wlId !== null) {
        where.employee = { working_location_id: wlId };
      } else {
        return [];
      }
    }

    if (category) {
      where.employee = {
        ...(where.employee || {}),
        employment_category: { name: category },
      };
    }

    if (actor) {
      where.employee = {
        ...(where.employee || {}),
        ...this.employeeScopeWhere(actor),
      };
    }

    const records = await this.prisma.time_records.findMany({
      where,
      include: this.includes(),
    });

    return records.map((r) => this.serialize(r));
  }

  async findByEmployee(
    employeeIdInput: string,
    actor: CurrentUserType,
    filters?: { start_date?: string; end_date?: string },
  ) {
    const employeeId = this.toBigInt(employeeIdInput, 'employee_id');
    const employee = await this.ensureEmployee(employeeId);
    this.ensureActorCanAccessEmployee(actor, employee);

    const where: any = { employee_id: employeeId };
    if (filters?.start_date || filters?.end_date) {
      where.attendance_date = {};
      if (filters.start_date) where.attendance_date.gte = new Date(filters.start_date);
      if (filters.end_date) where.attendance_date.lte = new Date(filters.end_date);
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
      include: { employee: true },
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
      employee: { include: { employment_category: true, department: true } },
      approvedBy: true,
    };
  }

  private serialize(record: Record<string, any>) {
    return {
      ...record,
      id: record.id.toString(),
      employee_id: record.employee_id.toString(),
      approved_by: record.approved_by?.toString() ?? null,
      hours_worked: record.hours_worked?.toString() ?? null,
      overtime_hours: record.overtime_hours?.toString() ?? null,
      employee: record.employee
        ? {
            ...record.employee,
            id: record.employee.id.toString(),
            created_by: record.employee.created_by?.toString() ?? null,
            department_id: record.employee.department_id?.toString() ?? null,
            working_location_id:
              record.employee.working_location_id?.toString() ?? null,
            employment_category_id:
              record.employee.employment_category_id?.toString() ?? null,
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

  private normalizeHours(
    status: ATTENDANCE_STATUS | undefined,
    hoursWorked?: number,
    overtimeHours?: number,
  ) {
    if (status === ATTENDANCE_STATUS.ABSENT) {
      return { hours_worked: 0, overtime_hours: 0 };
    }
    return {
      hours_worked: hoursWorked ?? 0,
      overtime_hours: overtimeHours ?? 0,
    };
  }

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(
        `Please choose a valid ${fieldName.replace('_', ' ')}.`,
      );
    }
    return BigInt(value);
  }

  private isSystemAdmin(actor?: CurrentUserType) {
    return !!actor?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
  }

  private employeeScopeWhere(actor: CurrentUserType) {
    if (this.isSystemAdmin(actor)) return {};

    const where: Record<string, any> = {};
    if (actor.working_location_id) {
      where.working_location_id = BigInt(actor.working_location_id);
    }

    // A BRANCH_MANAGER manages an entire working location, across every
    // department in it — they are not scoped to just the one department
    // their own user record happens to belong to. Department-level scoping
    // is only for narrower "attendance actor" roles (e.g. a department
    // attendant). Without this exemption, a branch manager whose own user
    // row has a department_id set would only ever see/manage employees in
    // that single department, and any bulk attendance import covering the
    // rest of the branch would appear to have "no employees" or get
    // rejected — while SUPER_ADMIN (fully exempted above) never hit this,
    // which is why the same import worked for one role and not the other.
    // Mirrors the identical isBranchManager exemption already used in
    // employees.service.ts for the same reason.
    const isBranchManager = actor.roles.some((role) =>
      ['BRANCH_MANAGER'].includes(role),
    );

    if (!isBranchManager && actor.department_id) {
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

    // See employeeScopeWhere() above: branch managers are scoped to their
    // working location only, never additionally to a single department.
    const isBranchManager = actor.roles.some((role) =>
      ['BRANCH_MANAGER'].includes(role),
    );

    if (
      !isBranchManager &&
      actor.department_id &&
      employee.department_id?.toString() !== actor.department_id
    ) {
      throw new ForbiddenException(
        'You can only manage attendance for your department.',
      );
    }
  }
}