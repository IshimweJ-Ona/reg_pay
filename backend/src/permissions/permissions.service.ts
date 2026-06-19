import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { ACTIVITY_TYPE, AUDIT_ACTION } from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignUserPermissionDto } from './dto/assign-user-permission.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  async create(dto: CreatePermissionDto, actor: CurrentUserType) {
    const existing = await this.prisma.permissions.findFirst({
      where: {
        OR: [{ name: dto.name }, { permission_key: dto.permission_key }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Permission name or key already exists.');
    }

    const permission = await this.prisma.$transaction(async (tx) => {
      const created = await tx.permissions.create({
        data: {
          uuid: generateUUID(),
          name: dto.name,
          module_name: dto.module_name,
          permission_key: dto.permission_key,
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'permissions',
          entity_id: created.id,
          module_name: 'RBAC',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: 'Created permission.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            name: created.name,
            module_name: created.module_name,
            permission_key: created.permission_key,
          },
        },
      });

      return created;
    });

    await this.cacheManager.del('permissions:all');

    return this.serializePermission(permission);
  }

  async findAll() {
    const cacheKey = 'permissions:all';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const permissions = await this.prisma.permissions.findMany({
      orderBy: [{ module_name: 'asc' }, { permission_key: 'asc' }],
    });

    const result = permissions.map((permission) =>
      this.serializePermission(permission),
    );

    await this.cacheManager.set(cacheKey, result, 600000); // 10 minutes cache
    return result;
  }

  async assignToRole(dto: AssignPermissionDto, actor: CurrentUserType) {
    const roleId = this.toBigInt(dto.role_id, 'role_id');
    const permissionId = this.toBigInt(dto.permission_id, 'permission_id');

    await this.ensureRoleAndPermission(roleId, permissionId);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role_permissions.upsert({
        where: {
          role_id_permission_id: {
            role_id: roleId,
            permission_id: permissionId,
          },
        },
        update: {},
        create: {
          role_id: roleId,
          permission_id: permissionId,
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'role_permissions',
          entity_id: created.id,
          module_name: 'RBAC',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Assigned permission to role.',
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            role_id: roleId.toString(),
            permission_id: permissionId.toString(),
          },
        },
      });

      return created;
    });

    return {
      message: 'Permission assigned to role.',
      role_permission: this.serializeRolePermission(assignment),
    };
  }

  async removeFromRole(dto: AssignPermissionDto, actor: CurrentUserType) {
    const roleId = this.toBigInt(dto.role_id, 'role_id');
    const permissionId = this.toBigInt(dto.permission_id, 'permission_id');

    const existing = await this.prisma.role_permissions.findUnique({
      where: {
        role_id_permission_id: {
          role_id: roleId,
          permission_id: permissionId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Role permission assignment not found.');
    }

    await this.prisma.$transaction([
      this.prisma.role_permissions.delete({
        where: { id: existing.id },
      }),
      this.prisma.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'role_permissions',
          entity_id: existing.id,
          module_name: 'RBAC',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Removed permission from role.',
          action: AUDIT_ACTION.UPDATED,
          old_values: {
            role_id: roleId.toString(),
            permission_id: permissionId.toString(),
          },
        },
      }),
    ]);

    return { message: 'Permission removed from role.' };
  }

  async assignToUser(dto: AssignUserPermissionDto, actor: CurrentUserType) {
    const userId = this.toBigInt(dto.user_id, 'user_id');
    const permissionId = this.toBigInt(dto.permission_id, 'permission_id');

    await this.ensureUserAndPermission(userId, permissionId);
    await this.ensureActorCanGrantUserPermission(actor, userId);

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user_permissions.upsert({
        where: {
          user_id_permission_id: {
            user_id: userId,
            permission_id: permissionId,
          },
        },
        update: {},
        create: {
          user_id: userId,
          permission_id: permissionId,
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
            permission_id: permissionId.toString(),
          },
        },
      });

      return created;
    });

    return {
      message: 'Permission assigned to user.',
      user_permission: this.serializeUserPermission(assignment),
    };
  }

  async removeFromUser(dto: AssignUserPermissionDto, actor: CurrentUserType) {
    const userId = this.toBigInt(dto.user_id, 'user_id');
    const permissionId = this.toBigInt(dto.permission_id, 'permission_id');
    await this.ensureActorCanGrantUserPermission(actor, userId);

    const existing = await this.prisma.user_permissions.findUnique({
      where: {
        user_id_permission_id: {
          user_id: userId,
          permission_id: permissionId,
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
            permission_id: permissionId.toString(),
          },
        },
      }),
    ]);

    return { message: 'Permission removed from user.' };
  }

  private async ensureRoleAndPermission(roleId: bigint, permissionId: bigint) {
    const [role, permission] = await Promise.all([
      this.prisma.roles.findUnique({
        where: { id: roleId },
        select: { id: true },
      }),
      this.prisma.permissions.findUnique({
        where: { id: permissionId },
        select: { id: true },
      }),
    ]);

    if (!role) throw new BadRequestException('Role does not exist.');
    if (!permission)
      throw new BadRequestException('Permission does not exist.');
  }

  private async ensureUserAndPermission(userId: bigint, permissionId: bigint) {
    const [user, permission] = await Promise.all([
      this.prisma.users.findFirst({
        where: { id: userId, deleted_at: null },
        select: { id: true },
      }),
      this.prisma.permissions.findUnique({
        where: { id: permissionId },
        select: { id: true },
      }),
    ]);

    if (!user) throw new BadRequestException('User does not exist.');
    if (!permission)
      throw new BadRequestException('Permission does not exist.');
  }

  private isSystemAdmin(actor: CurrentUserType) {
    return actor.roles.some((role) => ['SUPER_ADMIN'].includes(role));
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

  private serializePermission(permission: Record<string, any>) {
    return {
      ...permission,
      id: permission.id.toString(),
    };
  }

  private serializeRolePermission(rolePermission: Record<string, any>) {
    return {
      ...rolePermission,
      id: rolePermission.id.toString(),
      role_id: rolePermission.role_id.toString(),
      permission_id: rolePermission.permission_id.toString(),
    };
  }

  private serializeUserPermission(userPermission: Record<string, any>) {
    return {
      ...userPermission,
      id: userPermission.id.toString(),
      user_id: userPermission.user_id.toString(),
      permission_id: userPermission.permission_id.toString(),
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
