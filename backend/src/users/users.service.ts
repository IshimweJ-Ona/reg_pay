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
  audit_logs_activity_type as ACTIVITY_TYPE,
  audit_logs_action as AUDIT_ACTION,
  transfer_requests_subject_type,
} from '@prisma/client';

// Standard relative imports to ensure consistency across the project
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { hashPassword } from '../auth/utils/password.util';
import {
  isNumericId,
  isUuid,
  normalizeSearch,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { hasEffectivePermission } from '../common/utils/effective-permissions.util';
import { generateUUID } from '../common/utils/uuid.util';

import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import { RequestTransferDto } from '../common/dto/request-transfer.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { UpdateUserPermissionOverrideDto } from './dto/update-user-permission-override.dto';

import { NotificationsService } from '../notifications/notifications.service';
import {
  ALL_PERMISSION_KEYS,
  IMPLIED_PERMISSIONS,
  PERMISSION_MODULES,
} from '../common/constants/permissions.constants';

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

    // If the actor is a branch manager and no working_location_id was
    // provided, default to the actor's own working location so the
    // new user is automatically assigned to the same branch.
    const workingLocationId = data.working_location_id
      ? await this.resolveWorkingLocationId(data.working_location_id)
      : (actor?.working_location_id
          ? BigInt(actor.working_location_id)
          : null);

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
          status: 'INACTIVE',
          updated_at: new Date(),
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
          data: permissionIds.map((key) => ({
            user_id: created.id,
            permission_key: key,
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
            activity_type: 'CREATE' as any,
            activity_description: 'Created pending user account.',
            action: 'CREATED' as any,
            new_values: {
              status: 'INACTIVE',
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
              status: filters.status as any,
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

  async findPendingApproval(actor: CurrentUserType, qInput?: string) {
    const q = normalizeSearch(qInput);
    const cacheKey = `users:pending:${actor.userId}:${q ?? ''}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const users = await this.prisma.users.findMany({
      where: {
        status: { in: ['PENDING', 'INACTIVE'] },
        deleted_at: null,
        ...this.userScopeWhere(actor),

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

    // Use explicit role_ids from approve dto if provided.
    // Otherwise reuse the user's already-assigned roles (from registration)
    // before falling back to a hard-coded default role.
    let roleIds: bigint[];
    if (dto.role_ids?.length) {
      roleIds = await this.resolveRoleIds(dto.role_ids);
    } else {
      const existingRoles = await this.prisma.user_roles.findMany({
        where: { user_id: user.id },
        select: { role_id: true },
      });
      roleIds = existingRoles.length
        ? existingRoles.map((r) => r.role_id)
        : [await this.getDefaultRoleId()];
    }

    const permissionIds = dto.permission_ids?.length
      ? await this.resolvePermissionIds(dto.permission_ids)
      : [];

    await this.ensureRolesExist(roleIds);
    await this.ensureActorCanAssignRoles(actor, roleIds);

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

    const isBranchManagerActor = actor.roles.includes('BRANCH_MANAGER');
    const isSuperAdminActor = actor.roles.includes('SUPER_ADMIN');

    if (isBranchManagerActor && !isSuperAdminActor) {
      const isAssigningHighLevelRole = roles.some((r) =>
        ['BRANCH_MANAGER', 'SUPER_ADMIN'].includes(r.name),
      );
      if (isAssigningHighLevelRole) {
        throw new BadRequestException(
          'Branch managers cannot assign Branch Manager or Super Admin roles.',
        );
      }
    }

    const isBranchManagerRole = roles.some((r) =>
      ['BRANCH_MANAGER'].includes(r.name),
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
          status: 'ACTIVE',
          updated_at: new Date(),
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
          data: permissionIds.map((key) => ({
            user_id: user.id,
            permission_key: key,
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
          activity_type: 'UPDATE' as any,
          activity_description: 'User account approved and activated.',
          action: 'APPROVED' as any,
        },
      });

      return tx.users.findUniqueOrThrow({
        where: { id: user.id },
        include: this.userIncludes(),
      });
    });

    await this.notificationsService.create({
      userId: user.id,
      senderId: BigInt(actor.userId),
      title: 'Your account has been approved',
      message: `Welcome aboard! Your account has been approved and is now active. You can log in to get started.`,
      type: 'ACCOUNT_APPROVED',
      referenceId: user.uuid,
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
          status: 'REJECTED',
          updated_at: new Date(),
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
          activity_type: 'DELETE' as any,
          activity_description: `User rejected: ${reason}`,
          action: 'DENIED' as any,
        },
      });
    });

    await this.notificationsService.create({
      userId: user.id,
      senderId: BigInt(actor.userId),
      title: 'Your account registration was rejected',
      message: reason || 'Your account registration was not approved.',
      type: 'ACCOUNT_REJECTED',
      referenceId: user.uuid,
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
      include: { users_branch_managers_user_idTousers: true },
    });

    if (existing) {
      throw new BadRequestException(
        `This branch already has an active Branch Manager: ${(existing as any).users_branch_managers_user_idTousers?.first_name} ${(existing as any).users_branch_managers_user_idTousers?.last_name}. Only one is allowed.`,
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
          status: 'SUSPENDED',
          updated_at: new Date(),
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
        status: 'ACTIVE',
        updated_at: new Date(),
      },
      include: this.userIncludes(),
    });

    return {
      message: 'User account reactivated.',
      user: this.serializeUser(reactivated),
    };
  }

  private async ensureActorCanAssignRoles(actor: CurrentUserType, roleIds: bigint[]) {
    if (this.isSystemAdmin(actor) || !roleIds.length) return;

    const roles = await this.prisma.roles.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true, working_location_id: true },
    });

    const actorLocation = actor.working_location_id ? BigInt(actor.working_location_id) : null;

    for (const role of roles) {
      if (role.working_location_id && (!actorLocation || role.working_location_id !== actorLocation)) {
        throw new BadRequestException(
          `The role "${role.name}" belongs to a different branch and cannot be assigned from here.`,
        );
      }
    }
  }

  async assignRoles(
    uuid: string,
    roleIdsInput: string[],
    actor: CurrentUserType,
  ) {
    const user = await this.findUserByUuidOrThrow(uuid);

    const roleIds = await this.resolveRoleIds(roleIdsInput);

    await this.ensureRolesExist(roleIds);
    await this.ensureActorCanAssignRoles(actor, roleIds);

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

    this.notificationsService.broadcast({ type: 'permissions_updated' });

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
    const [user, permission] = await Promise.all([
      this.findUserByUuidOrThrow(uuid),
      this.resolvePermission(permissionInput),
    ]);

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      await tx.user_permission_overrides.upsert({
        where: {
          user_id_permission_key: {
            user_id: user.id,
            permission_key: permission.permission_key,
          },
        },
        update: {
          is_allowed: dto.is_allowed,
          reason: dto.reason,
          changed_by: BigInt(actor.userId),
          updated_at: new Date(),
        },
        create: {
          uuid: generateUUID(),
          user_id: user.id,
          permission_key: permission.permission_key,
          is_allowed: dto.is_allowed,
          reason: dto.reason,
          changed_by: BigInt(actor.userId),
          updated_at: new Date(),
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'user_permission_overrides',
          entity_id: user.id,
          module_name: 'USER_MANAGEMENT',
          activity_type: 'UPDATE' as any,
          activity_description: dto.is_allowed
            ? `Activated user permission: ${permission.permission_key}.`
            : `Deactivated user permission: ${permission.permission_key}.`,
          action: 'UPDATED' as any,
          new_values: {
            user_id: user.id.toString(),
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
          reference_id: permission.permission_key,
          metadata: {
            permission_key: permission.permission_key,
            permission_name: permission.name,
            is_allowed: dto.is_allowed,
            read_only: true,
          },
          updated_at: new Date(),
        },
      });

      return tx.users.findUniqueOrThrow({
        where: { id: user.id },
        include: this.userIncludes(),
      });
    });

    await this.cacheManager.del(`users:all:${actor.userId}::`);
    await this.cacheManager.del('users:pending:');

    this.notificationsService.broadcast({ type: 'permissions_updated' });

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
        subject_type: 'USER',
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
        metadata: { level: 'SUPER_ADMIN' },
      });
      await this.prisma.transfer_requests.update({
        where: { id: request.id },
        data: { current_level: 'SUPER_ADMIN' },
      });
    }

    return this.serializeTransferRequest(request);
  }

  async approveTransfer(requestUuid: string, actor: CurrentUserType) {
    const request = await this.findTransferRequestOrThrow(
      requestUuid,
      'USER' as any,
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
          current_level: 'SUPER_ADMIN',
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
        metadata: { level: 'SUPER_ADMIN' },
      });

      return this.serializeTransferRequest(updated);
    }

    if (request.current_level === 'SUPER_ADMIN') {
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
            updated_at: new Date(),
          },
        });

        const approved = await tx.transfer_requests.update({
          where: { id: request.id },
          data: {
            status: 'APPROVED',
            approved_by: BigInt(actor.userId),
            approved_at: new Date(),
            current_level: 'FINALIZED',
            history: ((request.history as any[]) || []).concat([
              {
                level: 'SUPER_ADMIN',
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
      'USER' as any,
    );

    const rejected = await this.prisma.transfer_requests.update({
      where: { id: request.id },

      data: {
        status: 'REJECTED',
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
        user_roles: {
          include: {
            roles: true,
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
    for (const key of values) {
      if (!ALL_PERMISSION_KEYS.includes(key)) {
        throw new BadRequestException(
          'Please choose valid permissions before saving this user.',
        );
      }
    }
    return values;
  }

  private async resolveRoleIds(values: string[]) {
    const roles = await this.prisma.roles.findMany({
      where: {
        OR: values.map((value) =>
          isNumericId(value)
            ? { id: BigInt(value) }
            : isUuid(value)
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

  private async ensurePermissionsExist(permissionKeys: string[]) {
    for (const key of permissionKeys) {
      if (!ALL_PERMISSION_KEYS.includes(key)) {
        throw new BadRequestException('One or more permissions do not exist.');
      }
    }
  }

  private async findTransferRequestOrThrow(
    uuid: string,
    subjectType: transfer_requests_subject_type,
  ) {
    const request = await this.prisma.transfer_requests.findFirst({
      where: {
        uuid,
        subject_type: subjectType,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new NotFoundException('Pending transfer request not found.');
    }

    return request;
  }

  private userIncludes() {
    return {
      working_locations: {
        select: {
          uuid: true,
          name: true,
          type: true,
          address: true,
          created_at: true,
          updated_at: true,
          created_by: true,
          updated_by: true,
          deleted_by: true,
        },
      },
      departments: {
        select: {
          uuid: true,
          name: true,
          code: true,
          working_location_id: true,
        },
      },
      user_roles: {
        include: {
          roles: true,
        },
      },
      user_permissions: true,
      user_permission_overrides: true,
    };
  }

  private serializeUser(user: Record<string, any>) {
    return {
      ...user,

      id: user.id?.toString(),

      working_location_id: user.working_location_id?.toString() ?? null,

      department_id: user.department_id?.toString() ?? null,

      roles: user.user_roles?.map((userRole: any) => ({
        id: userRole.id.toString(),
        role_id: userRole.role_id.toString(),
        name: userRole.roles?.name,
      })),

      permissions: this.serializeEffectivePermissions(user),

      permission_overrides:
        user.user_permission_overrides?.map((override: any) => ({
          id: override.id.toString(),
          permission_key: override.permission_key,
          is_allowed: override.is_allowed,
          reason: override.reason,
        })) ?? [],

      working_location: user.working_locations
        ? {
            ...user.working_locations,
            id: user.working_locations.id.toString(),
            created_by: user.working_locations.created_by?.toString() ?? null,
            updated_by: user.working_locations.updated_by?.toString() ?? null,
            deleted_by: user.working_locations.deleted_by?.toString() ?? null,
          }
        : null,

      department: user.departments
        ? {
            ...user.departments,
            id: user.departments.id.toString(),
            working_location_id: user.departments.working_location_id.toString(),
          }
        : null,
    };
  }

  private serializeEffectivePermissions(user: Record<string, any>) {
    const permissionMap = new Map<string, Record<string, any>>();

    // 1. Collect direct and role-based permissions
    for (const userRole of user.user_roles ?? []) {
      const keys = (userRole.roles?.permission_keys as string[]) ?? [];
      for (const key of keys) {
        let name = key.split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        let moduleName = 'SYSTEM';
        for (const mod of PERMISSION_MODULES) {
          const found = mod.permissions.find((p) => p.key === key);
          if (found) {
            name = found.name;
            moduleName = mod.module;
            break;
          }
        }
        permissionMap.set(key, {
          permission_key: key,
          name,
          module_name: moduleName,
          source: 'role',
        });
      }
    }

    for (const userPermission of user.user_permissions ?? []) {
      const key = userPermission.permission_key;
      let name = key.split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
      let moduleName = 'SYSTEM';
      for (const mod of PERMISSION_MODULES) {
        const found = mod.permissions.find((p) => p.key === key);
        if (found) {
          name = found.name;
          moduleName = mod.module;
          break;
        }
      }
      permissionMap.set(key, {
        id: userPermission.id.toString(),
        permission_key: key,
        name,
        module_name: moduleName,
        source: 'direct',
      });
    }

    // 2. Expand implied permissions
    const initialPermissions = Array.from(permissionMap.values());
    for (const p of initialPermissions) {
      for (const impliedKey of IMPLIED_PERMISSIONS[p.permission_key] ?? []) {
        if (!permissionMap.has(impliedKey)) {
          permissionMap.set(impliedKey, {
            permission_key: impliedKey,
            name: impliedKey
              .split('.')
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' '),
            source: 'implied',
          });
        }
      }
    }

    // 3. Apply overrides (EXPLICIT DENY takes precedence)
    for (const override of user.user_permission_overrides ?? []) {
      const permissionKey = override.permission_key;
      if (!permissionKey) continue;

      if (override.is_allowed) {
        let name = permissionKey.split('.').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        let moduleName = 'SYSTEM';
        for (const mod of PERMISSION_MODULES) {
          const found = mod.permissions.find((p) => p.key === permissionKey);
          if (found) {
            name = found.name;
            moduleName = mod.module;
            break;
          }
        }
        permissionMap.set(permissionKey, {
          id: override.id.toString(),
          permission_key: permissionKey,
          name,
          module_name: moduleName,
          source: 'override',
        });
      } else {
        permissionMap.delete(permissionKey);
      }
    }

    return Array.from(permissionMap.values());
  }

  private resolvePermission(value: string) {
    if (!ALL_PERMISSION_KEYS.includes(value)) {
      throw new BadRequestException('Permission does not exist.');
    }

    for (const mod of PERMISSION_MODULES) {
      const permission = mod.permissions.find((item) => item.key === value);
      if (permission) {
        return {
          permission_key: permission.key,
          name: permission.name,
          module_name: mod.module,
        };
      }
    }

    return {
      permission_key: value,
      name: value
        .split('.')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      module_name: 'SYSTEM',
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
    return !!actor?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
  }

  private isBranchManager(actor?: CurrentUserType) {
    return !!actor?.roles?.some((role) => ['BRANCH_MANAGER'].includes(role));
  }

  private userScopeWhere(actor: CurrentUserType) {
    if (this.isSystemAdmin(actor)) {
      return {};
    }

    const baseWhere: any = {
      user_roles: {
        none: {
          roles: {
            name: {
              in: ['SUPER_ADMIN'],
            },
          },
        },
      },
    };

    if (hasEffectivePermission(actor, 'users.read_all')) {
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
