import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { hashPassword } from '../auth/utils/password.util';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { AssignUserAccountDto } from './dto/assign-user-account.dto';
import { ApproveEmployeeDto } from './dto/approve-employee.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { SuspendEmployeeDto } from './dto/suspend-employee.dto';
import { TransferEmployeeDto } from './dto/transfer-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeDto, actor?: CurrentUserType) {
    const workingLocationId = dto.working_location_id
      ? this.toBigInt(dto.working_location_id, 'working_location_id')
      : null;
    const departmentId = dto.department_id
      ? this.toBigInt(dto.department_id, 'department_id')
      : null;
    const categoryId = dto.employment_category_id
      ? this.toBigInt(dto.employment_category_id, 'employment_category_id')
      : null;
    const userId = dto.user_id ? this.toBigInt(dto.user_id, 'user_id') : null;

    if (workingLocationId && departmentId) {
      await this.ensureOrganization(workingLocationId, departmentId);
    }
    if (categoryId) await this.ensureEmploymentCategory(categoryId);
    if (userId) await this.ensureUserCanBeLinked(userId);
    if (dto.password && userId) {
      throw new BadRequestException('Use either user_id or password, not both.');
    }
    if (dto.password && (!dto.email || !dto.phone_number)) {
      throw new BadRequestException(
        'Email and phone number are required when creating an employee login.',
      );
    }
    if (dto.password) {
      const existingUser = await this.prisma.users.findFirst({
        where: {
          OR: [{ email: dto.email }, { phone_number: dto.phone_number }],
          deleted_at: null,
        },
        select: { id: true },
      });

      if (existingUser) {
        throw new ConflictException('A user with this email or phone already exists.');
      }
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      const linkedUser = dto.password
        ? await tx.users.create({
            data: {
              uuid: generateUUID(),
              first_name: dto.first_name,
              last_name: dto.last_name,
              email: dto.email!,
              phone_number: dto.phone_number!,
              gender: dto.gender,
              password_hash: await hashPassword(dto.password),
              department_id: departmentId,
              working_location_id: workingLocationId,
              status: STATUS_USER.INACTIVE,
            },
          })
        : null;

      const created = await tx.employees.create({
        data: {
          uuid: generateUUID(),
          user_id: linkedUser?.id ?? userId,
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
          status:
            workingLocationId && departmentId && categoryId && dto.hire_date
              ? STATUS_USER.ACTIVE
              : STATUS_USER.INACTIVE,
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

    return this.serializeEmployee(employee);
  }

  async approve(uuid: string, dto: ApproveEmployeeDto, actor: CurrentUserType) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);
    if (!employee.working_location_id || !employee.department_id || !employee.employment_category_id) {
      throw new BadRequestException('Employee must be approved before transfer.');
    }
    const workingLocationId = this.toBigInt(dto.working_location_id, 'working_location_id');
    const departmentId = this.toBigInt(dto.department_id, 'department_id');
    const categoryId = this.toBigInt(dto.employment_category_id, 'employment_category_id');

    await this.ensureOrganization(workingLocationId, departmentId);
    await this.ensureEmploymentCategory(categoryId);

    const approved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.employees.update({
        where: { id: employee.id },
        data: {
          working_location_id: workingLocationId,
          department_id: departmentId,
          employment_category_id: categoryId,
          hire_date: new Date(dto.hire_date),
          status: STATUS_USER.ACTIVE,
        },
        include: this.employeeIncludes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: employee.id,
          entity_table: 'employees',
          entity_id: employee.id,
          module_name: 'EMPLOYEES',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Approved employee registration.',
          action: AUDIT_ACTION.APPROVED,
          old_values: { status: employee.status },
          new_values: {
            status: STATUS_USER.ACTIVE,
            working_location_id: workingLocationId.toString(),
            department_id: departmentId.toString(),
            employment_category_id: categoryId.toString(),
          },
          changed_fields: [
            'status',
            'working_location_id',
            'department_id',
            'employment_category_id',
            'hire_date',
          ],
        },
      });

      return updated;
    });

    return this.serializeEmployee(approved);
  }

  async findAll() {
    const employees = await this.prisma.employees.findMany({
      where: { deleted_at: null },
      include: this.employeeIncludes(),
      orderBy: { created_at: 'desc' },
    });

    return employees.map((employee) => this.serializeEmployee(employee));
  }

  async findOne(uuid: string) {
    const employee = await this.prisma.employees.findUnique({
      where: { uuid },
      include: {
        ...this.employeeIncludes(),
        employee_history: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!employee || employee.deleted_at) {
      throw new NotFoundException('Employee not found.');
    }

    return this.serializeEmployee(employee);
  }

  async assignUserAccount(
    uuid: string,
    dto: AssignUserAccountDto,
    actor: CurrentUserType,
  ) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);
    const userId = this.toBigInt(dto.user_id, 'user_id');

    await this.ensureUserCanBeLinked(userId, employee.id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const employeeWithUser = await tx.employees.update({
        where: { id: employee.id },
        data: { user_id: userId },
        include: this.employeeIncludes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: employee.id,
          entity_table: 'employees',
          entity_id: employee.id,
          module_name: 'EMPLOYEES',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Linked employee to user account.',
          action: AUDIT_ACTION.UPDATED,
          old_values: { user_id: employee.user_id?.toString() ?? null },
          new_values: { user_id: userId.toString() },
          changed_fields: ['user_id'],
        },
      });

      return employeeWithUser;
    });

    return this.serializeEmployee(updated);
  }

  async transfer(uuid: string, dto: TransferEmployeeDto, actor: CurrentUserType) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);
    const workingLocationId = this.toBigInt(dto.working_location_id, 'working_location_id');
    const departmentId = this.toBigInt(dto.department_id, 'department_id');
    const categoryId = dto.employment_category_id
      ? this.toBigInt(dto.employment_category_id, 'employment_category_id')
      : employee.employment_category_id;

    if (!categoryId) {
      throw new BadRequestException('Employee must have an employment category before transfer.');
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
      },
    });

    return this.serializeTransferRequest(request);
  }

  async approveTransfer(requestUuid: string, actor: CurrentUserType) {
    const request = await this.findTransferRequestOrThrow(requestUuid);
    if (!request.employee_id) throw new BadRequestException('Transfer request has no employee.');

    const employee = await this.prisma.employees.findUniqueOrThrow({
      where: { id: request.employee_id },
    });

    const categoryId = employee.employment_category_id;
    if (!categoryId) {
      throw new BadRequestException('Employee has no employment category.');
    }

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
          new_employment_category_id: categoryId,
          status: STATUS_ACTIVE_INACTIVE.ACTIVE,
          reason: request.reason,
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
          activity_description: 'Transferred employee.',
          action: AUDIT_ACTION.APPROVED,
          old_values: {
            working_location_id: employee.working_location_id?.toString() ?? null,
            department_id: employee.department_id?.toString() ?? null,
            employment_category_id: employee.employment_category_id?.toString() ?? null,
          },
          new_values: {
            working_location_id: request.new_working_location_id.toString(),
            department_id: request.new_department_id?.toString() ?? null,
            employment_category_id: categoryId.toString(),
          },
          changed_fields: ['working_location_id', 'department_id', 'employment_category_id'],
        },
      });

      await tx.transfer_requests.update({
        where: { id: request.id },
        data: {
          status: APPROVAL_STATUS.APPROVED,
          approved_by: BigInt(actor.userId),
          approved_at: new Date(),
        },
      });

      return transferred;
    });

    return this.serializeEmployee(updated);
  }

  async rejectTransfer(
    requestUuid: string,
    dto: RejectTransferDto,
    actor: CurrentUserType,
  ) {
    const request = await this.findTransferRequestOrThrow(requestUuid);

    const rejected = await this.prisma.transfer_requests.update({
      where: { id: request.id },
      data: {
        status: APPROVAL_STATUS.REJECTED,
        rejection_reason: dto.rejection_reason,
        approved_by: BigInt(actor.userId),
        approved_at: new Date(),
      },
    });

    return this.serializeTransferRequest(rejected);
  }

  async suspend(uuid: string, dto: SuspendEmployeeDto, actor: CurrentUserType) {
    return this.changeStatus(uuid, STATUS_USER.SUSPENDED, ACTION_TYPE.SUSPENDED, dto.reason, actor);
  }

  async reactivate(uuid: string, actor: CurrentUserType) {
    return this.changeStatus(uuid, STATUS_USER.ACTIVE, ACTION_TYPE.UPDATE, 'Employee reactivated.', actor);
  }

  private async changeStatus(
    uuid: string,
    status: STATUS_USER,
    actionType: ACTION_TYPE,
    reason: string | undefined,
    actor: CurrentUserType,
  ) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);
    if (!employee.working_location_id || !employee.department_id || !employee.employment_category_id) {
      throw new BadRequestException('Employee must be approved before status changes.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employees.update({
        where: { id: employee.id },
        data: { status },
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
          old_values: { status: employee.status },
          new_values: { status, reason },
          changed_fields: ['status'],
        },
      });

      return changed;
    });

    return this.serializeEmployee(updated);
  }

  private async findEmployeeByUuidOrThrow(uuid: string) {
    const employee = await this.prisma.employees.findUnique({ where: { uuid } });

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

    if (!request) throw new NotFoundException('Pending employee transfer request not found.');

    return request;
  }

  private async ensureOrganization(workingLocationId: bigint, departmentId: bigint) {
    const department = await this.prisma.departments.findFirst({
      where: {
        id: departmentId,
        working_location_id: workingLocationId,
        status: STATUS_ACTIVE_INACTIVE.ACTIVE,
      },
      select: { id: true },
    });

    if (!department) {
      throw new BadRequestException(
        'Department does not exist for the selected working location.',
      );
    }
  }

  private async ensureEmploymentCategory(categoryId: bigint) {
    const category = await this.prisma.employment_categories.findFirst({
      where: { id: categoryId, status: STATUS_ACTIVE_INACTIVE.ACTIVE },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('Employment category does not exist or is inactive.');
    }
  }

  private async ensureUserCanBeLinked(userId: bigint, currentEmployeeId?: bigint) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
      select: { id: true },
    });

    if (!user) throw new BadRequestException('User account does not exist.');

    const linkedEmployee = await this.prisma.employees.findFirst({
      where: {
        user_id: userId,
        deleted_at: null,
        NOT: currentEmployeeId ? { id: currentEmployeeId } : undefined,
      },
      select: { id: true },
    });

    if (linkedEmployee) {
      throw new ConflictException('User account is already linked to another employee.');
    }
  }

  private employeeIncludes() {
    return {
      user: true,
      department: true,
      working_location: true,
      employment_category: true,
    };
  }

  private serializeEmployee(employee: Record<string, any>) {
    return {
      ...employee,
      id: employee.id.toString(),
      user_id: employee.user_id?.toString() ?? null,
      department_id: employee.department_id?.toString() ?? null,
      working_location_id: employee.working_location_id?.toString() ?? null,
      employment_category_id: employee.employment_category_id?.toString() ?? null,
      user: employee.user
        ? {
            ...employee.user,
            id: employee.user.id.toString(),
            department_id: employee.user.department_id?.toString() ?? null,
            working_location_id: employee.user.working_location_id?.toString() ?? null,
          }
        : null,
      department: employee.department
        ? {
            ...employee.department,
            id: employee.department.id.toString(),
            working_location_id: employee.department.working_location_id.toString(),
          }
        : undefined,
      working_location: employee.working_location
        ? {
            ...employee.working_location,
            id: employee.working_location.id.toString(),
            created_by: employee.working_location.created_by?.toString() ?? null,
            updated_by: employee.working_location.updated_by?.toString() ?? null,
            deleted_by: employee.working_location.deleted_by?.toString() ?? null,
          }
        : undefined,
      employment_category: employee.employment_category
        ? {
            ...employee.employment_category,
            id: employee.employment_category.id.toString(),
          }
        : undefined,
      employee_history: employee.employee_history?.map((history) => ({
        ...history,
        id: history.id.toString(),
        employee_id: history.employee_id.toString(),
        old_department_id: history.old_department_id?.toString() ?? null,
        new_department_id: history.new_department_id?.toString() ?? null,
        old_location_id: history.old_location_id?.toString() ?? null,
        new_location_id: history.new_location_id?.toString() ?? null,
        old_employment_category_id:
          history.old_employment_category_id?.toString() ?? null,
        new_employment_category_id:
          history.new_employment_category_id?.toString() ?? null,
        changed_by: history.changed_by.toString(),
        approved_by: history.approved_by.toString(),
      })),
    };
  }

  private serializeTransferRequest(request: Record<string, any>) {
    return {
      ...request,
      id: request.id.toString(),
      user_id: request.user_id?.toString() ?? null,
      employee_id: request.employee_id?.toString() ?? null,
      old_working_location_id: request.old_working_location_id?.toString() ?? null,
      new_working_location_id: request.new_working_location_id.toString(),
      old_department_id: request.old_department_id?.toString() ?? null,
      new_department_id: request.new_department_id?.toString() ?? null,
      requested_by: request.requested_by.toString(),
      approved_by: request.approved_by?.toString() ?? null,
    };
  }

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(`${fieldName} must be a numeric id.`);
    }

    return BigInt(value);
  }
}
