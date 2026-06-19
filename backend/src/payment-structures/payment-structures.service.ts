import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ACTIVITY_TYPE, AUDIT_ACTION, EMPLOYMENT_TYPE } from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { calculateRwandaPaye } from '../common/utils/tax.util';

// DTOs
import { CreatePaymentStructureDto } from './dto/create-payment-structure.dto';
import { UpdatePaymentStructureDto } from './dto/update-payment-structure.dto';
import { CreateDeductionTypeDto } from './dto/create-deduction-type.dto';
import { UpdateDeductionTypeDto } from './dto/update-deduction-type.dto';
import { CreateEmployeeDeductionDto } from './dto/create-employee-deduction.dto';
import { UpdateEmployeeDeductionDto } from './dto/update-employee-deduction.dto';
import { CreateAllowanceDto } from './dto/create-allowance.dto';

@Injectable()
export class PaymentStructuresService {
  constructor(private readonly prisma: PrismaService) {}

  /* =====================================================
   * UTILITIES
   * ===================================================== */

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(
        `Please choose a valid ${fieldName.replace('_', ' ')}.`,
      );
    }
    return BigInt(value);
  }

  private async ensureEmployee(employeeId: bigint) {
    const employee = await this.prisma.employees.findFirst({
      where: { id: employeeId, deleted_at: null },
      select: { id: true },
    });

    if (!employee) {
      throw new BadRequestException('Employee does not exist.');
    }
  }

  /* =====================================================
   * PAYMENT STRUCTURES
   * ===================================================== */

  async create(dto: CreatePaymentStructureDto, actor: CurrentUserType) {
    const employeeId = this.toBigInt(dto.employee_id, 'employee_id');
    const effectiveFrom = new Date(dto.effective_from);

    await this.ensureEmployee(employeeId);

    const overlapping = await this.prisma.payment_structures.findFirst({
      where: {
        employee_id: employeeId,
        OR: [
          {
            // Overlaps with a closed period
            AND: [
              { effective_to: { not: null } },
              { effective_from: { lte: effectiveFrom } },
              { effective_to: { gte: effectiveFrom } },
            ],
          },
          {
            // Overlaps with an active period starting in the future
            effective_to: null,
            effective_from: { gt: effectiveFrom },
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        'Salary period overlaps an existing structure.',
      );
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
          custom_work_days: dto.custom_work_days,
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
        },
      });

      return created;
    });

    return this.serialize(structure);
  }

  async update(
    uuid: string,
    dto: UpdatePaymentStructureDto,
    actor: CurrentUserType,
  ) {
    const existing = await this.findByUuidOrThrow(uuid);

    const updated = await this.prisma.payment_structures.update({
      where: { id: existing.id },
      data: {
        payroll_frequency: dto.payroll_frequency,
        basic_salary: dto.basic_salary,
        daily_rate: dto.daily_rate,
        overtime_rate: dto.overtime_rate,
        tax_percentage: dto.tax_percentage,
        custom_work_days: dto.custom_work_days,
        effective_to: dto.effective_to ? new Date(dto.effective_to) : undefined,
      },
      include: { employee: true },
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

    return structures.map((s) => this.serialize(s));
  }

  async findActiveByEmployee(employeeIdInput: string) {
    const employeeId = this.toBigInt(employeeIdInput, 'employee_id');

    const structure = await this.prisma.payment_structures.findFirst({
      where: { employee_id: employeeId, effective_to: null },
      include: { employee: true },
    });

    if (!structure) {
      throw new NotFoundException('Active payment structure not found.');
    }

    return this.serialize(structure);
  }

  async findPaymentCategories() {
    const categories = await this.prisma.employment_categories.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });

    return categories.map((category) => ({
      ...category,
      id: category.id.toString(),
    }));
  }

  calculatePayeTax(grossSalary: number) {
    const tax = calculateRwandaPaye(grossSalary);
    return {
      gross_salary: grossSalary,
      paye_tax: tax,
      net_after_paye: grossSalary - tax,
    };
  }

  private async findByUuidOrThrow(uuid: string) {
    const structure = await this.prisma.payment_structures.findUnique({
      where: { uuid },
    });

    if (!structure) {
      throw new NotFoundException('Payment structure not found.');
    }

    return structure;
  }

  /* =====================================================
   * SERIALIZATION - PAYMENT STRUCTURE
   * ===================================================== */

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
            created_by: structure.employee.created_by?.toString() ?? null,
            department_id: structure.employee.department_id?.toString() ?? null,
            working_location_id:
              structure.employee.working_location_id?.toString() ?? null,
            employment_category_id:
              structure.employee.employment_category_id?.toString() ?? null,
          }
        : undefined,
    };
  }

  /* =====================================================
   * DEDUCTION TYPES
   * ===================================================== */

  async createDeductionType(
    dto: CreateDeductionTypeDto,
    actor: CurrentUserType,
  ) {
    const exists = await this.prisma.deduction_types.findFirst({
      where: { name: dto.name },
    });

    if (exists) {
      throw new BadRequestException('Deduction type already exists.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const deductionType = await tx.deduction_types.create({
        data: {
          uuid: generateUUID(),
          name: dto.name,
          deduction_mode: dto.deduction_mode,
          amount: dto.amount ?? '0',
          percentage_value: dto.percentage_value ?? '0',
          is_mandatory: dto.is_mandatory ?? false,
        },
      });

      if (deductionType.is_mandatory) {
        await this.applyMandatoryDeductionTypeFromNextMonth(
          tx,
          deductionType.id,
        );
      }

      return deductionType;
    });

    return this.serializeDeductionType(created);
  }

  async findDeductionTypes() {
    const types = await this.prisma.deduction_types.findMany({
      orderBy: { created_at: 'desc' },
    });

    return types.map((t) => this.serializeDeductionType(t));
  }

  async updateDeductionType(
    uuid: string,
    dto: UpdateDeductionTypeDto,
    actor: CurrentUserType,
  ) {
    const existing = await this.prisma.deduction_types.findUnique({
      where: { uuid },
    });

    if (!existing) {
      throw new NotFoundException('Deduction type not found.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const deductionType = await tx.deduction_types.update({
        where: { id: existing.id },
        data: dto,
      });

      if (dto.is_mandatory === true && !existing.is_mandatory) {
        await this.applyMandatoryDeductionTypeFromNextMonth(
          tx,
          deductionType.id,
        );
      }

      return deductionType;
    });

    return this.serializeDeductionType(updated);
  }

  private async applyMandatoryDeductionTypeFromNextMonth(
    tx: any,
    deductionTypeId: bigint,
  ) {
    const now = new Date();
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    const employees = await tx.employees.findMany({
      where: { status: 'ACTIVE', deleted_at: null },
      select: { id: true },
    });

    for (const employee of employees) {
      const existing = await tx.employee_deductions.findFirst({
        where: {
          employee_id: employee.id,
          deduction_type_id: deductionTypeId,
          is_active: true,
        },
        select: { id: true },
      });

      if (existing) continue;

      await tx.employee_deductions.create({
        data: {
          uuid: generateUUID(),
          employee_id: employee.id,
          deduction_type_id: deductionTypeId,
          start_date: startDate,
          is_active: true,
        },
      });
    }
  }

  /* =====================================================
   * EMPLOYEE DEDUCTIONS
   * ===================================================== */

  async createEmployeeDeduction(
    dto: CreateEmployeeDeductionDto,
    actor: CurrentUserType,
  ) {
    const employeeId = this.toBigInt(dto.employee_id, 'employee_id');
    const deductionTypeId = this.toBigInt(
      dto.deduction_type_id,
      'deduction_type_id',
    );

    await this.ensureEmployee(employeeId);

    const deductionType = await this.prisma.deduction_types.findFirst({
      where: { id: deductionTypeId },
    });

    if (!deductionType) {
      throw new BadRequestException('Deduction type does not exist.');
    }

    const created = await this.prisma.employee_deductions.create({
      data: {
        uuid: generateUUID(),
        employee_id: employeeId,
        deduction_type_id: deductionTypeId,
        start_date: new Date(dto.start_date),
        end_date: dto.end_date ? new Date(dto.end_date) : null,
        is_active: dto.is_active ?? true,
      },
      include: { deduction_type: true },
    });

    return this.serializeEmployeeDeduction(created);
  }

  /* =====================================================
   * ALLOWANCES
   * ===================================================== */

  async createAllowance(dto: CreateAllowanceDto, actor: CurrentUserType) {
    const employeeId = this.toBigInt(dto.employee_id, 'employee_id');
    await this.ensureEmployee(employeeId);
    await this.ensureEmployeeCanReceiveAllowance(employeeId);

    const created = await this.prisma.allowances.create({
      data: {
        uuid: generateUUID(),
        employee_id: employeeId,
        title: dto.title,
        amount: dto.amount,
        description: dto.description,
      },
    });

    await this.prisma.audit_logs.create({
      data: {
        user_id: BigInt(actor.userId),
        employee_id: employeeId,
        entity_table: 'allowances',
        entity_id: created.id,
        module_name: 'PAYMENT_STRUCTURES',
        activity_type: ACTIVITY_TYPE.CREATE,
        activity_description: 'Created employee allowance.',
        action: AUDIT_ACTION.CREATED,
      },
    });

    return this.serializeAllowance(created);
  }

  async findAllowances(employeeIdInput: string) {
    const employeeId = this.toBigInt(employeeIdInput, 'employee_id');

    const allowances = await this.prisma.allowances.findMany({
      where: { employee_id: employeeId },
      orderBy: { created_at: 'desc' },
    });

    return allowances.map((allowance) => this.serializeAllowance(allowance));
  }

  async deactivateAllowance(uuid: string, actor: CurrentUserType) {
    const existing = await this.prisma.allowances.findUnique({
      where: { uuid },
    });

    if (!existing) {
      throw new NotFoundException('Allowance not found.');
    }

    const updated = await this.prisma.allowances.update({
      where: { id: existing.id },
      data: { is_active: false },
    });

    await this.prisma.audit_logs.create({
      data: {
        user_id: BigInt(actor.userId),
        employee_id: existing.employee_id,
        entity_table: 'allowances',
        entity_id: existing.id,
        module_name: 'PAYMENT_STRUCTURES',
        activity_type: ACTIVITY_TYPE.UPDATE,
        activity_description: 'Deactivated employee allowance.',
        action: AUDIT_ACTION.UPDATED,
      },
    });

    return this.serializeAllowance(updated);
  }

  async updateAllowance(
    uuid: string,
    dto: Partial<CreateAllowanceDto>,
    actor: CurrentUserType,
  ) {
    const existing = await this.prisma.allowances.findUnique({
      where: { uuid },
    });

    if (!existing) {
      throw new NotFoundException('Allowance not found.');
    }

    const updated = await this.prisma.allowances.update({
      where: { id: existing.id },
      data: {
        title: dto.title,
        amount: dto.amount,
        description: dto.description,
      },
    });

    await this.prisma.audit_logs.create({
      data: {
        user_id: BigInt(actor.userId),
        employee_id: existing.employee_id,
        entity_table: 'allowances',
        entity_id: existing.id,
        module_name: 'PAYMENT_STRUCTURES',
        activity_type: ACTIVITY_TYPE.UPDATE,
        activity_description: 'Updated employee allowance.',
        action: AUDIT_ACTION.UPDATED,
      },
    });

    return this.serializeAllowance(updated);
  }

  async findEmployeeDeductions(employeeIdInput: string) {
    const employeeId = this.toBigInt(employeeIdInput, 'employee_id');

    const deductions = await this.prisma.employee_deductions.findMany({
      where: { employee_id: employeeId },
      include: { deduction_type: true },
      orderBy: { created_at: 'desc' },
    });

    return deductions.map((d) => this.serializeEmployeeDeduction(d));
  }

  async updateEmployeeDeduction(
    uuid: string,
    dto: UpdateEmployeeDeductionDto,
    actor: CurrentUserType,
  ) {
    const existing = await this.prisma.employee_deductions.findUnique({
      where: { uuid },
    });

    if (!existing) {
      throw new NotFoundException('Employee deduction not found.');
    }

    const updated = await this.prisma.employee_deductions.update({
      where: { id: existing.id },
      data: {
        start_date: dto.start_date ? new Date(dto.start_date) : undefined,
        end_date: dto.end_date ? new Date(dto.end_date) : undefined,
        is_active: dto.is_active,
      },
      include: { deduction_type: true },
    });

    await this.prisma.audit_logs.create({
      data: {
        user_id: BigInt(actor.userId),
        employee_id: existing.employee_id,
        entity_table: 'employee_deductions',
        entity_id: existing.id,
        module_name: 'PAYMENT_STRUCTURES',
        activity_type: ACTIVITY_TYPE.UPDATE,
        activity_description: 'Updated employee deduction.',
        action: AUDIT_ACTION.UPDATED,
      },
    });

    return this.serializeEmployeeDeduction(updated);
  }

  async deleteEmployeeDeduction(uuid: string, actor: CurrentUserType) {
    const existing = await this.prisma.employee_deductions.findUnique({
      where: { uuid },
    });

    if (!existing) {
      throw new NotFoundException('Employee deduction not found.');
    }

    await this.prisma.employee_deductions.update({
      where: { id: existing.id },
      data: {
        is_active: false,
        end_date: new Date(),
      },
    });

    await this.prisma.audit_logs.create({
      data: {
        user_id: BigInt(actor.userId),
        employee_id: existing.employee_id,
        entity_table: 'employee_deductions',
        entity_id: existing.id,
        module_name: 'PAYMENT_STRUCTURES',
        activity_type: ACTIVITY_TYPE.DELETE,
        activity_description: 'Deactivated employee deduction.',
        action: AUDIT_ACTION.DELETED,
      },
    });

    return {
      message: 'Employee deduction deactivated successfully.',
    };
  }

  /* =====================================================
   * SERIALIZATION - DEDUCTIONS
   * ===================================================== */

  private serializeDeductionType(type: Record<string, any>) {
    return {
      ...type,
      id: type.id.toString(),
      amount: type.amount.toString(),
      percentage_value: type.percentage_value.toString(),
    };
  }

  private serializeEmployeeDeduction(deduction: Record<string, any>) {
    return {
      ...deduction,
      id: deduction.id.toString(),
      employee_id: deduction.employee_id.toString(),
      deduction_type_id: deduction.deduction_type_id.toString(),
      deduction_type: deduction.deduction_type
        ? this.serializeDeductionType(deduction.deduction_type)
        : undefined,
    };
  }

  private async ensureEmployeeCanReceiveAllowance(employeeId: bigint) {
    const structure = await this.prisma.payment_structures.findFirst({
      where: { employee_id: employeeId, effective_to: null },
      orderBy: { effective_from: 'desc' },
    });

    if (!structure) {
      throw new BadRequestException(
        'Create an active payment structure before assigning allowances.',
      );
    }

    const canReceive =
      structure.payroll_frequency === EMPLOYMENT_TYPE.MONTHLY ||
      (structure.payroll_frequency === EMPLOYMENT_TYPE.CUSTOM &&
        (structure.custom_work_days ?? 0) > 21);

    if (!canReceive) {
      throw new BadRequestException(
        'Allowances only apply to monthly employees or custom contracts above 21 days.',
      );
    }
  }

  private serializeAllowance(allowance: Record<string, any>) {
    return {
      ...allowance,
      id: allowance.id.toString(),
      employee_id: allowance.employee_id.toString(),
      amount: allowance.amount.toString(),
    };
  }
}
