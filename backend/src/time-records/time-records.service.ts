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

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TimeRecordsService {
  private readonly overtimeThresholdHours = Number(
    process.env.OVERTIME_THRESHOLD_HOURS ?? 1,
  );

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

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.time_records.create({
        data: {
          uuid: generateUUID(),
          employee_id: employeeId,
          attendance_date: attendanceDate,
          clock_in: dto.clock_in ? new Date(dto.clock_in) : new Date(),
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

  async bulkCreate(
    dto: { records: CreateTimeRecordDto[] },
    actor: CurrentUserType,
  ) {
    const results: any[] = [];
    for (const recordDto of dto.records) {
      try {
        const result = await this.create(recordDto, actor);
        results.push(result);
      } catch (error: any) {
        if (!(error instanceof ConflictException)) {
          console.error('Bulk item failed:', error.message || error);
        }
      }
    }
    return { success: true, count: results.length };
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
        dto.records.map((recordDto) =>
          this.toBigInt(recordDto.employee_id, 'employee_id').toString(),
        ),
      ),
    ].map((id) => BigInt(id));

    const employees = await this.prisma.employees.findMany({
      where: {
        id: { in: employeeIds },
        deleted_at: null,
      },
      select: { id: true, working_location_id: true, department_id: true },
    });

    if (employees.length !== employeeIds.length) {
      throw new BadRequestException('One or more employees do not exist.');
    }

    employees.forEach((employee) =>
      this.ensureActorCanAccessEmployee(actor, employee),
    );

    const results = await this.prisma.$transaction(async (tx) => {
      const syncedRecords: any[] = [];

      for (const recordDto of dto.records) {
        const employeeId = this.toBigInt(recordDto.employee_id, 'employee_id');
        const attendanceDate = new Date(recordDto.attendance_date);

        const record = await tx.time_records.upsert({
          where: {
            employee_id_attendance_date: {
              employee_id: employeeId,
              attendance_date: attendanceDate,
            },
          },
          update: {
            clock_in: recordDto.clock_in
              ? new Date(recordDto.clock_in)
              : undefined,
            attendance_status:
              recordDto.attendance_status ?? ATTENDANCE_STATUS.PRESENT,
          },
          create: {
            uuid: generateUUID(),
            employee_id: employeeId,
            attendance_date: attendanceDate,
            clock_in: recordDto.clock_in
              ? new Date(recordDto.clock_in)
              : new Date(),
            attendance_status:
              recordDto.attendance_status ?? ATTENDANCE_STATUS.PRESENT,
          },
        });
        syncedRecords.push(record);
      }

      return syncedRecords;
    });

    this.notificationsService.broadcast({ type: 'attendance_updated' });
    this.notificationsService.broadcast({ type: 'employees_updated' });

    return { success: true, count: results.length };
  }

  async clockOut(
    uuid: string,
    dto: UpdateTimeRecordDto,
    actor: CurrentUserType,
  ) {
    const record = await this.findByUuidOrThrow(uuid);
    this.ensureActorCanAccessEmployee(actor, record.employee);
    const clockOut = dto.clock_out ? new Date(dto.clock_out) : new Date();

    if (!record.clock_in) {
      throw new BadRequestException(
        'Cannot clock out without a clock in time.',
      );
    }

    const hoursWorked = Math.max(
      0,
      (clockOut.getTime() - record.clock_in.getTime()) / (1000 * 60 * 60),
    );
    const overtimeHours = Math.max(
      0,
      hoursWorked - this.overtimeThresholdHours,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.time_records.update({
        where: { id: record.id },
        data: {
          clock_out: clockOut,
          hours_worked: hoursWorked,
          overtime_hours: overtimeHours,
          attendance_status: dto.attendance_status ?? ATTENDANCE_STATUS.PRESENT,
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
          activity_description: 'Clocked out attendance record.',
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            clock_out: clockOut.toISOString(),
            hours_worked: hoursWorked,
            overtime_hours: overtimeHours,
          },
          changed_fields: ['clock_out', 'hours_worked', 'overtime_hours'],
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

  async findAll(actor: CurrentUserType) {
    const records = await this.prisma.time_records.findMany({
      where: {
        employee: {
          deleted_at: null,
          ...this.employeeScopeWhere(actor),
        },
      },
      include: this.includes(),
      orderBy: { attendance_date: 'desc' },
    });

    return records.map((record) => this.serialize(record));
  }

  async findToday(
    workingLocationId?: string,
    category?: string,
    actor?: CurrentUserType,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      attendance_date: today,
    };

    if (workingLocationId) {
      // workingLocationId may be numeric id, uuid, or human-readable name (frontend sometimes passes name).
      let wlId: bigint | null = null;

      if (/^\d+$/.test(workingLocationId)) {
        wlId = BigInt(workingLocationId);
      } else {
        // Try uuid lookup
        const wlByUuid = await this.prisma.working_locations.findUnique({
          where: { uuid: workingLocationId },
          select: { id: true },
        });
        if (wlByUuid) wlId = wlByUuid.id;
        else {
          // Fallback: try matching by name
          const wlByName = await this.prisma.working_locations.findFirst({
            where: { name: workingLocationId, deleted_at: null },
            select: { id: true },
          });
          if (wlByName) wlId = wlByName.id;
        }
      }

      if (wlId !== null) {
        where.employee = {
          working_location_id: wlId,
        };
      } else {
        // If we can't resolve, return empty set to avoid throwing on invalid input
        return [];
      }
    }

    if (category) {
      where.employee = {
        ...(where.employee || {}),
        employment_category: {
          name: category,
        },
      };
    }

    // Apply actor scoping if provided
    if (actor) {
      const scope = this.employeeScopeWhere(actor);
      where.employee = {
        ...(where.employee || {}),
        ...scope,
      };
    }

    const records = await this.prisma.time_records.findMany({
      where,
      include: this.includes(),
    });

    return records.map((record) => this.serialize(record));
  }

  async findByEmployee(employeeIdInput: string, actor: CurrentUserType) {
    const employeeId = this.toBigInt(employeeIdInput, 'employee_id');
    const employee = await this.ensureEmployee(employeeId);
    this.ensureActorCanAccessEmployee(actor, employee);

    const records = await this.prisma.time_records.findMany({
      where: { employee_id: employeeId },
      include: this.includes(),
      orderBy: { attendance_date: 'desc' },
    });

    return records.map((record) => this.serialize(record));
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
      employee: true,
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

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(
        `Please choose a valid ${fieldName.replace('_', ' ')}.`,
      );
    }

    return BigInt(value);
  }

  private isSystemAdmin(actor?: CurrentUserType) {
    return !!actor?.roles?.some((role) =>
      ['SUPER_ADMIN', 'ADMIN'].includes(role),
    );
  }

  private employeeScopeWhere(actor: CurrentUserType) {
    if (this.isSystemAdmin(actor)) return {};

    const where: Record<string, any> = {};
    if (actor.working_location_id) {
      where.working_location_id = BigInt(actor.working_location_id);
    }
    if (actor.department_id) {
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

    if (
      actor.department_id &&
      employee.department_id?.toString() !== actor.department_id
    ) {
      throw new ForbiddenException(
        'You can only manage attendance for your department.',
      );
    }
  }
}
