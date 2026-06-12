import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import {
  ACTION_TYPE,
  ACTIVITY_TYPE,
  AUDIT_ACTION,
  APPROVAL_STATUS,
  STATUS_ACTIVE_INACTIVE,
  STATUS_USER,
  TRANSFER_SUBJECT,
} from '@prisma/client';

import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import {
  isNumericId,
  normalizeSearch,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { SuspendEmployeeDto } from './dto/suspend-employee.dto';
import { TransferEmployeeDto } from './dto/transfer-employee.dto';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  async create(dto: CreateEmployeeDto, actor?: CurrentUserType) {
    const managerScoped =
      actor?.roles?.some((role) =>
        ['BRANCH_MANAGER', 'MANAGER', 'ON_MANAGER'].includes(role),
      ) && !this.isSystemAdmin(actor);
    const effectiveWorkingLocationInput =
      managerScoped && actor?.working_location_id
        ? actor.working_location_id
        : dto.working_location_id;
    const workingLocationId = effectiveWorkingLocationInput
      ? await this.resolveWorkingLocationId(effectiveWorkingLocationInput)
      : null;

    const departmentId = dto.department_id
      ? await this.resolveDepartmentId(dto.department_id, workingLocationId)
      : null;

    const categoryId = dto.employment_category_id
      ? this.toBigInt(dto.employment_category_id, 'employment_category_id')
      : null;

    if (workingLocationId && departmentId) {
      await this.ensureOrganization(workingLocationId, departmentId);
    }

    if (categoryId) {
      await this.ensureEmploymentCategory(categoryId);
    }

    this.ensureActorCanUseScope(
      actor,
      workingLocationId,
      departmentId,
      'create employees',
    );

    const employee = await this.prisma.$transaction(async (tx) => {
      const created = await tx.employees.create({
        data: {
          uuid: generateUUID(),
          first_name: dto.first_name,
          last_name: dto.last_name,
          email: dto.email,
          phone_number: dto.phone_number,
          national_id: dto.national_id,
          gender: dto.gender,
          hire_date: dto.hire_date ? new Date(dto.hire_date) : null,
          department_id: departmentId,
          working_location_id: workingLocationId,
          employment_category_id: categoryId,
          status: STATUS_USER.ACTIVE,
          created_by: actor ? BigInt(actor.userId) : null,
        },
        include: this.employeeIncludes(),
      });

      if (actor) {
        await tx.audit_logs.create({
          data: {
            user_id: BigInt(actor.userId),
            employee_id: created.id,
            entity_table: 'employees',
            entity_id: created.id,
            module_name: 'EMPLOYEES',
            activity_type: ACTIVITY_TYPE.CREATE,
            activity_description: 'Created employee profile.',
            action: AUDIT_ACTION.CREATED,
            new_values: {
              working_location_id: workingLocationId?.toString() ?? null,
              department_id: departmentId?.toString() ?? null,
              employment_category_id: categoryId?.toString() ?? null,
            },
          },
        });
      }

      return created;
    });

    await this.cacheManager.del('employees:all');

    return this.serializeEmployee(employee);
  }

  async findAll(actor: CurrentUserType, qInput?: string) {
    const q = normalizeSearch(qInput);
    const cacheKey = `employees:all:${actor.userId}:${actor.working_location_id ?? ''}:${q ?? ''}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const employees = await this.prisma.employees.findMany({
      where: {
        deleted_at: null,
        ...this.employeeScopeWhere(actor),
        ...(q
          ? {
              OR: [
                {
                  first_name: {
                    contains: q,
                  },
                },
                {
                  last_name: {
                    contains: q,
                  },
                },
                {
                  email: {
                    contains: q,
                  },
                },
                {
                  phone_number: {
                    contains: q,
                  },
                },
                {
                  national_id: {
                    contains: q,
                  },
                },
              ],
            }
          : {}),
      },
      distinct: ['uuid'],
      include: this.employeeIncludes(),
      orderBy: {
        created_at: 'desc',
      },
    });

    const result = {
      employees: employees.map((employee) => this.serializeEmployee(employee)),
    };
    await this.cacheManager.set(cacheKey, result, 30000); // 30 seconds cache
    return result;
  }

  async findOne(uuid: string, actor: CurrentUserType) {
    const employee = await this.prisma.employees.findUnique({
      where: { uuid },
      include: {
        ...this.employeeIncludes(),
        employee_history: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });

    if (!employee || employee.deleted_at) {
      throw new NotFoundException('Employee not found.');
    }

    this.ensureActorCanAccessEmployee(actor, employee);

    return this.serializeEmployee(employee);
  }

  // Update employee profile details with audit logging
  async update(
    uuid: string,
    dto: Partial<CreateEmployeeDto>,
    actor: CurrentUserType,
  ) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);
    this.ensureActorCanAccessEmployee(actor, employee);

    const workingLocationId = dto.working_location_id
      ? await this.resolveWorkingLocationId(dto.working_location_id)
      : undefined;

    const departmentId = dto.department_id
      ? await this.resolveDepartmentId(
          dto.department_id,
          workingLocationId ?? employee.working_location_id,
        )
      : undefined;

    const categoryId = dto.employment_category_id
      ? this.toBigInt(dto.employment_category_id, 'employment_category_id')
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.employees.update({
        where: { id: employee.id },
        data: {
          first_name: dto.first_name,
          last_name: dto.last_name,
          email: dto.email,
          phone_number: dto.phone_number,
          national_id: dto.national_id,
          gender: dto.gender,
          hire_date: dto.hire_date ? new Date(dto.hire_date) : undefined,
          department_id: departmentId,
          working_location_id: workingLocationId,
          employment_category_id: categoryId,
        },
        include: this.employeeIncludes(),
      });

      // Log the update activity for auditing
      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: saved.id,
          entity_table: 'employees',
          entity_id: saved.id,
          module_name: 'EMPLOYEES',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated employee profile details.',
          action: AUDIT_ACTION.UPDATED,
          old_values: this.serializeEmployee(employee),
          new_values: this.serializeEmployee(saved),
        },
      });

      return saved;
    });

    return this.serializeEmployee(updated);
  }

  async transfer(
    uuid: string,
    dto: TransferEmployeeDto,
    actor: CurrentUserType,
  ) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);

    this.ensureActorCanAccessEmployee(actor, employee);

    const workingLocationId = await this.resolveWorkingLocationId(
      dto.working_location_id,
    );

    const departmentId = await this.resolveDepartmentId(
      dto.department_id,
      workingLocationId,
    );

    const categoryId = dto.employment_category_id
      ? this.toBigInt(dto.employment_category_id, 'employment_category_id')
      : employee.employment_category_id;

    if (!categoryId) {
      throw new BadRequestException(
        'Employee must have an employment category before transfer.',
      );
    }

    await this.ensureOrganization(workingLocationId, departmentId);

    await this.ensureEmploymentCategory(categoryId);

    const request = await this.prisma.transfer_requests.create({
      data: {
        uuid: generateUUID(),
        subject_type: TRANSFER_SUBJECT.EMPLOYEE,
        employee_id: employee.id,
        old_working_location_id: employee.working_location_id,
        new_working_location_id: workingLocationId,
        old_department_id: employee.department_id,
        new_department_id: departmentId,
        reason: dto.reason,
        requested_by: BigInt(actor.userId),
        current_level: 'BRANCH_MANAGER',
      },
    });

    // Notify Branch Manager
    if (employee.working_location_id) {
      await this.notificationsService.notifyBranchManager(
        employee.working_location_id,
        {
          senderId: actor.userId,
          title: 'Employee Transfer Request',
          message: `A transfer request has been initiated for employee ${employee.first_name} ${employee.last_name}.`,
          type: 'TRANSFER_REQUEST',
          referenceId: request.uuid,
          metadata: { level: 'BRANCH_MANAGER' },
        },
      );
    } else {
      await this.notificationsService.notifyAdmins({
        senderId: actor.userId,
        title: 'Employee Transfer Request',
        message: `A transfer request has been initiated for employee ${employee.first_name} ${employee.last_name}.`,
        type: 'TRANSFER_REQUEST',
        referenceId: request.uuid,
        metadata: { level: 'ADMIN' },
      });
      await this.prisma.transfer_requests.update({
        where: { id: request.id },
        data: { current_level: 'ADMIN' },
      });
    }

    return this.serializeTransferRequest(request);
  }

  async approveTransfer(requestUuid: string, actor: CurrentUserType) {
    const request = await this.findTransferRequestOrThrow(requestUuid);

    if (!request.employee_id) {
      throw new BadRequestException('Transfer request has no employee.');
    }

    const isAdmin = this.isSystemAdmin(actor);
    const isBM = actor.roles.some((role) =>
      ['BRANCH_MANAGER', 'MANAGER', 'ON_MANAGER'].includes(role),
    );

    if (request.current_level === 'BRANCH_MANAGER') {
      if (!isBM && !isAdmin) {
        throw new ForbiddenException(
          'Only a Branch Manager can approve this at this level.',
        );
      }

      const updated = await this.prisma.transfer_requests.update({
        where: { id: request.id },
        data: {
          current_level: 'ADMIN',
          history: ((request.history as any[]) || []).concat([
            {
              level: 'BRANCH_MANAGER',
              action: 'APPROVED',
              by: actor.userId,
              at: new Date().toISOString(),
            },
          ]),
        },
      });

      await this.notificationsService.notifyAdmins({
        senderId: actor.userId,
        title: 'Employee Transfer Request Awaiting Admin Approval',
        message:
          'An employee transfer request has been approved by the Branch Manager and requires final admin approval.',
        type: 'TRANSFER_REQUEST',
        referenceId: request.uuid,
        metadata: { level: 'ADMIN' },
      });

      return this.serializeTransferRequest(updated);
    }

    if (request.current_level === 'ADMIN') {
      if (!isAdmin) {
        throw new ForbiddenException(
          'Only an Admin can finalize this transfer.',
        );
      }

      const employee = await this.prisma.employees.findUniqueOrThrow({
        where: { id: request.employee_id },
      });

      const updated = await this.prisma.$transaction(async (tx) => {
        const transferred = await tx.employees.update({
          where: { id: request.employee_id! },
          data: {
            working_location_id: request.new_working_location_id,
            department_id: request.new_department_id,
          },
          include: this.employeeIncludes(),
        });

        await tx.employee_history.create({
          data: {
            uuid: generateUUID(),
            employee_id: employee.id,
            action_type: ACTION_TYPE.TRANSFER,
            old_department_id: employee.department_id,
            new_department_id: request.new_department_id,
            old_location_id: employee.working_location_id,
            new_location_id: request.new_working_location_id,
            old_employment_category_id: employee.employment_category_id,
            new_employment_category_id: employee.employment_category_id,
            status: STATUS_ACTIVE_INACTIVE.ACTIVE,
            reason: request.reason,
            changed_by: BigInt(actor.userId),
            approved_by: BigInt(actor.userId),
          },
        });

        await tx.transfer_requests.update({
          where: { id: request.id },
          data: {
            status: APPROVAL_STATUS.APPROVED,
            approved_by: BigInt(actor.userId),
            approved_at: new Date(),
            current_level: 'FINALIZED',
            history: ((request.history as any[]) || []).concat([
              {
                level: 'ADMIN',
                action: 'APPROVED',
                by: actor.userId,
                at: new Date().toISOString(),
              },
            ]),
          },
        });

        return transferred;
      });

      // Notify the requestor
      await this.notificationsService.create({
        userId: request.requested_by,
        senderId: actor.userId,
        title: 'Employee Transfer Request Finalized',
        message: `Your transfer request for ${employee.first_name} ${employee.last_name} has been fully approved.`,
        type: 'TRANSFER_APPROVED',
        referenceId: request.uuid,
      });

      return this.serializeEmployee(updated);
    }

    throw new BadRequestException('Invalid transfer request level.');
  }

  async rejectTransfer(
    requestUuid: string,
    dto: RejectTransferDto,
    actor: CurrentUserType,
  ) {
    const request = await this.findTransferRequestOrThrow(requestUuid);

    const rejected = await this.prisma.transfer_requests.update({
      where: {
        id: request.id,
      },
      data: {
        status: APPROVAL_STATUS.REJECTED,
        rejection_reason: dto.rejection_reason,
        approved_by: BigInt(actor.userId),
        approved_at: new Date(),
        current_level: 'REJECTED',
        history: ((request.history as any[]) || []).concat([
          {
            level: request.current_level,
            action: 'REJECTED',
            by: actor.userId,
            at: new Date().toISOString(),
            reason: dto.rejection_reason,
          },
        ]),
      },
    });

    // Notify the requestor
    await this.notificationsService.create({
      userId: request.requested_by,
      senderId: actor.userId,
      title: 'Employee Transfer Request Rejected',
      message: `Your transfer request was rejected. Reason: ${dto.rejection_reason}`,
      type: 'TRANSFER_REJECTED',
      referenceId: request.uuid,
    });

    return this.serializeTransferRequest(rejected);
  }

  async suspend(uuid: string, dto: SuspendEmployeeDto, actor: CurrentUserType) {
    return this.changeStatus(
      uuid,
      STATUS_USER.SUSPENDED,
      ACTION_TYPE.SUSPENDED,
      dto.reason,
      actor,
    );
  }

  async reactivate(uuid: string, actor: CurrentUserType) {
    return this.changeStatus(
      uuid,
      STATUS_USER.ACTIVE,
      ACTION_TYPE.UPDATE,
      'Employee reactivated.',
      actor,
    );
  }

  private async changeStatus(
    uuid: string,
    status: STATUS_USER,
    actionType: ACTION_TYPE,
    reason: string | undefined,
    actor: CurrentUserType,
  ) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);

    if (
      !employee.working_location_id ||
      !employee.department_id ||
      !employee.employment_category_id
    ) {
      throw new BadRequestException(
        'Employee must be approved before status changes.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employees.update({
        where: {
          id: employee.id,
        },
        data: {
          status,
        },
        include: this.employeeIncludes(),
      });

      await tx.employee_history.create({
        data: {
          uuid: generateUUID(),
          employee_id: employee.id,
          action_type: actionType,
          old_department_id: employee.department_id,
          new_department_id: employee.department_id,
          old_location_id: employee.working_location_id,
          new_location_id: employee.working_location_id,
          old_employment_category_id: employee.employment_category_id,
          new_employment_category_id: employee.employment_category_id,
          status:
            status === STATUS_USER.ACTIVE
              ? STATUS_ACTIVE_INACTIVE.ACTIVE
              : STATUS_ACTIVE_INACTIVE.INACTIVE,
          reason,
          changed_by: BigInt(actor.userId),
          approved_by: BigInt(actor.userId),
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: employee.id,
          entity_table: 'employees',
          entity_id: employee.id,
          module_name: 'EMPLOYEES',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: `Employee status changed to ${status}.`,
          action: AUDIT_ACTION.UPDATED,
          old_values: {
            status: employee.status,
          },
          new_values: {
            status,
            reason,
          },
          changed_fields: ['status'],
        },
      });

      return changed;
    });

    return this.serializeEmployee(updated);
  }

  private async resolveWorkingLocationId(value: string) {
    requireUuidOrNumeric(value, 'working_location_id');

    const workingLocation = await this.prisma.working_locations.findFirst({
      where: isNumericId(value)
        ? {
            id: BigInt(value),
            deleted_at: null,
          }
        : {
            uuid: value,
            deleted_at: null,
          },
      select: {
        id: true,
      },
    });

    if (!workingLocation) {
      throw new BadRequestException('Working location does not exist.');
    }

    return workingLocation.id;
  }

  private async resolveDepartmentId(
    value: string,
    workingLocationId?: bigint | null,
  ) {
    requireUuidOrNumeric(value, 'department_id');

    const department = await this.prisma.departments.findFirst({
      where: {
        ...(isNumericId(value) ? { id: BigInt(value) } : { uuid: value }),
        ...(workingLocationId
          ? {
              working_location_id: workingLocationId,
            }
          : {}),
        status: STATUS_ACTIVE_INACTIVE.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!department) {
      throw new BadRequestException(
        'Department does not exist for the selected working location.',
      );
    }

    return department.id;
  }

  private async findEmployeeByUuidOrThrow(uuid: string) {
    const employee = await this.prisma.employees.findUnique({
      where: { uuid },
    });

    if (!employee || employee.deleted_at) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  private async findTransferRequestOrThrow(uuid: string) {
    const request = await this.prisma.transfer_requests.findFirst({
      where: {
        uuid,
        subject_type: TRANSFER_SUBJECT.EMPLOYEE,
        status: APPROVAL_STATUS.PENDING,
      },
    });

    if (!request) {
      throw new NotFoundException(
        'Pending employee transfer request not found.',
      );
    }

    return request;
  }

  private async ensureOrganization(
    workingLocationId: bigint,
    departmentId: bigint,
  ) {
    const department = await this.prisma.departments.findFirst({
      where: {
        id: departmentId,
        working_location_id: workingLocationId,
        status: STATUS_ACTIVE_INACTIVE.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!department) {
      throw new BadRequestException(
        'Department does not exist for the selected working location.',
      );
    }
  }

  private async ensureEmploymentCategory(categoryId: bigint) {
    const category = await this.prisma.employment_categories.findFirst({
      where: {
        id: categoryId,
        status: STATUS_ACTIVE_INACTIVE.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new BadRequestException(
        'Employment category does not exist or is inactive.',
      );
    }
  }

  private employeeIncludes() {
    return {
      createdBy: true,
      department: true,
      working_location: true,
      employment_category: true,
      // Include the most recent active payment structure
      payment_structures: {
        orderBy: { effective_from: 'desc' as const },
        take: 1,
      },
    };
  }

  private serializeEmployee(employee: Record<string, any>) {
    return {
      ...employee,
      id: employee.id.toString(),
      created_by: employee.created_by?.toString() ?? null,
      department_id: employee.department_id?.toString() ?? null,
      working_location_id: employee.working_location_id?.toString() ?? null,
      employment_category_id:
        employee.employment_category_id?.toString() ?? null,
    };
  }

  private serializeTransferRequest(request: Record<string, any>) {
    return {
      ...request,
      id: request.id.toString(),
      user_id: request.user_id?.toString() ?? null,
      employee_id: request.employee_id?.toString() ?? null,
      old_working_location_id:
        request.old_working_location_id?.toString() ?? null,
      new_working_location_id: request.new_working_location_id.toString(),
      old_department_id: request.old_department_id?.toString() ?? null,
      new_department_id: request.new_department_id?.toString() ?? null,
      requested_by: request.requested_by.toString(),
      approved_by: request.approved_by?.toString() ?? null,
    };
  }

  private isSystemAdmin(actor?: CurrentUserType) {
    return !!actor?.roles?.some((role) =>
      ['SUPER_ADMIN', 'ADMIN'].includes(role),
    );
  }

  private employeeScopeWhere(actor: CurrentUserType) {
    if (this.isSystemAdmin(actor)) {
      return {};
    }

    const where: Record<string, any> = {};

    if (actor.working_location_id) {
      where.working_location_id = BigInt(actor.working_location_id);
    }

    const isAttendanceActor =
      actor.permissions.includes('attendance.create') ||
      actor.permissions.includes('attendance.read') ||
      actor.permissions.includes('attendance.update') ||
      actor.permissions.includes('attendance.approve');

    if (isAttendanceActor && actor.department_id) {
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
    if (this.isSystemAdmin(actor)) {
      return;
    }

    if (
      actor.working_location_id &&
      employee.working_location_id?.toString() !== actor.working_location_id
    ) {
      throw new ForbiddenException(
        'You can only access employees in your working location.',
      );
    }

    const isAttendanceActor =
      actor.permissions.includes('attendance.create') ||
      actor.permissions.includes('attendance.read') ||
      actor.permissions.includes('attendance.update') ||
      actor.permissions.includes('attendance.approve');

    if (
      isAttendanceActor &&
      actor.department_id &&
      employee.department_id?.toString() !== actor.department_id
    ) {
      throw new ForbiddenException(
        'Attendance users can only access employees in their department.',
      );
    }
  }

  private ensureActorCanUseScope(
    actor: CurrentUserType | undefined,
    workingLocationId: bigint | null,
    departmentId: bigint | null,
    action: string,
  ) {
    if (!actor || this.isSystemAdmin(actor)) {
      return;
    }

    if (
      actor.working_location_id &&
      workingLocationId?.toString() !== actor.working_location_id
    ) {
      throw new ForbiddenException(
        `You can only ${action} in your working location.`,
      );
    }

    const isAttendanceActor =
      actor.permissions.includes('attendance.create') ||
      actor.permissions.includes('attendance.update');

    if (
      isAttendanceActor &&
      actor.department_id &&
      departmentId?.toString() !== actor.department_id
    ) {
      throw new ForbiddenException(
        `You can only ${action} in your department.`,
      );
    }
  }

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(
        `Please choose a valid ${fieldName.replace('_', ' ')}.`,
      );
    }

    return BigInt(value);
  }
}
