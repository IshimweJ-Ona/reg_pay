import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';

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
      include: {
        role_permissions: {
          include: { permission: true },
          orderBy: { permission_id: 'asc' },
        },
      },
      orderBy: { level_order: 'asc' },
    });
    
    const result = roles.map((r) => ({
      ...r,
      id: r.id.toString(),
      role_permissions: r.role_permissions.map((rolePermission) => ({
        id: rolePermission.id.toString(),
        role_id: rolePermission.role_id.toString(),
        permission_id: rolePermission.permission_id.toString(),
        permission: {
          ...rolePermission.permission,
          id: rolePermission.permission.id.toString(),
        },
      })),
    }));

    await this.cacheManager.set(cacheKey, result, 600000); // 10 minutes cache
    return result;
  }
}
