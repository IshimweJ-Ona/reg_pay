import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { ACTIVITY_TYPE, AUDIT_ACTION } from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ALL_PERMISSION_KEYS } from '../common/constants/permissions.constants';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  private isSystemAdmin(actor?: CurrentUserType) {
    return !!actor?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
  }

  private isLocationScopedRoleManager(actor?: CurrentUserType) {
    return (
      !this.isSystemAdmin(actor) &&
      !actor?.permissions?.includes('roles.manage') &&
      !!actor?.permissions?.includes('roles.manage_own_location')
    );
  }

  async findAll(actor?: CurrentUserType) {
    const scoped = this.isLocationScopedRoleManager(actor);
    const cacheKey = scoped ? `roles:branch:${actor!.working_location_id}` : 'roles:all';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const roles = await this.prisma.roles.findMany({
      where: scoped
        ? {
            OR: [
              { working_location_id: null },
              { working_location_id: actor!.working_location_id ? BigInt(actor!.working_location_id) : undefined },
            ],
          }
        : undefined,
      orderBy: { level_order: 'asc' },
      include: { working_location: { select: { uuid: true, name: true } } },
    });

    const result = roles.map((r) => ({
      ...r,
      id: r.id.toString(),
      permission_keys: (r.permission_keys as string[]) ?? [],
      working_location_id: r.working_location_id?.toString() ?? null,
    }));

    await this.cacheManager.set(cacheKey, result, 600000); // 10 minutes cache
    return result;
  }

  async create(dto: CreateRoleDto, actor: CurrentUserType) {
    const name = this.normalizeRoleName(dto.name);
    const permissionKeys = dto.permission_keys ?? [];

    for (const key of permissionKeys) {
      if (!ALL_PERMISSION_KEYS.includes(key)) {
        throw new BadRequestException(`Permission key "${key}" is not a valid system permission.`);
      }
    }

    const scoped = this.isLocationScopedRoleManager(actor);
    let workingLocationId: bigint | null = null;

    if (scoped) {
      if (!actor.working_location_id) {
        throw new ForbiddenException(
          'Your account has no branch assigned, so you cannot create a branch-scoped role. Ask an administrator to assign you to a branch first.',
        );
      }
      workingLocationId = BigInt(actor.working_location_id);
    } else if (dto.working_location_id) {
      workingLocationId = await this.resolveWorkingLocationId(dto.working_location_id);
    }

    const existing = await this.prisma.roles.findFirst({
      where: { name, working_location_id: workingLocationId },
    });
    if (existing) {
      throw new ConflictException(
        workingLocationId
          ? 'A role with this name already exists for this branch.'
          : 'A global role with this name already exists.',
      );
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.roles.create({
        data: {
          uuid: generateUUID(),
          name,
          description: dto.description?.trim() || null,
          is_system_role: false,
          permission_keys: permissionKeys,
          working_location_id: workingLocationId,
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'roles',
          entity_id: created.id,
          module_name: 'RBAC',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: workingLocationId
            ? 'Created branch-scoped role.'
            : 'Created role.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            name: created.name,
            permission_keys: permissionKeys,
            working_location_id: workingLocationId?.toString() ?? null,
          },
        },
      });

      return created;
    });

    // No users hold a brand-new role yet, so nothing to notify.
    await this.clearRbacCaches();
    return this.findOne(role.id);
  }

  async update(roleInput: string, dto: UpdateRoleDto, actor: CurrentUserType) {
    const roleId = this.toBigInt(roleInput, 'role');
    const role = await this.prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found.');

    const scoped = this.isLocationScopedRoleManager(actor);
    if (scoped) {
      const ownLocation = actor.working_location_id ? BigInt(actor.working_location_id) : null;
      if (!role.working_location_id || !ownLocation || role.working_location_id !== ownLocation) {
        throw new ForbiddenException('You can only edit roles that belong to your own branch.');
      }
    }

    const data: Record<string, any> = {};
    if (dto.name !== undefined) {
      if (role.is_system_role) {
        throw new BadRequestException('System role names cannot be changed.');
      }
      data.name = this.normalizeRoleName(dto.name);
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim() || null;
    }
    if (dto.permission_keys !== undefined) {
      for (const key of dto.permission_keys) {
        if (!ALL_PERMISSION_KEYS.includes(key)) {
          throw new BadRequestException(`Permission key "${key}" is not a valid system permission.`);
        }
      }
      data.permission_keys = dto.permission_keys;
    }

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length) {
        await tx.roles.update({ where: { id: roleId }, data });
      }

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'roles',
          entity_id: roleId,
          module_name: 'RBAC',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated role permissions.',
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            ...data,
          },
        },
      });
    });

    // Only notify users who actually hold this role.
    if (dto.permission_keys !== undefined) {
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
    await this.clearRbacCaches();
    return this.findOne(roleId);
  }

  private async resolveWorkingLocationId(value: string) {
    const location = await this.prisma.working_locations.findFirst({
      where: /^\d+$/.test(value)
        ? { id: BigInt(value), deleted_at: null }
        : { uuid: value, deleted_at: null },
      select: { id: true },
    });
    if (!location) throw new BadRequestException('Selected branch does not exist.');
    return location.id;
  }

  private async findOne(roleId: bigint) {
    const role = await this.prisma.roles.findUniqueOrThrow({
      where: { id: roleId },
    });

    return {
      ...role,
      id: role.id.toString(),
      permission_keys: (role.permission_keys as string[]) ?? [],
      working_location_id: role.working_location_id?.toString() ?? null,
    };
  }

  private normalizeRoleName(name: string) {
    const normalized = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    if (!normalized) throw new BadRequestException('Role name is required.');
    return normalized;
  }

  private toBigInt(value: string, label: string) {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(`Please choose a valid ${label}.`);
    }
    return BigInt(value);
  }

  private async clearRbacCaches() {
    await Promise.all([
      this.cacheManager.del('roles:all'),
      this.cacheManager.del('permissions:all'),
    ]);
  }
}