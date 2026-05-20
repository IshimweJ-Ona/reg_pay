import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.roles.findMany({
      orderBy: { level_order: 'asc' },
    });
    return roles.map((r) => ({
      ...r,
      id: r.id.toString(),
    }));
  }
}
