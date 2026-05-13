import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTIVITY_TYPE,
  AUDIT_ACTION,
  APPROVAL_STATUS,
  STATUS_USER,
  TRANSFER_SUBJECT,
} from '@prisma/client';

import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from 'src/auth/dto/register.dto';
import { hashPassword } from 'src/auth/utils/password.util';
import { generateUUID } from 'src/common/utils/uuid.util';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import { RequestTransferDto } from '../common/dto/request-transfer.dto';
import { ApproveUserDto } from './dto/approve-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(data: RegisterDto) {
    const existingUser = await this.prisma.users.findFirst({
      where: {
        OR: [{ email: data.email }, { phone_number: data.phone_number }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const user = await this.prisma.users.create({
      data: {
        uuid: generateUUID(),
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number,
        password_hash: await hashPassword(data.password),
        gender: data.gender,
        department_id: data.department_id ? BigInt(data.department_id) : null,
        working_location_id: data.working_location_id
          ? BigInt(data.working_location_id)
          : null,
        status: STATUS_USER.INACTIVE,
      },
    });

    return {
      message: 'User created. Approval pending.',
      user: this.serializeUser(user),
    };
  }

  async findAll() {
    const users = await this.prisma.users.findMany({
      where: { deleted_at: null },
      include: this.userIncludes(),
      orderBy: { created_at: 'desc' },
    });

    return users.map((user) => this.serializeUser(user));
  }

  async findPendingApproval() {
    const users = await this.prisma.users.findMany({
      where: {
        status: STATUS_USER.INACTIVE,
        deleted_at: null,
      },
      include: this.userIncludes(),
      orderBy: { created_at: 'desc' },
    });

    return users.map((user) => this.serializeUser(user));
  }

  async approveUser(
    uuid: string,
    dto: ApproveUserDto,
    actor: CurrentUserType,
  ) {
    const user = await this.findUserByUuidOrThrow(uuid);
    const workingLocationId = this.toBigInt(dto.working_location_id, 'working_location_id');
    const departmentId = this.toBigInt(dto.department_id, 'department_id');
    const roleIds = dto.role_ids?.map((roleId) => this.toBigInt(roleId, 'role_id')) ?? [];

    await this.ensureWorkingLocationExists(workingLocationId);
    await this.ensureDepartmentExists(departmentId, workingLocationId);
    await this.ensureRolesExist(roleIds);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: user.id },
        data: {
          working_location_id: workingLocationId,
          department_id: departmentId,
          status: STATUS_USER.ACTIVE,
        },
      });

      if (roleIds.length) {
        await tx.user_roles.deleteMany({ where: { user_id: user.id } });
        await tx.user_roles.createMany({
          data: roleIds.map((roleId) => ({
            user_id: user.id,
            role_id: roleId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'users',
          entity_id: user.id,
          module_name: 'USER_MANAGEMENT',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'User account approved and activated.',
          action: AUDIT_ACTION.APPROVED,
          old_values: { status: user.status },
          new_values: {
            status: STATUS_USER.ACTIVE,
            working_location_id: workingLocationId.toString(),
            department_id: departmentId.toString(),
            role_ids: roleIds.map((roleId) => roleId.toString()),
          },
          changed_fields: ['status', 'working_location_id', 'department_id', 'roles'],
        },
      });

      return tx.users.findUniqueOrThrow({
        where: { id: user.id },
        include: this.userIncludes(),
      });
    });

    return {
      message: 'User approved and activated.',
      user: this.serializeUser(updatedUser),
    };
  }

  async rejectUser(uuid: string, reason: string, actor: CurrentUserType) {
    const user = await this.findUserByUuidOrThrow(uuid);

    await this.prisma.audit_logs.create({
      data: {
        user_id: BigInt(actor.userId),
        entity_table: 'users',
        entity_id: user.id,
        module_name: 'USER_MANAGEMENT',
        activity_type: ACTIVITY_TYPE.UPDATE,
        activity_description: `User account approval rejected: ${reason}`,
        action: AUDIT_ACTION.DENIED,
        old_values: { status: user.status },
        new_values: { status: STATUS_USER.INACTIVE, rejection_reason: reason },
        changed_fields: ['status'],
      },
    });

    return { message: 'User approval rejected.' };
  }

  async suspendUser(uuid: string, actor: CurrentUserType) {
    const user = await this.findUserByUuidOrThrow(uuid);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.user_sessions.updateMany({
        where: { user_id: user.id, is_revoked: false },
        data: { is_revoked: true },
      });

      const suspended = await tx.users.update({
        where: { id: user.id },
        data: { status: STATUS_USER.SUSPENDED },
        include: this.userIncludes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'users',
          entity_id: user.id,
          module_name: 'USER_MANAGEMENT',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'User account suspended.',
          action: AUDIT_ACTION.UPDATED,
          old_values: { status: user.status },
          new_values: { status: STATUS_USER.SUSPENDED },
          changed_fields: ['status'],
        },
      });

      return suspended;
    });

    return {
      message: 'User suspended and active sessions revoked.',
      user: this.serializeUser(updatedUser),
    };
  }

  async assignRoles(
    uuid: string,
    roleIdsInput: string[],
    actor: CurrentUserType,
  ) {
    const user = await this.findUserByUuidOrThrow(uuid);
    const roleIds = roleIdsInput.map((roleId) => this.toBigInt(roleId, 'role_id'));

    await this.ensureRolesExist(roleIds);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.user_roles.deleteMany({ where: { user_id: user.id } });
      await tx.user_roles.createMany({
        data: roleIds.map((roleId) => ({
          user_id: user.id,
          role_id: roleId,
        })),
        skipDuplicates: true,
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'users',
          entity_id: user.id,
          module_name: 'USER_MANAGEMENT',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'User roles assigned.',
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            role_ids: roleIds.map((roleId) => roleId.toString()),
          },
          changed_fields: ['roles'],
        },
      });

      return tx.users.findUniqueOrThrow({
        where: { id: user.id },
        include: this.userIncludes(),
      });
    });

    return {
      message: 'User roles updated.',
      user: this.serializeUser(updatedUser),
    };
  }

  async requestTransfer(
    uuid: string,
    dto: RequestTransferDto,
    actor: CurrentUserType,
  ) {
    const user = await this.findUserByUuidOrThrow(uuid);
    const newLocationId = this.toBigInt(dto.working_location_id, 'working_location_id');
    const newDepartmentId = dto.department_id
      ? this.toBigInt(dto.department_id, 'department_id')
      : null;

    await this.ensureWorkingLocationExists(newLocationId);
    if (newDepartmentId) await this.ensureDepartmentExists(newDepartmentId, newLocationId);

    const request = await this.prisma.transfer_requests.create({
      data: {
        uuid: generateUUID(),
        subject_type: TRANSFER_SUBJECT.USER,
        user_id: user.id,
        old_working_location_id: user.working_location_id,
        new_working_location_id: newLocationId,
        old_department_id: user.department_id,
        new_department_id: newDepartmentId,
        reason: dto.reason,
        requested_by: BigInt(actor.userId),
      },
    });

    return this.serializeTransferRequest(request);
  }

  async approveTransfer(requestUuid: string, actor: CurrentUserType) {
    const request = await this.findTransferRequestOrThrow(requestUuid, TRANSFER_SUBJECT.USER);
    if (!request.user_id) throw new BadRequestException('Transfer request has no user.');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: request.user_id! },
        data: {
          working_location_id: request.new_working_location_id,
          department_id: request.new_department_id,
        },
      });

      const approved = await tx.transfer_requests.update({
        where: { id: request.id },
        data: {
          status: APPROVAL_STATUS.APPROVED,
          approved_by: BigInt(actor.userId),
          approved_at: new Date(),
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'transfer_requests',
          entity_id: request.id,
          module_name: 'USER_MANAGEMENT',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Approved user branch/department transfer.',
          action: AUDIT_ACTION.APPROVED,
          new_values: {
            new_working_location_id: request.new_working_location_id.toString(),
            new_department_id: request.new_department_id?.toString() ?? null,
          },
        },
      });

      return approved;
    });

    return this.serializeTransferRequest(updated);
  }

  async rejectTransfer(
    requestUuid: string,
    dto: RejectTransferDto,
    actor: CurrentUserType,
  ) {
    const request = await this.findTransferRequestOrThrow(requestUuid, TRANSFER_SUBJECT.USER);

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

  async findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  private async findUserByUuidOrThrow(uuid: string) {
    const user = await this.prisma.users.findUnique({
      where: { uuid },
    });

    if (!user || user.deleted_at) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  private async ensureWorkingLocationExists(id: bigint) {
    const workingLocation = await this.prisma.working_locations.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!workingLocation) {
      throw new BadRequestException('Working location does not exist.');
    }
  }

  private async ensureDepartmentExists(id: bigint, workingLocationId: bigint) {
    const department = await this.prisma.departments.findFirst({
      where: {
        id,
        working_location_id: workingLocationId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!department) {
      throw new BadRequestException(
        'Department does not exist for the selected working location.',
      );
    }
  }

  private async ensureRolesExist(roleIds: bigint[]) {
    if (!roleIds.length) {
      throw new BadRequestException('At least one role is required for activation.');
    }

    const roles = await this.prisma.roles.findMany({
      where: { id: { in: roleIds } },
      select: { id: true },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist.');
    }
  }

  private async findTransferRequestOrThrow(
    uuid: string,
    subjectType: TRANSFER_SUBJECT,
  ) {
    const request = await this.prisma.transfer_requests.findFirst({
      where: { uuid, subject_type: subjectType, status: APPROVAL_STATUS.PENDING },
    });

    if (!request) throw new NotFoundException('Pending transfer request not found.');

    return request;
  }

  private userIncludes() {
    return {
      working_location: true,
      department: true,
      roles: {
        include: {
          role: true,
        },
      },
    };
  }

  private serializeUser(user: Record<string, any>) {
    return {
      ...user,
      id: user.id?.toString(),
      working_location_id: user.working_location_id?.toString() ?? null,
      department_id: user.department_id?.toString() ?? null,
      roles: user.roles?.map((userRole) => ({
        id: userRole.id.toString(),
        role_id: userRole.role_id.toString(),
        name: userRole.role?.name,
      })),
      working_location: user.working_location
        ? {
            ...user.working_location,
            id: user.working_location.id.toString(),
            created_by: user.working_location.created_by?.toString() ?? null,
            updated_by: user.working_location.updated_by?.toString() ?? null,
            deleted_by: user.working_location.deleted_by?.toString() ?? null,
          }
        : null,
      department: user.department
        ? {
            ...user.department,
            id: user.department.id.toString(),
            working_location_id: user.department.working_location_id.toString(),
          }
        : undefined,
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
