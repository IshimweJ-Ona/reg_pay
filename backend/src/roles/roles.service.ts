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
      orderBy: { level_order: 'asc' },
    });
    
    const result = roles.map((r) => ({
      ...r,
      id: r.id.toString(),
    }));

    await this.cacheManager.set(cacheKey, result, 600000); // 10 minutes cache
    return result;
  }
}
