import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { deduction_types_deduction_mode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { generateUUID } from '../common/utils/uuid.util';
import {
  DEFAULT_OVERTIME_BONUS_PER_DAY,
  DEFAULT_WORK_HOURS_PER_DAY,
} from '../common/utils/payroll-calc.util';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const RWANDA_TIMEZONE = 'Africa/Kigali';
const DEFAULT_PIT_RATE = 15;
const PIT_DISPLAY_NAME = 'Personal Income Tax (PIT)';

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
        updated_at: new Date(),
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
      orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
    });

    const uniqueTaxes: Record<string, any> = {};
    taxes.forEach((t) => {
      const isPit = this.isPitTaxName(t.name);
      const key = isPit ? PIT_DISPLAY_NAME : t.name.trim();
      if (!uniqueTaxes[key]) {
        uniqueTaxes[key] = {
          ...t,
          id: t.id.toString(),
          name: key,
          rate: Number(t.rate),
          is_automatic: isPit,
          applies_to: isPit ? 'MONTHLY_EMPLOYEES' : 'EMPLOYEE_ASSIGNED',
        };
      }
    });

    if (!Object.values(uniqueTaxes).some((tax: any) => tax.is_automatic)) {
      uniqueTaxes[PIT_DISPLAY_NAME] = this.defaultPitTax();
    }

    await Promise.all(
      Object.values(uniqueTaxes)
        .filter((tax: any) => !tax.is_automatic)
        .map((tax: any) =>
          this.upsertDeductionTypeForTax(
            this.prisma,
            tax.name,
            Number(tax.rate),
          ),
        ),
    );

    return Object.values(uniqueTaxes);
  }

  async findMonthlyTaxesAtDate(date: Date) {
    const taxes = await this.prisma.monthly_taxes.findMany({
      where: {
        is_active: true,
        effective_from: { lte: date },
      },
      orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
    });

    const pitTax = taxes.find((tax) => this.isPitTaxName(tax.name));
    return pitTax
      ? [
          {
            ...pitTax,
            id: pitTax.id.toString(),
            name: PIT_DISPLAY_NAME,
            rate: Number(pitTax.rate),
            is_automatic: true,
            applies_to: 'MONTHLY_EMPLOYEES',
          },
        ]
      : [this.defaultPitTax()];
  }

  async findEmployeeAssignedMonthlyTaxesAtDate(date: Date) {
    const taxes = await this.prisma.monthly_taxes.findMany({
      where: {
        is_active: true,
        effective_from: { lte: date },
      },
      orderBy: [{ effective_from: 'desc' }, { created_at: 'desc' }],
    });

    const uniqueTaxes: Record<string, any> = {};
    taxes.forEach((tax) => {
      if (this.isPitTaxName(tax.name)) return;
      const key = tax.name.trim();
      if (uniqueTaxes[key]) return;
      uniqueTaxes[key] = {
        ...tax,
        id: tax.id.toString(),
        name: key,
        rate: Number(tax.rate),
        is_automatic: false,
        applies_to: 'EMPLOYEE_ASSIGNED',
      };
    });

    return Object.values(uniqueTaxes);
  }

  async updateMonthlyTax(name: string, rate: number) {
    const trimmedName = name?.trim();
    const numericRate = Number(rate);

    if (!trimmedName) {
      throw new BadRequestException('Tax name is required.');
    }

    if (!Number.isFinite(numericRate) || numericRate < 0 || numericRate > 100) {
      throw new BadRequestException(
        'Tax rate must be a number between 0 and 100.',
      );
    }

    const now = dayjs().tz(RWANDA_TIMEZONE);
    let effectiveFrom: Date;

    if (now.date() === 1) {
      effectiveFrom = now.startOf('day').toDate();
    } else {
      effectiveFrom = now.add(1, 'month').startOf('month').toDate();
    }

    const tax = await this.prisma.$transaction(async (tx) => {
      const createdTax = await tx.monthly_taxes.create({
        data: {
          uuid: generateUUID(),
          name: this.isPitTaxName(trimmedName) ? PIT_DISPLAY_NAME : trimmedName,
          rate: numericRate,
          effective_from: effectiveFrom,
          is_active: true,
          updated_at: new Date(),
        },
      });

      if (!this.isPitTaxName(createdTax.name)) {
        await this.upsertDeductionTypeForTax(tx, createdTax.name, numericRate);
      }

      return createdTax;
    });

    return {
      ...tax,
      id: tax.id.toString(),
      rate: Number(tax.rate),
      is_automatic: this.isPitTaxName(tax.name),
      applies_to: this.isPitTaxName(tax.name)
        ? 'MONTHLY_EMPLOYEES'
        : 'EMPLOYEE_ASSIGNED',
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
      is_automatic: this.isPitTaxName(tax.name),
      applies_to: this.isPitTaxName(tax.name)
        ? 'MONTHLY_EMPLOYEES'
        : 'EMPLOYEE_ASSIGNED',
    };
  }

  /**
   * Hourly overtime rate (RWF) paid for each overtime hour entered in
   * attendance. Configurable via System Config key OVERTIME_RATE_PER_HOUR.
   */
  async getOvertimeBonusPerDay(): Promise<number> {
    const config = await this.prisma.system_config.findUnique({
      where: { key: 'OVERTIME_RATE_PER_HOUR' },
    });

    if (
      !config ||
      config.value === null ||
      config.value === undefined ||
      config.value === ''
    ) {
      return DEFAULT_OVERTIME_BONUS_PER_DAY;
    }

    const parsed = Number(config.value);
    return Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_OVERTIME_BONUS_PER_DAY;
  }

  /**
   * Legacy default working hours per day. Kept for backward compatibility
   * with older total-hours calculations; new attendance stores overtime_hours
   * directly.
   */
  async getDefaultWorkHours(): Promise<number> {
    const config = await this.prisma.system_config.findUnique({
      where: { key: 'DEFAULT_WORK_HOURS' },
    });

    if (
      !config ||
      config.value === null ||
      config.value === undefined ||
      config.value === ''
    ) {
      return DEFAULT_WORK_HOURS_PER_DAY;
    }

    const parsed = Number(config.value);
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_WORK_HOURS_PER_DAY;
  }

  private isPitTaxName(name: string) {
    const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
    return (
      normalized === 'pit' ||
      normalized.includes('personalincometax') ||
      normalized.includes('paye')
    );
  }

  private async upsertDeductionTypeForTax(
    tx: { deduction_types: { upsert: (args: any) => Promise<any> } },
    name: string,
    rate: number,
  ) {
    await tx.deduction_types.upsert({
      where: { name },
      update: {
        deduction_mode: deduction_types_deduction_mode.PERCENTAGE,
        amount: '0',
        percentage_value: rate,
        updated_at: new Date(),
      },
      create: {
        uuid: generateUUID(),
        name,
        deduction_mode: deduction_types_deduction_mode.PERCENTAGE,
        amount: '0',
        percentage_value: rate,
        is_mandatory: false,
        updated_at: new Date(),
      },
    });
  }

  private defaultPitTax() {
    return {
      id: null,
      uuid: 'default-pit',
      name: PIT_DISPLAY_NAME,
      rate: DEFAULT_PIT_RATE,
      effective_from: dayjs().tz(RWANDA_TIMEZONE).startOf('month').toDate(),
      is_active: true,
      is_automatic: true,
      created_at: null,
      updated_at: null,
      applies_to: 'MONTHLY_EMPLOYEES',
    };
  }
}
