import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ACTIVITY_TYPE, AUDIT_ACTION } from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentStructureDto } from './dto/create-payment-structure.dto';
import { UpdatePaymentStructureDto } from './dto/update-payment-structure.dto';

@Injectable()
export class PaymentStructuresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentStructureDto, actor: CurrentUserType) {
    const employeeId = this.toBigInt(dto.employee_id, 'employee_id');
    const effectiveFrom = new Date(dto.effective_from);
    await this.ensureEmployee(employeeId);

    const overlapping = await this.prisma.payment_structures.findFirst({
      where: {
        employee_id: employeeId,
        effective_from: { lte: effectiveFrom },
        OR: [{ effective_to: null }, { effective_to: { gte: effectiveFrom } }],
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new BadRequestException('Salary period overlaps an existing structure.');
    }

    const structure = await this.prisma.$transaction(async (tx) => {
      await tx.payment_structures.updateMany({
        where: { employee_id: employeeId, effective_to: null },
        data: { effective_to: effectiveFrom },
      });

      const created = await tx.payment_structures.create({
        data: {
          uuid: generateUUID(),
          employee_id: employeeId,
          payroll_frequency: dto.payroll_frequency,
          basic_salary: dto.basic_salary,
          daily_rate: dto.daily_rate,
          overtime_rate: dto.overtime_rate,
          tax_percentage: dto.tax_percentage,
          effective_from: effectiveFrom,
        },
        include: { employee: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: employeeId,
          entity_table: 'payment_structures',
          entity_id: created.id,
          module_name: 'PAYMENT_STRUCTURES',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: 'Created employee payment structure.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            employee_id: employeeId.toString(),
            payroll_frequency: created.payroll_frequency,
            effective_from: effectiveFrom.toISOString(),
          },
        },
      });

      return created;
    });

    return this.serialize(structure);
  }

  async update(uuid: string, dto: UpdatePaymentStructureDto, actor: CurrentUserType) {
    const existing = await this.findByUuidOrThrow(uuid);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.payment_structures.update({
        where: { id: existing.id },
        data: {
          payroll_frequency: dto.payroll_frequency,
          basic_salary: dto.basic_salary,
          daily_rate: dto.daily_rate,
          overtime_rate: dto.overtime_rate,
          tax_percentage: dto.tax_percentage,
          effective_to: dto.effective_to ? new Date(dto.effective_to) : undefined,
        },
        include: { employee: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: existing.employee_id,
          entity_table: 'payment_structures',
          entity_id: existing.id,
          module_name: 'PAYMENT_STRUCTURES',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated employee payment structure.',
          action: AUDIT_ACTION.UPDATED,
          new_values: { ...dto },
          changed_fields: Object.keys(dto),
        },
      });

      return saved;
    });

    return this.serialize(updated);
  }

  async findByEmployee(employeeIdInput: string) {
    const employeeId = this.toBigInt(employeeIdInput, 'employee_id');
    const structures = await this.prisma.payment_structures.findMany({
      where: { employee_id: employeeId },
      include: { employee: true },
      orderBy: { effective_from: 'desc' },
    });

    return structures.map((structure) => this.serialize(structure));
  }

  async findActiveByEmployee(employeeIdInput: string) {
    const employeeId = this.toBigInt(employeeIdInput, 'employee_id');
    const structure = await this.prisma.payment_structures.findFirst({
      where: { employee_id: employeeId, effective_to: null },
      include: { employee: true },
      orderBy: { effective_from: 'desc' },
    });

    if (!structure) throw new NotFoundException('Active payment structure not found.');

    return this.serialize(structure);
  }

  private async findByUuidOrThrow(uuid: string) {
    const structure = await this.prisma.payment_structures.findUnique({ where: { uuid } });

    if (!structure) throw new NotFoundException('Payment structure not found.');

    return structure;
  }

  private async ensureEmployee(employeeId: bigint) {
    const employee = await this.prisma.employees.findFirst({
      where: { id: employeeId, deleted_at: null },
      select: { id: true },
    });

    if (!employee) throw new BadRequestException('Employee does not exist.');
  }

  private serialize(structure: Record<string, any>) {
    return {
      ...structure,
      id: structure.id.toString(),
      employee_id: structure.employee_id.toString(),
      basic_salary: structure.basic_salary.toString(),
      daily_rate: structure.daily_rate.toString(),
      overtime_rate: structure.overtime_rate.toString(),
      tax_percentage: structure.tax_percentage.toString(),
      employee: structure.employee
        ? {
            ...structure.employee,
            id: structure.employee.id.toString(),
            user_id: structure.employee.user_id?.toString() ?? null,
            department_id: structure.employee.department_id?.toString() ?? null,
            working_location_id: structure.employee.working_location_id?.toString() ?? null,
            employment_category_id:
              structure.employee.employment_category_id?.toString() ?? null,
          }
        : undefined,
    };
  }

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(`${fieldName} must be a numeric id.`);
    }

    return BigInt(value);
  }
}
