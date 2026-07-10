import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { generateUUID } from '../common/utils/uuid.util';
import { DEFAULT_OVERTIME_RATE_PER_HOUR } from '../common/utils/payroll-calc.util';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const RWANDA_TIMEZONE = 'Africa/Kigali';

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

  async getAllMonthlyTaxes() {
    const taxes = await this.prisma.monthly_taxes.findMany({
      where: { is_active: true },
      orderBy: [{ name: 'asc' }, { effective_from: 'desc' }],
    });

    const uniqueTaxes: Record<string, any> = {};
    taxes.forEach((t) => {
      if (!uniqueTaxes[t.name]) {
        uniqueTaxes[t.name] = {
          ...t,
          id: t.id.toString(),
          rate: Number(t.rate),
        };
      }
    });
    return Object.values(uniqueTaxes);
  }

  async findMonthlyTaxesAtDate(date: Date) {
    const taxes = await this.prisma.monthly_taxes.findMany({
      where: {
        is_active: true,
        effective_from: { lte: date },
      },
      orderBy: [{ name: 'asc' }, { effective_from: 'desc' }],
    });

    const latestTaxes: Record<string, any> = {};
    taxes.forEach((t) => {
      if (!latestTaxes[t.name]) {
        latestTaxes[t.name] = {
          ...t,
          id: t.id.toString(),
          rate: Number(t.rate),
        };
      }
    });

    return Object.values(latestTaxes);
  }

  async updateMonthlyTax(name: string, rate: number) {
    const now = dayjs().tz(RWANDA_TIMEZONE);
    let effectiveFrom: Date;

    if (now.date() === 1) {
      effectiveFrom = now.startOf('day').toDate();
    } else {
      effectiveFrom = now.add(1, 'month').startOf('month').toDate();
    }

    const tax = await this.prisma.monthly_taxes.create({
      data: {
        uuid: generateUUID(),
        name,
        rate,
        effective_from: effectiveFrom,
        is_active: true,
      },
    });

    return {
      ...tax,
      id: tax.id.toString(),
      rate: Number(tax.rate),
    };
  }

  async deactivateMonthlyTax(uuid: string) {
    const tax = await this.prisma.monthly_taxes.update({
      where: { uuid },
      data: { is_active: false },
    });

    return {
      ...tax,
      id: tax.id.toString(),
      rate: Number(tax.rate),
    };
  }

  
  async getOvertimeRatePerHour(): Promise<number> {
    const config = await this.prisma.system_config.findUnique({
      where: { key: 'OVERTIME_RATE_PER_HOUR' },
    });

    if (!config || config.value === null || config.value === undefined || config.value === '') {
      return DEFAULT_OVERTIME_RATE_PER_HOUR;
    }

    const parsed = Number(config.value);
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_OVERTIME_RATE_PER_HOUR;
  }
}
