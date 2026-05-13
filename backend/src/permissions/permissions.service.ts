import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ACTIVITY_TYPE, AUDIT_ACTION } from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.serializePermission(permission);
  }

  async findAll() {
    const permissions = await this.prisma.permissions.findMany({
      orderBy: [{ module_name: 'asc' }, { permission_key: 'asc' }],
    });

    return permissions.map((permission) => this.serializePermission(permission));
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

  private async ensureRoleAndPermission(roleId: bigint, permissionId: bigint) {
    const [role, permission] = await Promise.all([
      this.prisma.roles.findUnique({ where: { id: roleId }, select: { id: true } }),
      this.prisma.permissions.findUnique({
        where: { id: permissionId },
        select: { id: true },
      }),
    ]);

    if (!role) throw new BadRequestException('Role does not exist.');
    if (!permission) throw new BadRequestException('Permission does not exist.');
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

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(`${fieldName} must be a numeric id.`);
    }

    return BigInt(value);
  }
}
