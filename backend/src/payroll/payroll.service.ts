import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import {
  ACTIVITY_TYPE,
  AUDIT_ACTION,
  APPROVAL_ACTION,
  EMPLOYMENT_TYPE,
  PAYMENT_BATCH_STATUS,
  STATUS_USER,
  TRANSACTION_STATUS,
} from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import {
  isNumericId,
  normalizeSearch,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovePayrollItemDto } from './dto/approve-payroll-item.dto';
import { CreatePayrollBatchDto } from './dto/create-payroll-batch.dto';
import { RejectPayrollItemDto } from './dto/reject-payroll-item.dto';

type PayrollCalculation = {
  employeeId: bigint;
  paymentStructureId: bigint;
  baseAmount: number;
  allowanceAmount: number;
  taxAmount: number;
  attendanceDays: number;
  payrollWorkDays: number | null;
  payrollStartDate: Date;
  payrollEndDate: Date;
  metadata: Record<string, any>;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
};

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  async createBatch(dto: CreatePayrollBatchDto, actor: CurrentUserType) {
    const workingLocationId = await this.resolveWorkingLocationId(
      dto.working_location_id,
    );
    await this.ensureWorkingLocation(workingLocationId);
    this.ensureActorCanUseWorkingLocation(actor, workingLocationId);

    const employees = await this.prisma.employees.findMany({
      where: {
        working_location_id: workingLocationId,
        status: STATUS_USER.ACTIVE,
        deleted_at: null,
      },
    });

    if (!employees.length) {
      throw new BadRequestException(
        'No active employees found for this working location.',
      );
    }

    const calculations: PayrollCalculation[] = [];

    for (const employee of employees) {
      const calculation = await this.calculateEmployeePayroll(
        employee,
        dto,
      );

      if (calculation) calculations.push(calculation);
    }

    if (!calculations.length) {
      throw new BadRequestException(
        'No employees have active payment structures for this period.',
      );
    }

    const totalAmount = calculations.reduce(
      (sum, item) => sum + item.netAmount,
      0,
    );
    const totalGross = calculations.reduce(
      (sum, item) => sum + item.grossAmount,
      0,
    );
    const totalAllowances = calculations.reduce(
      (sum, item) => sum + item.allowanceAmount,
      0,
    );
    const totalDeductions = calculations.reduce(
      (sum, item) => sum + item.totalDeductions,
      0,
    );
    const totalTax = calculations.reduce((sum, item) => sum + item.taxAmount, 0);
    const batchCode = `PAY-${dto.payroll_year}-${dto.payroll_month
      .toString()
      .padStart(2, '0')}-${Date.now()}`;

    const batch = await this.prisma.$transaction(async (tx) => {
      const createdBatch = await tx.payment_batches.create({
        data: {
          uuid: generateUUID(),
          batch_code: batchCode,
          working_location_id: workingLocationId,
          payroll_month: dto.payroll_month,
          payroll_year: dto.payroll_year,
          total_employees: calculations.length,
          total_amount: totalAmount,
          total_gross: totalGross,
          total_allowances: totalAllowances,
          total_deductions: totalDeductions,
          total_tax: totalTax,
          status: PAYMENT_BATCH_STATUS.PENDING,
          submitted_by: BigInt(actor.userId),
          submitted_at: new Date(),
        },
      });

      for (const calculation of calculations) {
        const transaction = await tx.transactions.create({
          data: {
            uuid: generateUUID(),
            employee_id: calculation.employeeId,
            payment_structure_id: calculation.paymentStructureId,
            payroll_month: dto.payroll_month,
            payroll_year: dto.payroll_year,
            gross_amount: calculation.grossAmount,
            base_amount: calculation.baseAmount,
            allowance_amount: calculation.allowanceAmount,
            tax_amount: calculation.taxAmount,
            attendance_days: calculation.attendanceDays,
            payroll_work_days: calculation.payrollWorkDays,
            payroll_start_date: calculation.payrollStartDate,
            payroll_end_date: calculation.payrollEndDate,
            calculation_metadata: calculation.metadata,
            total_deductions: calculation.totalDeductions,
            net_amount: calculation.netAmount,
            payment_date: new Date(dto.payment_date),
            payment_method: dto.payment_method,
            transaction_status: TRANSACTION_STATUS.PENDING,
          },
        });

        await tx.payment_batch_items.create({
          data: {
            uuid: generateUUID(),
            payment_batch_id: createdBatch.id,
            employee_id: calculation.employeeId,
            transaction_id: transaction.id,
            status: PAYMENT_BATCH_STATUS.PENDING,
          },
        });
      }

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'payment_batches',
          entity_id: createdBatch.id,
          module_name: 'PAYROLL',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: 'Created payroll batch.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            batch_code: batchCode,
            working_location_id: workingLocationId.toString(),
            payroll_month: dto.payroll_month,
            payroll_year: dto.payroll_year,
            total_employees: calculations.length,
            total_amount: totalAmount,
            total_gross: totalGross,
            total_allowances: totalAllowances,
            total_deductions: totalDeductions,
            total_tax: totalTax,
          },
        },
      });

      return tx.payment_batches.findUniqueOrThrow({
        where: { id: createdBatch.id },
        include: this.batchIncludes(),
      });
    });

    // Invalidate payroll batches cache when a new batch is created
    await this.cacheManager.del('payroll:batches');

    await this.notificationsService.notifyBranchManager(workingLocationId, {
      senderId: actor.userId,
      title: 'Payroll Batch Submitted',
      message: `${batch.batch_code} is awaiting manager approval.`,
      type: 'PAYROLL_APPROVAL_REQUEST',
      referenceId: batch.uuid,
      metadata: {
        redirect: `/admin/admin/payroll/${batch.uuid}`,
        level: 'MANAGER',
        status: batch.status,
      },
    });

    return this.serializeBatch(batch);
  }

  // Retrieve payroll batches with scoping and caching
  async findBatches(actor: CurrentUserType, qInput?: string) {
    const q = normalizeSearch(qInput);
    const cacheKey = `payroll:batches:${actor.userId}:${actor.working_location_id ?? ''}:${q ?? ''}`;

    // Check if result is in cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const batches = await this.prisma.payment_batches.findMany({
      where: {
        ...this.batchScopeWhere(actor),
        ...(q ? { batch_code: { contains: q } } : {}),
      },
      include: this.batchIncludes(),
      orderBy: { created_at: 'desc' },
    });

    const result = batches.map((batch) => this.serializeBatch(batch));

    // Store results in cache for 20 seconds
    await this.cacheManager.set(cacheKey, result, 20000);
    return result;
  }

  async findBatch(uuid: string, actor: CurrentUserType) {
    const batch = await this.prisma.payment_batches.findUnique({
      where: { uuid },
      include: this.batchIncludes(),
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');
    this.ensureActorCanUseWorkingLocation(actor, batch.working_location_id);

    return this.serializeBatch(batch);
  }

  async approveItem(
    uuid: string,
    dto: ApprovePayrollItemDto,
    actor: CurrentUserType,
  ) {
    const item = await this.findItemByUuidOrThrow(uuid);

    const approved = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.payment_batch_items.update({
        where: { id: item.id },
        data: {
          status: PAYMENT_BATCH_STATUS.APPROVED,
          approved_by: BigInt(actor.userId),
          approved_at: new Date(),
          rejection_reason: null,
        },
        include: this.itemIncludes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: item.employee_id,
          entity_table: 'payment_batch_items',
          entity_id: item.id,
          module_name: 'PAYROLL',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: dto.comment
            ? `Approved payroll item: ${dto.comment}`
            : 'Approved payroll item.',
          action: AUDIT_ACTION.APPROVED,
          new_values: { status: PAYMENT_BATCH_STATUS.APPROVED },
          changed_fields: ['status', 'approved_by', 'approved_at'],
        },
      });

      await this.recalculateBatchStatus(
        tx,
        item.payment_batch_id,
        BigInt(actor.userId),
      );

      return saved;
    });

    return this.serializeItem(approved);
  }

  async rejectItem(
    uuid: string,
    dto: RejectPayrollItemDto,
    actor: CurrentUserType,
  ) {
    const item = await this.findItemByUuidOrThrow(uuid);

    const rejected = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.payment_batch_items.update({
        where: { id: item.id },
        data: {
          status: PAYMENT_BATCH_STATUS.REJECTED,
          approved_by: BigInt(actor.userId),
          approved_at: new Date(),
          rejection_reason: dto.rejection_reason,
        },
        include: this.itemIncludes(),
      });

      await tx.transactions.update({
        where: { id: item.transaction_id },
        data: { transaction_status: TRANSACTION_STATUS.REJECTED },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: item.employee_id,
          entity_table: 'payment_batch_items',
          entity_id: item.id,
          module_name: 'PAYROLL',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: `Rejected payroll item: ${dto.rejection_reason}`,
          action: AUDIT_ACTION.DENIED,
          new_values: {
            status: PAYMENT_BATCH_STATUS.REJECTED,
            rejection_reason: dto.rejection_reason,
          },
          changed_fields: [
            'status',
            'rejection_reason',
            'approved_by',
            'approved_at',
          ],
        },
      });

      await this.recalculateBatchStatus(
        tx,
        item.payment_batch_id,
        BigInt(actor.userId),
      );

      return saved;
    });

    return this.serializeItem(rejected);
  }

  async approveBatch(
    uuid: string,
    dto: ApprovePayrollItemDto,
    actor: CurrentUserType,
  ) {
    const batch = await this.prisma.payment_batches.findUnique({
      where: { uuid },
      include: { working_location: true },
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');
    if (batch.status === PAYMENT_BATCH_STATUS.REJECTED) {
      throw new BadRequestException('Rejected batches cannot be approved.');
    }
    this.ensureActorCanApproveBatch(actor, batch);

    const finalStep = batch.working_location.type === 'HQ' ? 1 : 2;
    const nextStep = batch.current_approval_step + 1;
    const isFinal = batch.current_approval_step >= finalStep;

    const approved = await this.prisma.$transaction(async (tx) => {
      await tx.payroll_batch_approval_actions.create({
        data: {
          payment_batch_id: batch.id,
          step_order: batch.current_approval_step,
          action_by: BigInt(actor.userId),
          action: APPROVAL_ACTION.APPROVED,
          comment: dto.comment,
        },
      });

      const updated = await tx.payment_batches.update({
        where: { id: batch.id },
        data: {
          status: isFinal
            ? PAYMENT_BATCH_STATUS.APPROVED
            : PAYMENT_BATCH_STATUS.MANAGER_APPROVED,
          current_approval_step: isFinal
            ? batch.current_approval_step
            : nextStep,
          approved_by: isFinal ? BigInt(actor.userId) : null,
          approved_at: isFinal ? new Date() : null,
        },
        include: this.batchIncludes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'payment_batches',
          entity_id: batch.id,
          module_name: 'PAYROLL',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: `Approved payroll batch step ${batch.current_approval_step}.`,
          action: AUDIT_ACTION.APPROVED,
          new_values: {
            current_approval_step: updated.current_approval_step,
            status: updated.status,
          },
        },
      });

      return updated;
    });

    if (approved.status === PAYMENT_BATCH_STATUS.MANAGER_APPROVED) {
      await this.notificationsService.notifyAdmins({
        senderId: actor.userId,
        title: 'Payroll Batch Awaiting Admin Approval',
        message: `${approved.batch_code} was approved by the manager and needs final admin approval.`,
        type: 'PAYROLL_APPROVAL_REQUEST',
        referenceId: approved.uuid,
        metadata: {
          redirect: `/admin/admin/payroll/${approved.uuid}`,
          level: 'ADMIN',
          status: approved.status,
        },
      });
    } else if (approved.status === PAYMENT_BATCH_STATUS.APPROVED) {
      await this.notificationsService.create({
        userId: approved.submitted_by,
        senderId: actor.userId,
        title: 'Payroll Batch Finalized',
        message: `${approved.batch_code} has been fully approved.`,
        type: 'PAYROLL_APPROVED',
        referenceId: approved.uuid,
        metadata: {
          redirect: `/admin/admin/payroll/${approved.uuid}`,
          status: approved.status,
        },
      });
    }

    return this.serializeBatch(approved);
  }

  async rejectBatch(
    uuid: string,
    dto: RejectPayrollItemDto,
    actor: CurrentUserType,
  ) {
    const batch = await this.prisma.payment_batches.findUnique({
      where: { uuid },
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');

    const rejected = await this.prisma.$transaction(async (tx) => {
      await tx.payroll_batch_approval_actions.create({
        data: {
          payment_batch_id: batch.id,
          step_order: batch.current_approval_step,
          action_by: BigInt(actor.userId),
          action: APPROVAL_ACTION.REJECTED,
          comment: dto.rejection_reason,
        },
      });

      await tx.payment_batch_items.updateMany({
        where: {
          payment_batch_id: batch.id,
          status: PAYMENT_BATCH_STATUS.PENDING,
        },
        data: {
          status: PAYMENT_BATCH_STATUS.REJECTED,
          rejection_reason: dto.rejection_reason,
          approved_by: BigInt(actor.userId),
          approved_at: new Date(),
        },
      });

      const updated = await tx.payment_batches.update({
        where: { id: batch.id },
        data: {
          status: PAYMENT_BATCH_STATUS.REJECTED,
          rejected_reason: dto.rejection_reason,
          approved_by: BigInt(actor.userId),
          approved_at: new Date(),
        },
        include: this.batchIncludes(),
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'payment_batches',
          entity_id: batch.id,
          module_name: 'PAYROLL',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: `Rejected payroll batch: ${dto.rejection_reason}`,
          action: AUDIT_ACTION.DENIED,
          new_values: {
            status: PAYMENT_BATCH_STATUS.REJECTED,
            rejected_reason: dto.rejection_reason,
          },
        },
      });

      return updated;
    });

    await this.notificationsService.create({
      userId: rejected.submitted_by,
      senderId: actor.userId,
      title: 'Payroll Batch Rejected',
      message: `${rejected.batch_code} was rejected. Reason: ${dto.rejection_reason}`,
      type: 'PAYROLL_REJECTED',
      referenceId: rejected.uuid,
      metadata: {
        redirect: `/admin/admin/payroll/${rejected.uuid}`,
        reason: dto.rejection_reason,
      },
    });

    return this.serializeBatch(rejected);
  }

  private async resolveWorkingLocationId(value: string) {
    requireUuidOrNumeric(value, 'working_location_id');
    const workingLocation = await this.prisma.working_locations.findFirst({
      where: isNumericId(value)
        ? { id: BigInt(value), deleted_at: null }
        : { uuid: value, deleted_at: null },
      select: { id: true },
    });

    if (!workingLocation)
      throw new BadRequestException('Working location does not exist.');
    return workingLocation.id;
  }

  private async calculateEmployeePayroll(
    employee: {
      id: bigint;
      hire_date?: Date | null;
    },
    dto: CreatePayrollBatchDto,
  ): Promise<PayrollCalculation | null> {
    const month = dto.payroll_month;
    const year = dto.payroll_year;
    const periodStart = dto.start_date
      ? this.startOfDay(new Date(dto.start_date))
      : new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = dto.end_date
      ? this.endOfDay(new Date(dto.end_date))
      : new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    if (periodEnd < periodStart) {
      throw new BadRequestException('Payroll end date must be after start date.');
    }

    const paymentStructure = await this.prisma.payment_structures.findFirst({
      where: {
        employee_id: employee.id,
        effective_from: { lte: periodEnd },
        OR: [{ effective_to: null }, { effective_to: { gte: periodStart } }],
      },
      orderBy: { effective_from: 'desc' },
    });

    if (!paymentStructure) return null;

    const attendance = await this.prisma.time_records.findMany({
      where: {
        employee_id: employee.id,
        attendance_date: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const presentDays = attendance.filter(
      (record) => record.attendance_status === 'PRESENT',
    ).length;
    const overtimeHours = attendance.reduce(
      (sum, record) => sum + Number(record.overtime_hours),
      0,
    );

    const requestedWorkDays =
      dto.work_days ?? paymentStructure.custom_work_days ?? presentDays;
    const daysAfterPayrollStart = employee.hire_date
      ? this.diffCalendarDays(periodStart, employee.hire_date)
      : 0;
    const effectiveFrequency =
      paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.MONTHLY &&
      daysAfterPayrollStart > 8
        ? EMPLOYMENT_TYPE.DAILY
        : paymentStructure.payroll_frequency;
    const periodCalendarDays = Math.max(
      1,
      this.diffCalendarDays(periodStart, periodEnd) + 1,
    );

    let baseAmount = 0;

    const effectiveDailyRate =
      Number(paymentStructure.daily_rate) > 0
        ? Number(paymentStructure.daily_rate)
        : Number(paymentStructure.basic_salary) / periodCalendarDays;

    if (effectiveFrequency === EMPLOYMENT_TYPE.MONTHLY) {
      baseAmount = Number(paymentStructure.basic_salary);
    } else if (effectiveFrequency === EMPLOYMENT_TYPE.CUSTOM) {
      const customDays = Math.max(requestedWorkDays, 1);
      baseAmount = effectiveDailyRate * customDays;
    } else {
      baseAmount = effectiveDailyRate * presentDays;
    }

    const overtimeAmount =
      Number(paymentStructure.overtime_rate) * overtimeHours;
    const allowanceEligible =
      effectiveFrequency === EMPLOYMENT_TYPE.MONTHLY ||
      (effectiveFrequency === EMPLOYMENT_TYPE.CUSTOM &&
        (requestedWorkDays ?? 0) > 21);
    const allowances = allowanceEligible
      ? await this.prisma.allowances.findMany({
          where: { employee_id: employee.id, is_active: true },
        })
      : [];
    const allowanceAmount = allowances.reduce(
      (sum, allowance) => sum + Number(allowance.amount),
      0,
    );
    const grossAmount = baseAmount + overtimeAmount + allowanceAmount;

    const employeeDeductions = await this.prisma.employee_deductions.findMany({
      where: {
        employee_id: employee.id,
        is_active: true,
        start_date: { lte: periodEnd },
        OR: [{ end_date: null }, { end_date: { gte: periodStart } }],
      },
      include: { deduction_type: true },
    });

    const configuredDeductions = employeeDeductions.reduce((sum, deduction) => {
      if (deduction.deduction_type.deduction_mode === 'PERCENTAGE') {
        return (
          sum +
          grossAmount *
            (Number(deduction.deduction_type.percentage_value) / 100)
        );
      }

      return sum + Number(deduction.deduction_type.amount);
    }, 0);
    const taxExempt =
      effectiveFrequency === EMPLOYMENT_TYPE.CUSTOM &&
      (requestedWorkDays ?? 0) < 21;
    const taxAmount = taxExempt
      ? 0
      : grossAmount * (Number(paymentStructure.tax_percentage) / 100);
    const totalDeductions = configuredDeductions + taxAmount;
    const netAmount = Math.max(0, grossAmount - totalDeductions);

    return {
      employeeId: employee.id,
      paymentStructureId: paymentStructure.id,
      baseAmount,
      allowanceAmount,
      taxAmount,
      attendanceDays: presentDays,
      payrollWorkDays:
        effectiveFrequency === EMPLOYMENT_TYPE.CUSTOM ? requestedWorkDays : null,
      payrollStartDate: periodStart,
      payrollEndDate: periodEnd,
      metadata: {
        configured_frequency: paymentStructure.payroll_frequency,
        effective_frequency: effectiveFrequency,
        monthly_joiner_converted_to_daily:
          paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.MONTHLY &&
          effectiveFrequency === EMPLOYMENT_TYPE.DAILY,
        days_after_payroll_start: daysAfterPayrollStart,
        period_calendar_days: periodCalendarDays,
        overtime_hours: overtimeHours,
        allowance_eligible: allowanceEligible,
        allowance_titles: allowances.map((allowance) => allowance.title),
        custom_tax_exempt: taxExempt,
      },
      grossAmount,
      totalDeductions,
      netAmount,
    };
  }

  private async recalculateBatchStatus(
    tx: any,
    batchId: bigint,
    actorId: bigint,
  ) {
    const items = await tx.payment_batch_items.findMany({
      where: { payment_batch_id: batchId },
      select: { status: true },
    });

    if (!items.length) return;

    const hasPending = items.some(
      (item) => item.status === PAYMENT_BATCH_STATUS.PENDING,
    );
    if (hasPending) return;

    await tx.payment_batches.update({
      where: { id: batchId },
      data: {
        status: PAYMENT_BATCH_STATUS.IN_REVIEW,
      },
    });
  }

  private async ensureWorkingLocation(id: bigint) {
    const workingLocation = await this.prisma.working_locations.findFirst({
      where: { id, deleted_at: null },
      select: { id: true },
    });

    if (!workingLocation)
      throw new BadRequestException('Working location does not exist.');
  }

  private isSystemAdmin(actor: CurrentUserType) {
    return actor.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role));
  }

  private batchScopeWhere(actor: CurrentUserType) {
    if (this.isSystemAdmin(actor)) return {};
    if (actor.working_location_id) {
      return { working_location_id: BigInt(actor.working_location_id) };
    }
    return { id: BigInt(0) };
  }

  private ensureActorCanUseWorkingLocation(
    actor: CurrentUserType,
    workingLocationId: bigint,
  ) {
    if (this.isSystemAdmin(actor)) return;
    if (actor.working_location_id === workingLocationId.toString()) return;
    throw new BadRequestException(
      'You can only access payroll in your working location.',
    );
  }

  private ensureActorCanApproveBatch(
    actor: CurrentUserType,
    batch: {
      working_location_id: bigint;
      current_approval_step: number;
      working_location: { type: string };
    },
  ) {
    if (batch.working_location.type === 'HQ') {
      if (this.isSystemAdmin(actor)) return;
      throw new BadRequestException('Only admins can approve HQ payroll.');
    }

    if (batch.current_approval_step === 1) {
      const isManager = actor.roles.some((role) =>
        ['MANAGER', 'ON_MANAGER', 'BRANCH_MANAGER'].includes(role),
      );

      if (
        this.isSystemAdmin(actor) ||
        (isManager &&
          actor.working_location_id === batch.working_location_id.toString())
      ) {
        return;
      }

      throw new BadRequestException(
        'Only the working-location manager can approve this payroll step.',
      );
    }

    if (batch.current_approval_step >= 2 && this.isSystemAdmin(actor)) return;

    throw new BadRequestException('Only admins can finalize payroll batches.');
  }

  private async findItemByUuidOrThrow(uuid: string) {
    const item = await this.prisma.payment_batch_items.findUnique({
      where: { uuid },
    });

    if (!item) throw new NotFoundException('Payroll item not found.');

    return item;
  }

  private batchIncludes() {
    return {
      working_location: true,
      submittedBy: true,
      approvedBy: true,
      items: {
        include: this.itemIncludes(),
        orderBy: { created_at: 'asc' as const },
      },
      approval_actions: {
        include: { actionBy: true },
        orderBy: { action_at: 'asc' as const },
      },
    };
  }

  private itemIncludes() {
    return {
      employee: true,
      transaction: true,
      approvedBy: true,
    };
  }

  private serializeBatch(batch: Record<string, any>) {
    return {
      ...batch,
      id: batch.id.toString(),
      working_location_id: batch.working_location_id.toString(),
      submitted_by: batch.submitted_by.toString(),
      approved_by: batch.approved_by?.toString() ?? null,
      total_amount: batch.total_amount.toString(),
      total_gross: batch.total_gross?.toString?.() ?? '0',
      total_allowances: batch.total_allowances?.toString?.() ?? '0',
      total_deductions: batch.total_deductions?.toString?.() ?? '0',
      total_tax: batch.total_tax?.toString?.() ?? '0',
      working_location: batch.working_location
        ? {
            ...batch.working_location,
            id: batch.working_location.id.toString(),
            created_by: batch.working_location.created_by?.toString() ?? null,
            updated_by: batch.working_location.updated_by?.toString() ?? null,
            deleted_by: batch.working_location.deleted_by?.toString() ?? null,
          }
        : undefined,
      items: batch.items?.map((item) => this.serializeItem(item)),
      approval_actions: batch.approval_actions?.map((action) => ({
        ...action,
        id: action.id.toString(),
        payment_batch_id: action.payment_batch_id.toString(),
        action_by: action.action_by.toString(),
        actionBy: action.actionBy
          ? {
              ...action.actionBy,
              id: action.actionBy.id.toString(),
              working_location_id:
                action.actionBy.working_location_id?.toString() ?? null,
              department_id: action.actionBy.department_id?.toString() ?? null,
            }
          : undefined,
      })),
    };
  }

  private serializeItem(item: Record<string, any>) {
    return {
      ...item,
      id: item.id.toString(),
      payment_batch_id: item.payment_batch_id.toString(),
      employee_id: item.employee_id.toString(),
      transaction_id: item.transaction_id.toString(),
      approved_by: item.approved_by?.toString() ?? null,
      employee: item.employee
        ? {
            ...item.employee,
            id: item.employee.id.toString(),
            created_by: item.employee.created_by?.toString() ?? null,
            department_id: item.employee.department_id?.toString() ?? null,
            working_location_id:
              item.employee.working_location_id?.toString() ?? null,
            employment_category_id:
              item.employee.employment_category_id?.toString() ?? null,
          }
        : undefined,
      transaction: item.transaction
        ? {
            ...item.transaction,
            id: item.transaction.id.toString(),
            employee_id: item.transaction.employee_id.toString(),
            payment_structure_id:
              item.transaction.payment_structure_id.toString(),
            approved_by: item.transaction.approved_by?.toString() ?? null,
            gross_amount: item.transaction.gross_amount.toString(),
            base_amount: item.transaction.base_amount?.toString?.() ?? '0',
            allowance_amount:
              item.transaction.allowance_amount?.toString?.() ?? '0',
            tax_amount: item.transaction.tax_amount?.toString?.() ?? '0',
            total_deductions: item.transaction.total_deductions.toString(),
            net_amount: item.transaction.net_amount.toString(),
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

  private startOfDay(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private endOfDay(date: Date) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
  }

  private diffCalendarDays(start: Date, end: Date) {
    const startUtc = Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
    );
    const endUtc = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
    );

    return Math.floor((endUtc - startUtc) / 86_400_000);
  }
}
