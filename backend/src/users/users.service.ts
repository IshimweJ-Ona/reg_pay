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
  ACTIVITY_TYPE,
  AUDIT_ACTION,
  APPROVAL_STATUS,
  STATUS_USER,
  TRANSFER_SUBJECT,
} from '@prisma/client';

// Standard relative imports to ensure consistency across the project
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { hashPassword } from '../auth/utils/password.util';
import {
  isNumericId,
  normalizeSearch,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';

import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import { RequestTransferDto } from '../common/dto/request-transfer.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { UpdateUserPermissionOverrideDto } from './dto/update-user-permission-override.dto';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  async createUser(data: RegisterDto, actor?: CurrentUserType) {
    const existingUser = await this.prisma.users.findFirst({
      where: {
        OR: [{ email: data.email }, { phone_number: data.phone_number }],
      },
    });

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    const workingLocationId = data.working_location_id
      ? await this.resolveWorkingLocationId(data.working_location_id)
      : null;

    const departmentId = data.department_id
      ? await this.resolveDepartmentId(data.department_id, workingLocationId)
      : null;

    const roleIds = data.role_ids?.length
      ? await this.resolveRoleIds(data.role_ids)
      : [];

    const permissionIds = data.permission_ids?.length
      ? await this.resolvePermissionIds(data.permission_ids)
      : [];

    if (workingLocationId) {
      await this.ensureWorkingLocationExists(workingLocationId);
    }

    if (departmentId) {
      if (!workingLocationId) {
        throw new BadRequestException(
          'working_location_id is required with department_id.',
        );
      }

      await this.ensureDepartmentExists(departmentId, workingLocationId);
    }

    if (actor) {
      this.ensureActorCanManageUser(actor, workingLocationId);
    }

    if (roleIds.length) {
      await this.ensureRolesExist(roleIds, false);
    }

    if (permissionIds.length) {
      await this.ensurePermissionsExist(permissionIds);
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.users.create({
        data: {
          uuid: generateUUID(),
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone_number: data.phone_number,
          password_hash: await hashPassword(data.password),
          gender: data.gender,
          department_id: departmentId,
          working_location_id: workingLocationId,

          // user pending by default
          status: STATUS_USER.INACTIVE,
        },
      });

      if (roleIds.length) {
        await tx.user_roles.createMany({
          data: roleIds.map((roleId) => ({
            user_id: created.id,
            role_id: roleId,
          })),
          skipDuplicates: true,
        });
      }

      if (permissionIds.length) {
        await tx.user_permissions.createMany({
          data: permissionIds.map((permissionId) => ({
            user_id: created.id,
            permission_id: permissionId,
            granted_by: actor ? BigInt(actor.userId) : null,
          })),
          skipDuplicates: true,
        });
      }

      if (actor) {
        await tx.audit_logs.create({
          data: {
            user_id: BigInt(actor.userId),
            entity_table: 'users',
            entity_id: created.id,
            module_name: 'USER_MANAGEMENT',
            activity_type: ACTIVITY_TYPE.CREATE,
            activity_description: 'Created pending user account.',
            action: AUDIT_ACTION.CREATED,
            new_values: {
              status: STATUS_USER.INACTIVE,
              working_location_id: workingLocationId?.toString() ?? null,
              department_id: departmentId?.toString() ?? null,
              role_ids: roleIds.map((roleId) => roleId.toString()),
              permission_ids: permissionIds.map((permissionId) =>
                permissionId.toString(),
              ),
            },
          },
        });
      }

      return tx.users.findUniqueOrThrow({
        where: { id: created.id },
        include: this.userIncludes(),
      });
    });

    await this.cacheManager.del('users:all');
    await this.cacheManager.del('users:pending');

    return {
      message: 'Registration submitted successfully. Awaiting admin approval.',
      user: this.serializeUser(user),
    };
  }

  async findAll(
    actor: CurrentUserType,
    filters: { q?: string; status?: string } = {},
  ) {
    const q = normalizeSearch(filters.q);
    const cacheKey = `users:all:${actor.userId}:${filters.status ?? ''}:${q ?? ''}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const users = await this.prisma.users.findMany({
      where: {
        deleted_at: null,
        ...this.userScopeWhere(actor),

        ...(filters.status
          ? {
              status: filters.status as STATUS_USER,
            }
          : {}),

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
              ],
            }
          : {}),
      },
      distinct: ['uuid'],
      include: this.userIncludes(),

      orderBy: {
        created_at: 'desc',
      },
    });

    const result = {
      users: users.map((user) => this.serializeUser(user)),
    };
    await this.cacheManager.set(cacheKey, result, 30000);
    return result;
  }

  async findPendingApproval(qInput?: string) {
    const q = normalizeSearch(qInput);
    const cacheKey = `users:pending:${q ?? ''}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const users = await this.prisma.users.findMany({
      where: {
        status: { in: [STATUS_USER.PENDING, STATUS_USER.INACTIVE] },
        deleted_at: null,

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
              ],
            }
          : {}),
      },
      distinct: ['uuid'],
      include: this.userIncludes(),

      orderBy: {
        created_at: 'desc',
      },
    });

    const result = {
      pending_users: users.map((user) => this.serializeUser(user)),
    };
    await this.cacheManager.set(cacheKey, result, 30000);
    return result;
  }

  async approveUser(uuid: string, dto: ApproveUserDto, actor: CurrentUserType) {
    const user = await this.findUserByUuidOrThrow(uuid);

    const workingLocationId = dto.working_location_id
      ? await this.resolveWorkingLocationId(dto.working_location_id)
      : (user.working_location_id ??
        (await this.getDefaultWorkingLocationId()));

    const roleIds = dto.role_ids?.length
      ? await this.resolveRoleIds(dto.role_ids)
      : [await this.getDefaultRoleId()];

    const permissionIds = dto.permission_ids?.length
      ? await this.resolvePermissionIds(dto.permission_ids)
      : [];

    await this.ensureRolesExist(roleIds);

    if (permissionIds.length) {
      await this.ensurePermissionsExist(permissionIds);
    }

    this.ensureActorCanManageUser(
      actor,
      user.working_location_id ?? workingLocationId,
    );

    const roles = await this.prisma.roles.findMany({
      where: { id: { in: roleIds } },
      select: { name: true },
    });

    const isManagerActor = actor.roles.some((r) =>
      ['MANAGER', 'BRANCH_MANAGER', 'ON_MANAGER'].includes(r),
    );
    const isSuperAdminActor = actor.roles.includes('SUPER_ADMIN');

    if (isManagerActor && !isSuperAdminActor) {
      const isAssigningHighLevelRole = roles.some((r) =>
        [
          'MANAGER',
          'BRANCH_MANAGER',
          'ON_MANAGER',
          'SUPER_ADMIN',
          'ADMIN',
        ].includes(r.name),
      );
      if (isAssigningHighLevelRole) {
        throw new BadRequestException(
          'Managers cannot assign Manager or Admin roles.',
        );
      }
    }

    const isBranchManagerRole = roles.some((r) =>
      ['BRANCH_MANAGER', 'MANAGER', 'ON_MANAGER'].includes(r.name),
    );

    const departmentId = isBranchManagerRole
      ? null
      : dto.department_id
        ? await this.resolveDepartmentId(dto.department_id, workingLocationId)
        : (user.department_id ??
          (await this.getDefaultDepartmentId(workingLocationId)));

    await this.ensureWorkingLocationExists(workingLocationId);
    if (departmentId) {
      await this.ensureDepartmentExists(departmentId, workingLocationId);
    }

    if (isBranchManagerRole) {
      await this.ensureOnlyOneBranchManager(workingLocationId, user.id);
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: user.id },
        data: {
          working_location_id: workingLocationId,
          department_id: departmentId,
          status: STATUS_USER.ACTIVE,
        },
      });

      await tx.user_roles.deleteMany({
        where: { user_id: user.id },
      });

      if (roleIds.length) {
        await tx.user_roles.createMany({
          data: roleIds.map((roleId) => ({
            user_id: user.id,
            role_id: roleId,
          })),
          skipDuplicates: true,
        });
      }

      // Purely role-based: remove any direct permissions during approval
      await tx.user_permissions.deleteMany({
        where: { user_id: user.id },
      });
      await tx.user_permission_overrides.deleteMany({
        where: { user_id: user.id },
      });

      if (permissionIds.length) {
        await tx.user_permissions.createMany({
          data: permissionIds.map((permissionId) => ({
            user_id: user.id,
            permission_id: permissionId,
            granted_by: BigInt(actor.userId),
          })),
          skipDuplicates: true,
        });
      }

      if (isBranchManagerRole) {
        const existingRecord = await tx.branch_managers.findFirst({
          where: {
            working_location_id: workingLocationId,
            user_id: user.id,
          },
        });

        if (existingRecord) {
          await tx.branch_managers.update({
            where: { id: existingRecord.id },
            data: {
              is_active: true,
              unassigned_at: null,
            },
          });
        } else {
          await tx.branch_managers.create({
            data: {
              uuid: generateUUID(),
              working_location_id: workingLocationId,
              user_id: user.id,
              assigned_by: BigInt(actor.userId),
              is_active: true,
            },
          });
        }
      }

      // Mark notifications as read
      await tx.notifications.updateMany({
        where: {
          reference_id: user.uuid,
          type: 'REGISTRATION_REQUEST',
          is_read: false,
        },
        data: { is_read: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'users',
          entity_id: user.id,
          module_name: 'USER_MANAGEMENT',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'User account approved and activated.',
          action: AUDIT_ACTION.APPROVED,
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

    await this.prisma.$transaction(async (tx) => {
      await tx.user_sessions.updateMany({
        where: {
          user_id: user.id,
          is_revoked: false,
        },
        data: {
          is_revoked: true,
        },
      });

      await tx.users.update({
        where: { id: user.id },
        data: {
          deleted_at: new Date(),
          status: STATUS_USER.REJECTED,
        },
      });

      // Mark notifications as read
      await tx.notifications.updateMany({
        where: {
          reference_id: user.uuid,
          type: 'REGISTRATION_REQUEST',
          is_read: false,
        },
        data: { is_read: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'users',
          entity_id: user.id,
          module_name: 'USER_MANAGEMENT',
          activity_type: ACTIVITY_TYPE.DELETE,
          activity_description: `User rejected: ${reason}`,
          action: AUDIT_ACTION.DENIED,
        },
      });
    });

    return {
      message: 'User rejected and removed.',
    };
  }

  private async ensureOnlyOneBranchManager(locationId: bigint, userId: bigint) {
    const existing = await this.prisma.branch_managers.findFirst({
      where: {
        working_location_id: locationId,
        is_active: true,
        user_id: { not: userId },
      },
      include: { user: true },
    });

    if (existing) {
      throw new BadRequestException(
        `This branch already has an active Branch Manager: ${existing.user.first_name} ${existing.user.last_name}. Only one is allowed.`,
      );
    }
  }

  async suspendUser(uuid: string, actor: CurrentUserType) {
    const user = await this.findUserByUuidOrThrow(uuid);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.user_sessions.updateMany({
        where: {
          user_id: user.id,
          is_revoked: false,
        },
        data: {
          is_revoked: true,
        },
      });

      const suspended = await tx.users.update({
        where: { id: user.id },
        data: {
          status: STATUS_USER.SUSPENDED,
        },
        include: this.userIncludes(),
      });

      return suspended;
    });

    return {
      message: 'User suspended successfully.',
      user: this.serializeUser(updatedUser),
    };
  }

  async reactivateUser(uuid: string, actor: CurrentUserType) {
    const user = await this.findUserByUuidOrThrow(uuid);

    const reactivated = await this.prisma.users.update({
      where: { id: user.id },
      data: {
        status: STATUS_USER.ACTIVE,
      },
      include: this.userIncludes(),
    });

    return {
      message: 'User account reactivated.',
      user: this.serializeUser(reactivated),
    };
  }

  async assignRoles(
    uuid: string,
    roleIdsInput: string[],
    actor: CurrentUserType,
  ) {
    const user = await this.findUserByUuidOrThrow(uuid);

    const roleIds = await this.resolveRoleIds(roleIdsInput);

    await this.ensureRolesExist(roleIds);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.user_roles.deleteMany({
        where: { user_id: user.id },
      });

      await tx.user_roles.createMany({
        data: roleIds.map((roleId) => ({
          user_id: user.id,
          role_id: roleId,
        })),
        skipDuplicates: true,
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

  async bulkUpdateAvatars(files: any[], mappings: Record<string, string>) {
    const results: any[] = [];
    for (const file of files) {
      const targetIdentifier = mappings[file.originalname];
      if (!targetIdentifier) continue;

      const user = await this.prisma.users.findFirst({
        where: {
          OR: [{ email: targetIdentifier }, { uuid: targetIdentifier }],
        },
      });

      if (user) {
        await this.prisma.users.update({
          where: { id: user.id },
          data: { avatar_url: `/uploads/profiles/${file.filename}` },
        });
        results.push({
          identifier: targetIdentifier,
          type: 'USER',
          success: true,
        });
        continue;
      }

      const employee = await this.prisma.employees.findFirst({
        where: {
          OR: [
            { email: targetIdentifier },
            { national_id: targetIdentifier },
            { uuid: targetIdentifier },
          ],
        },
      });

      if (employee) {
        await this.prisma.employees.update({
          where: { id: employee.id },
          data: { avatar_url: `/uploads/profiles/${file.filename}` },
        });
        results.push({
          identifier: targetIdentifier,
          type: 'EMPLOYEE',
          success: true,
        });
      }
    }
    return { success: true, count: results.length, details: results };
  }

  async getAvatarUrl(uuid: string) {
    const user = await this.prisma.users.findUnique({
      where: { uuid },
      select: { avatar_url: true },
    });
    if (user) return user.avatar_url;

    const employee = await this.prisma.employees.findUnique({
      where: { uuid },
      select: { avatar_url: true },
    });
    return employee?.avatar_url || null;
  }

  async updatePermissionOverride(
    uuid: string,
    permissionInput: string,
    dto: UpdateUserPermissionOverrideDto,
    actor: CurrentUserType,
  ) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException(
        'Only the super administrator can update user permissions.',
      );
    }

    const [user, permission] = await Promise.all([
      this.findUserByUuidOrThrow(uuid),
      this.resolvePermission(permissionInput),
    ]);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.user_permission_overrides.upsert({
        where: {
          user_id_permission_id: {
            user_id: user.id,
            permission_id: permission.id,
          },
        },
        update: {
          is_allowed: dto.is_allowed,
          reason: dto.reason,
          changed_by: BigInt(actor.userId),
        },
        create: {
          uuid: generateUUID(),
          user_id: user.id,
          permission_id: permission.id,
          is_allowed: dto.is_allowed,
          reason: dto.reason,
          changed_by: BigInt(actor.userId),
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'user_permission_overrides',
          entity_id: user.id,
          module_name: 'USER_MANAGEMENT',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: dto.is_allowed
            ? `Activated user permission: ${permission.permission_key}.`
            : `Deactivated user permission: ${permission.permission_key}.`,
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            user_id: user.id.toString(),
            permission_id: permission.id.toString(),
            permission_key: permission.permission_key,
            is_allowed: dto.is_allowed,
          },
        },
      });

      await tx.notifications.create({
        data: {
          uuid: generateUUID(),
          user_id: user.id,
          sender_id: BigInt(actor.userId),
          title: 'Permission updated',
          message: dto.is_allowed
            ? `You can now use ${permission.name}.`
            : `Your access to ${permission.name} has been removed.`,
          type: 'PERMISSION_UPDATED',
          reference_id: permission.uuid,
          metadata: {
            permission_key: permission.permission_key,
            permission_name: permission.name,
            is_allowed: dto.is_allowed,
            read_only: true,
          },
        },
      });

      return tx.users.findUniqueOrThrow({
        where: { id: user.id },
        include: this.userIncludes(),
      });
    });

    await this.cacheManager.del(`users:all:${actor.userId}::`);
    await this.cacheManager.del('users:pending:');

    return {
      message: dto.is_allowed
        ? 'Permission activated for this user.'
        : 'Permission deactivated for this user.',
      user: this.serializeUser(updatedUser),
    };
  }

  async requestTransfer(
    uuid: string,
    dto: RequestTransferDto,
    actor: CurrentUserType,
  ) {
    const user = await this.findUserByUuidOrThrow(uuid);

    const newLocationId = this.toBigInt(
      dto.working_location_id,
      'working_location_id',
    );

    const newDepartmentId = dto.department_id
      ? this.toBigInt(dto.department_id, 'department_id')
      : null;

    await this.ensureWorkingLocationExists(newLocationId);

    if (newDepartmentId) {
      await this.ensureDepartmentExists(newDepartmentId, newLocationId);
    }

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
        current_level: 'BRANCH_MANAGER',
      },
    });

    // Notify Branch Manager
    if (user.working_location_id) {
      await this.notificationsService.notifyBranchManager(
        user.working_location_id,
        {
          senderId: actor.userId,
          title: 'User Transfer Request',
          message: `A transfer request has been initiated for ${user.first_name} ${user.last_name}.`,
          type: 'TRANSFER_REQUEST',
          referenceId: request.uuid,
          metadata: { level: 'BRANCH_MANAGER' },
        },
      );
    } else {
      await this.notificationsService.notifyAdmins({
        senderId: actor.userId,
        title: 'User Transfer Request',
        message: `A transfer request has been initiated for ${user.first_name} ${user.last_name}.`,
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
    const request = await this.findTransferRequestOrThrow(
      requestUuid,
      TRANSFER_SUBJECT.USER,
    );

    if (!request.user_id) {
      throw new BadRequestException('Transfer request has no user.');
    }

    const isAdmin = this.isSystemAdmin(actor);
    const isBM = this.isBranchManager(actor);

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
        title: 'Transfer Request Awaiting Admin Approval',
        message:
          'A transfer request has been approved by the Branch Manager and requires final admin approval.',
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

        return approved;
      });

      // Notify the requestor
      await this.notificationsService.create({
        userId: request.requested_by,
        senderId: actor.userId,
        title: 'Transfer Request Finalized',
        message: 'Your transfer request has been fully approved and finalized.',
        type: 'TRANSFER_APPROVED',
        referenceId: request.uuid,
      });

      return this.serializeTransferRequest(updated);
    }

    throw new BadRequestException('Invalid transfer request level.');
  }

  async rejectTransfer(
    requestUuid: string,
    dto: RejectTransferDto,
    actor: CurrentUserType,
  ) {
    const request = await this.findTransferRequestOrThrow(
      requestUuid,
      TRANSFER_SUBJECT.USER,
    );

    const rejected = await this.prisma.transfer_requests.update({
      where: { id: request.id },

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
      title: 'Transfer Request Rejected',
      message: `Your transfer request was rejected. Reason: ${dto.rejection_reason}`,
      type: 'TRANSFER_REJECTED',
      referenceId: request.uuid,
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

        status: 'ACTIVE',
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

  private async getDefaultWorkingLocationId() {
    const workingLocation = await this.prisma.working_locations.findFirst({
      where: {
        deleted_at: null,
      },

      orderBy: [{ type: 'asc' }, { name: 'asc' }],

      select: {
        id: true,
      },
    });

    if (!workingLocation) {
      throw new BadRequestException(
        'Create a working location before approving users.',
      );
    }

    return workingLocation.id;
  }

  private async getDefaultDepartmentId(workingLocationId: bigint) {
    const department = await this.prisma.departments.findFirst({
      where: {
        working_location_id: workingLocationId,
        status: 'ACTIVE',
      },

      orderBy: {
        name: 'asc',
      },

      select: {
        id: true,
      },
    });

    if (!department) {
      throw new BadRequestException(
        'Create a department before approving users.',
      );
    }

    return department.id;
  }

  private async getDefaultRoleId() {
    const role = await this.prisma.roles.findFirst({
      where: {
        name: {
          in: ['USER', 'EMPLOYEE', 'STAFF'],
        },
      },

      orderBy: {
        created_at: 'asc',
      },

      select: {
        id: true,
      },
    });

    if (!role) {
      throw new BadRequestException(
        'Create a default USER role before approving users.',
      );
    }

    return role.id;
  }

  private async ensureDepartmentExists(id: bigint, workingLocationId: bigint) {
    const department = await this.prisma.departments.findFirst({
      where: {
        id,
        working_location_id: workingLocationId,
        status: 'ACTIVE',
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

  private async ensureRolesExist(roleIds: bigint[], requireAtLeastOne = true) {
    if (!roleIds.length && requireAtLeastOne) {
      throw new BadRequestException(
        'At least one role is required for activation.',
      );
    }

    if (!roleIds.length) {
      return;
    }

    const roles = await this.prisma.roles.findMany({
      where: {
        id: {
          in: roleIds,
        },
      },

      select: {
        id: true,
      },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist.');
    }
  }

  private async resolvePermissionIds(values: string[]) {
    const permissions = await this.prisma.permissions.findMany({
      where: {
        OR: values.map((value) =>
          isNumericId(value)
            ? { id: BigInt(value) }
            : value.length >= 16
              ? { uuid: value }
              : { permission_key: value },
        ),
      },
      select: { id: true },
    });

    if (permissions.length !== values.length) {
      throw new BadRequestException(
        'Please choose valid permissions before saving this user.',
      );
    }

    return permissions.map((p) => p.id);
  }

  private async resolveRoleIds(values: string[]) {
    const roles = await this.prisma.roles.findMany({
      where: {
        OR: values.map((value) =>
          isNumericId(value)
            ? { id: BigInt(value) }
            : value.length >= 16
              ? { uuid: value }
              : { name: value },
        ),
      },
      select: { id: true },
    });

    if (roles.length !== values.length) {
      throw new BadRequestException(
        'Please choose a valid role before saving this user.',
      );
    }

    return roles.map((role) => role.id);
  }

  private async ensurePermissionsExist(permissionIds: bigint[]) {
    const permissions = await this.prisma.permissions.findMany({
      where: {
        id: {
          in: permissionIds,
        },
      },

      select: {
        id: true,
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions do not exist.');
    }
  }

  private async findTransferRequestOrThrow(
    uuid: string,
    subjectType: TRANSFER_SUBJECT,
  ) {
    const request = await this.prisma.transfer_requests.findFirst({
      where: {
        uuid,
        subject_type: subjectType,
        status: APPROVAL_STATUS.PENDING,
      },
    });

    if (!request) {
      throw new NotFoundException('Pending transfer request not found.');
    }

    return request;
  }

  private userIncludes() {
    return {
      working_location: true,

      department: true,

      roles: {
        include: {
          role: {
            include: {
              role_permissions: { include: { permission: true } },
            },
          },
        },
      },

      user_permissions: {
        include: {
          permission: true,
        },
      },

      permission_overrides: {
        include: {
          permission: true,
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

      permissions: this.serializeEffectivePermissions(user),

      permission_overrides:
        user.permission_overrides?.map((override) => ({
          id: override.id.toString(),
          permission_id: override.permission_id.toString(),
          permission_key: override.permission?.permission_key,
          is_allowed: override.is_allowed,
          reason: override.reason,
        })) ?? [],

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
        : null,
    };
  }

  private serializeEffectivePermissions(user: Record<string, any>) {
    const permissionMap = new Map<string, Record<string, any>>();

    for (const userRole of user.roles ?? []) {
      for (const rolePermission of userRole.role?.role_permissions ?? []) {
        const permission = rolePermission.permission;
        permissionMap.set(permission.permission_key, {
          permission_id: permission.id.toString(),
          permission_key: permission.permission_key,
          name: permission.name,
          module_name: permission.module_name,
          source: 'role',
        });
      }
    }

    for (const userPermission of user.user_permissions ?? []) {
      permissionMap.set(userPermission.permission.permission_key, {
        id: userPermission.id.toString(),
        permission_id: userPermission.permission_id.toString(),
        permission_key: userPermission.permission?.permission_key,
        name: userPermission.permission?.name,
        module_name: userPermission.permission?.module_name,
        source: 'direct',
      });
    }

    for (const override of user.permission_overrides ?? []) {
      const permissionKey = override.permission?.permission_key;
      if (!permissionKey) continue;

      if (override.is_allowed) {
        permissionMap.set(permissionKey, {
          permission_id: override.permission_id.toString(),
          permission_key: permissionKey,
          name: override.permission?.name,
          module_name: override.permission?.module_name,
          source: 'override',
        });
      } else {
        permissionMap.delete(permissionKey);
      }
    }

    return Array.from(permissionMap.values());
  }

  private async resolvePermission(value: string) {
    const permission = await this.prisma.permissions.findFirst({
      where: isNumericId(value)
        ? { id: BigInt(value) }
        : value.length >= 16
          ? { uuid: value }
          : { permission_key: value },
      select: {
        id: true,
        uuid: true,
        name: true,
        permission_key: true,
      },
    });

    if (!permission) {
      throw new BadRequestException('Please choose a valid permission.');
    }

    return permission;
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

  private isBranchManager(actor?: CurrentUserType) {
    return !!actor?.roles?.some((role) =>
      ['BRANCH_MANAGER', 'MANAGER', 'ON_MANAGER'].includes(role),
    );
  }

  private userScopeWhere(actor: CurrentUserType) {
    const baseWhere: any = {
      roles: {
        none: {
          role: {
            name: {
              in: ['SUPER_ADMIN', 'ADMIN'],
            },
          },
        },
      },
    };

    if (this.isSystemAdmin(actor)) {
      return baseWhere;
    }

    if (this.isBranchManager(actor) && actor.working_location_id) {
      return {
        ...baseWhere,
        working_location_id: BigInt(actor.working_location_id),
      };
    }

    return {
      ...baseWhere,
      id: BigInt(actor.userId),
    };
  }

  private ensureActorCanManageUser(
    actor: CurrentUserType,
    workingLocationId?: bigint | null,
  ) {
    if (this.isSystemAdmin(actor)) {
      return;
    }

    if (
      this.isBranchManager(actor) &&
      actor.working_location_id &&
      workingLocationId?.toString() === actor.working_location_id
    ) {
      return;
    }

    throw new BadRequestException(
      'You can only manage users in your working location.',
    );
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
