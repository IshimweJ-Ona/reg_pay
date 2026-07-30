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
} from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignUserPermissionDto } from './dto/assign-user-permission.dto';
import {
  PERMISSION_MODULES,
  PermissionModule,
  ALL_PERMISSION_KEYS,
} from '../common/constants/permissions.constants';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  async findAll(): Promise<PermissionModule[]> {
    return PERMISSION_MODULES;
  }

  async assignToRole(dto: AssignPermissionDto, actor: CurrentUserType) {
    const roleId = this.toBigInt(dto.role_id, 'role_id');
    const permissionKey = dto.permission_key;

    await this.ensureRoleAndPermission(roleId, permissionKey);

    const role = await this.prisma.roles.findUniqueOrThrow({
      where: { id: roleId },
    });
    this.ensureActorCanManageRole(actor, role);
    const keys = (role.permission_keys as string[]) ?? [];
    if (!keys.includes(permissionKey)) {
      keys.push(permissionKey);
      await this.prisma.roles.update({
        where: { id: roleId },
        data: { permission_keys: keys },
      });
    }

    await this.notifyUsersWithRole(roleId);
    await this.clearRoleCaches(role.working_location_id);

    return {
      message: 'Permission assigned to role.',
    };
  }

  async removeFromRole(dto: AssignPermissionDto, actor: CurrentUserType) {
    const roleId = this.toBigInt(dto.role_id, 'role_id');
    const permissionKey = dto.permission_key;

    const role = await this.prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found.');
    this.ensureActorCanManageRole(actor, role);

    const keys = (role.permission_keys as string[]) ?? [];
    if (keys.includes(permissionKey)) {
      const updatedKeys = keys.filter((k) => k !== permissionKey);
      await this.prisma.roles.update({
        where: { id: roleId },
        data: { permission_keys: updatedKeys },
      });
    }

    await this.notifyUsersWithRole(roleId);
    await this.clearRoleCaches(role.working_location_id);

    return { message: 'Permission removed from role.' };
  }

  async assignToUser(dto: AssignUserPermissionDto, actor: CurrentUserType) {
    const userId = this.toBigInt(dto.user_id, 'user_id');
    const permissionKey = dto.permission_key;

    await this.ensureUserAndPermission(userId, permissionKey);
    await this.ensureActorCanGrantUserPermission(actor, userId);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user_permissions.upsert({
        where: {
          user_id_permission_key: {
            user_id: userId,
            permission_key: permissionKey,
          },
        },
        update: {},
        create: {
          user_id: userId,
          permission_key: permissionKey,
          granted_by: BigInt(actor.userId),
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'user_permissions',
          entity_id: created.id,
          module_name: 'RBAC',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Assigned permission directly to user.',
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            user_id: userId.toString(),
            permission_key: permissionKey,
          },
        },
      });

      return created;
    });

    this.notificationsService.notifyUsers([userId], {
      type: 'permissions_updated',
    });

    return {
      message: 'Permission assigned to user.',
      user_permission: this.serializeUserPermission(assignment),
    };
  }

  async removeFromUser(dto: AssignUserPermissionDto, actor: CurrentUserType) {
    const userId = this.toBigInt(dto.user_id, 'user_id');
    const permissionKey = dto.permission_key;
    await this.ensureActorCanGrantUserPermission(actor, userId);

    const existing = await this.prisma.user_permissions.findUnique({
      where: {
        user_id_permission_key: {
          user_id: userId,
          permission_key: permissionKey,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('User permission assignment not found.');
    }

    await this.prisma.$transaction([
      this.prisma.user_permissions.delete({ where: { id: existing.id } }),
      this.prisma.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'user_permissions',
          entity_id: existing.id,
          module_name: 'RBAC',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Removed direct permission from user.',
          action: AUDIT_ACTION.UPDATED,
          old_values: {
            user_id: userId.toString(),
            permission_key: permissionKey,
          },
        },
      }),
    ]);

    this.notificationsService.notifyUsers([userId], {
      type: 'permissions_updated',
    });

    return { message: 'Permission removed from user.' };
  }

  // Notifies only the users who currently hold the given role.
  private async notifyUsersWithRole(roleId: bigint) {
    const affectedUsers = await this.prisma.user_roles.findMany({
      where: { role_id: roleId },
      select: { user_id: true },
    });
    const userIds = affectedUsers.map((ur) => ur.user_id);
    if (userIds.length > 0) {
      this.notificationsService.notifyUsers(userIds, {
        type: 'permissions_updated',
      });
    }
  }

  private async clearRoleCaches(locationId?: bigint | null) {
    const cacheKeys = new Set(['roles:all', 'users:all', 'users:pending']);
    if (locationId) {
      cacheKeys.add(`roles:branch:${locationId.toString()}`);
    }

    try {
      const store = (this.cacheManager as any).store;
      if (store && typeof store.keys === 'function') {
        const keys = await store.keys();
        for (const key of keys) {
          if (
            typeof key === 'string' &&
            (key.startsWith('users:all') ||
              key.startsWith('users:pending') ||
              key.startsWith('roles:branch:'))
          ) {
            cacheKeys.add(key);
          }
        }
      }
    } catch {
      // Exact-key fallback below still works for stores without key iteration.
    }

    await Promise.all(
      Array.from(cacheKeys).map((key) => this.cacheManager.del(key)),
    );
  }

  private async ensureRoleAndPermission(roleId: bigint, permissionKey: string) {
    const role = await this.prisma.roles.findUnique({
      where: { id: roleId },
      select: { id: true },
    });
    if (!role) throw new BadRequestException('Role does not exist.');

    if (!ALL_PERMISSION_KEYS.includes(permissionKey)) {
      throw new BadRequestException(
        `Permission key "${permissionKey}" is not a valid system permission.`,
      );
    }
  }

  private async ensureUserAndPermission(userId: bigint, permissionKey: string) {
    const user = await this.prisma.users.findFirst({
      where: { id: userId, deleted_at: null },
      select: { id: true },
    });

    if (!user) throw new BadRequestException('User does not exist.');

    if (!ALL_PERMISSION_KEYS.includes(permissionKey)) {
      throw new BadRequestException(
        `Permission key "${permissionKey}" is not a valid system permission.`,
      );
    }
  }

  private isSystemAdmin(actor: CurrentUserType) {
    return actor.roles.some((role) => ['SUPER_ADMIN'].includes(role));
  }

  private isLocationScopedRoleManager(actor: CurrentUserType) {
    return (
      !this.isSystemAdmin(actor) &&
      !actor.permissions.includes('roles.manage') &&
      actor.permissions.includes('roles.manage_own_location')
    );
  }

  /**
   * Mirrors RolesService's own branch-ownership check: a roles.manage_own_location
   * actor may only assign/revoke permissions on a role that belongs to their
   * own branch, never a global role or another branch's role.
   */
  private ensureActorCanManageRole(
    actor: CurrentUserType,
    role: { working_location_id: bigint | null },
  ) {
    if (!this.isLocationScopedRoleManager(actor)) return;

    const ownLocation = actor.working_location_id
      ? BigInt(actor.working_location_id)
      : null;
    if (
      !role.working_location_id ||
      !ownLocation ||
      role.working_location_id !== ownLocation
    ) {
      throw new ForbiddenException(
        'You can only assign or revoke permissions on roles that belong to your own branch.',
      );
    }
  }

  private async ensureActorCanGrantUserPermission(
    actor: CurrentUserType,
    userId: bigint,
  ) {
    if (this.isSystemAdmin(actor)) return;

    if (!actor.roles.includes('BRANCH_MANAGER') || !actor.working_location_id) {
      throw new BadRequestException(
        'You can only grant permissions as an administrator or branch manager.',
      );
    }

    const target = await this.prisma.users.findFirst({
      where: {
        id: userId,
        deleted_at: null,
        working_location_id: BigInt(actor.working_location_id),
      },
      select: { id: true },
    });

    if (!target) {
      throw new BadRequestException(
        'Branch managers can only grant permissions within their working location.',
      );
    }
  }

  private serializeUserPermission(userPermission: Record<string, any>) {
    return {
      ...userPermission,
      id: userPermission.id.toString(),
      user_id: userPermission.user_id.toString(),
      permission_key: userPermission.permission_key,
      granted_by: userPermission.granted_by?.toString() ?? null,
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
}
