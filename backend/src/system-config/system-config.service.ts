import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { generateUUID } from '../common/utils/uuid.util';

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const configs = await this.prisma.system_config.findMany();
    return configs.map((config) => ({
      ...config,
      id: config.id.toString(),
    }));
  }

  async findByKey(key: string) {
    const config = await this.prisma.system_config.findUnique({
      where: { key },
    });
    if (!config) {
      throw new NotFoundException(`Config with key ${key} not found`);
    }
    return {
      ...config,
      id: config.id.toString(),
    };
  }

  async update(dto: UpdateConfigDto) {
    const config = await this.prisma.system_config.upsert({
      where: { key: dto.key },
      update: {
        value: dto.value,
        description: dto.description,
      },
      create: {
        uuid: generateUUID(),
        key: dto.key,
        value: dto.value,
        description: dto.description,
      },
    });
    return {
      ...config,
      id: config.id.toString(),
    };
  }

  async updateBatch(configs: UpdateConfigDto[]) {
    const results: any[] = [];
    for (const dto of configs) {
      const result = await this.update(dto);
      results.push(result);
    }
    return results;
  }
}
