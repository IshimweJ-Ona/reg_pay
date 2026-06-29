import {
  BadRequestException,
  ConflictException,
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

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  async findAll() {
    const cacheKey = 'roles:all';
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const roles = await this.prisma.roles.findMany({
      orderBy: { level_order: 'asc' },
    });

    const result = roles.map((r) => ({
      ...r,
      id: r.id.toString(),
      permission_keys: (r.permission_keys as string[]) ?? [],
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

    const existing = await this.prisma.roles.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException('A role with this name already exists.');
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.roles.create({
        data: {
          uuid: generateUUID(),
          name,
          description: dto.description?.trim() || null,
          is_system_role: false,
          permission_keys: permissionKeys,
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'roles',
          entity_id: created.id,
          module_name: 'RBAC',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: 'Created role.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            name: created.name,
            permission_keys: permissionKeys,
          },
        },
      });

      return created;
    });

    await this.clearRbacCaches();
    return this.findOne(role.id);
  }

  async update(roleInput: string, dto: UpdateRoleDto, actor: CurrentUserType) {
    const roleId = this.toBigInt(roleInput, 'role');
    const role = await this.prisma.roles.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found.');

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

    await this.clearRbacCaches();
    return this.findOne(roleId);
  }

  private async findOne(roleId: bigint) {
    const role = await this.prisma.roles.findUniqueOrThrow({
      where: { id: roleId },
    });

    return {
      ...role,
      id: role.id.toString(),
      permission_keys: (role.permission_keys as string[]) ?? [],
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
