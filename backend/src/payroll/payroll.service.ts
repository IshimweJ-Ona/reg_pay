import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import {
  audit_logs_activity_type as ACTIVITY_TYPE,
  audit_logs_action as AUDIT_ACTION,
  payroll_batch_approval_actions_action as APPROVAL_ACTION,
  payment_batches_status as PAYMENT_BATCH_STATUS,
  employees_status as STATUS_USER,
  transactions_transaction_status as TRANSACTION_STATUS,
} from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { hasEffectivePermission } from '../common/utils/effective-permissions.util';
import {
  isNumericId,
  normalizeSearch,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { EmployeesService } from '../employees/employees.service';
import { IkiminaService } from '../ikimina/ikimina.service';
import { ApprovePayrollItemDto } from './dto/approve-payroll-item.dto';
import { CreatePayrollBatchDto } from './dto/create-payroll-batch.dto';
import { RejectPayrollItemDto } from './dto/reject-payroll-item.dto';
import {
  calculateOvertimeBonus,
  getContractDays,
} from '../common/utils/payroll-calc.util';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const RWANDA_TIMEZONE = 'Africa/Kigali';

type PayrollCalculation = {
  employeeId: bigint;
  departmentId: bigint | null;
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
  phoneNumber?: string;
};

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly systemConfigService: SystemConfigService,
    private readonly employeesService: EmployeesService,
    private readonly ikiminaService: IkiminaService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  async createBatch(dto: CreatePayrollBatchDto, actor: CurrentUserType) {
    const workingLocationId = await this.resolveWorkingLocationId(
      dto.working_location_id,
    );
    await this.ensureWorkingLocation(workingLocationId);
    this.ensureActorCanUseWorkingLocation(actor, workingLocationId);

    // Auto-pause employees with expired contracts before batch creation
    await this.employeesService.autoPauseExpiredContracts(workingLocationId);

    const employees = await this.prisma.employees.findMany({
      where: {
        working_location_id: workingLocationId,
        status: STATUS_USER.ACTIVE as any,
        deleted_at: null,
        ...(dto.categories && dto.categories.length > 0
          ? {
              employment_categories: {
                name: { in: dto.categories },
              },
            }
          : {}),
      },
      distinct: ['id'],
    });

    if (!employees.length) {
      throw new BadRequestException(
        'No active employees found for this working location.',
      );
    }

    // Check for employees already in an active (non-Draft/Rejected) batch for the same period
    const alreadyProcessedItems =
      await this.prisma.payment_batch_items.findMany({
        where: {
          payment_batches: {
            payroll_month: dto.payroll_month,
            payroll_year: dto.payroll_year,
            status: {
              in: [
                PAYMENT_BATCH_STATUS.PENDING,
                PAYMENT_BATCH_STATUS.IN_REVIEW,
                PAYMENT_BATCH_STATUS.MANAGER_APPROVED,
                PAYMENT_BATCH_STATUS.APPROVED,
              ],
            },
          },
        },
        select: { employee_id: true },
      });

    const processedEmployeeIds = new Set(
      alreadyProcessedItems.map((i) => i.employee_id),
    );
    const eligibleEmployees = employees.filter(
      (e) => !processedEmployeeIds.has(e.id),
    );

    if (!eligibleEmployees.length) {
      throw new BadRequestException(
        'All active employees for this period are already assigned to active payroll batches.',
      );
    }

    const calculations: PayrollCalculation[] = [];

    for (const employee of eligibleEmployees) {
      const calculation = await this.calculateEmployeePayroll(employee, dto);

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
    const totalTax = calculations.reduce(
      (sum, item) => sum + item.taxAmount,
      0,
    );
    const existingDraft = await this.prisma.payment_batches.findFirst({
      where: {
        working_location_id: workingLocationId,
        payroll_month: dto.payroll_month,
        payroll_year: dto.payroll_year,
        status: (PAYMENT_BATCH_STATUS as any).DRAFT,
      },
    });

    if (
      existingDraft &&
      (existingDraft.status === PAYMENT_BATCH_STATUS.APPROVED ||
        existingDraft.status === PAYMENT_BATCH_STATUS.REJECTED)
    ) {
      throw new BadRequestException('Cannot update a finalized payroll batch.');
    }

    const batch = await this.prisma.$transaction(async (tx) => {
      let targetBatch;

      if (existingDraft) {
        // Clear existing items and transactions for this draft
        const oldItems = await tx.payment_batch_items.findMany({
          where: { payment_batch_id: existingDraft.id },
        });
        const oldTransactionIds = oldItems.map((item) => item.transaction_id);

        await tx.payment_batch_items.deleteMany({
          where: { payment_batch_id: existingDraft.id },
        });
        await tx.transactions.deleteMany({
          where: { id: { in: oldTransactionIds } },
        });

        targetBatch = await tx.payment_batches.update({
          where: { id: existingDraft.id },
          data: {
            total_employees: calculations.length,
            total_amount: totalAmount,
            total_gross: totalGross,
            total_allowances: totalAllowances,
            total_deductions: totalDeductions,
            total_tax: totalTax,
            submitted_at: new Date(),
          },
        });
      } else {
        const batchCode = `PAY-${dto.payroll_year}-${dto.payroll_month
          .toString()
          .padStart(2, '0')}-${Date.now()}`;

        targetBatch = await tx.payment_batches.create({
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
            status: (PAYMENT_BATCH_STATUS as any).DRAFT,
            submitted_by: BigInt(actor.userId),
            submitted_at: new Date(),
            updated_at: new Date(),
          },
        });
      }

      for (const calculation of calculations) {
        if (calculation.phoneNumber) {
          await tx.employees.update({
            where: { id: calculation.employeeId },
            data: { phone_number: calculation.phoneNumber },
          });
        }

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
            transaction_status: TRANSACTION_STATUS.PENDING as any,
            // Denormalized so permission-driven query scoping
            // (MODULE_SCOPE_CONFIG) can filter transactions directly.
            // The whole batch is single-location by construction
            // (workingLocationId resolved once above), department comes
            // from the employee snapshot taken at calculation time.
            working_location_id: workingLocationId,
            department_id: calculation.departmentId,
            updated_at: new Date(),
          },
        });

        await tx.payment_batch_items.create({
          data: {
            uuid: generateUUID(),
            payment_batch_id: targetBatch.id,
            employee_id: calculation.employeeId,
            transaction_id: transaction.id,
            status: PAYMENT_BATCH_STATUS.PENDING,
          },
        });
      }

      // Ikimina deduction: for every MONTHLY employee in this batch with an
      // active Ikimina membership, create a contribution ledger entry and
      // include the deduction amount in their total deductions.
      const employeeIds = calculations.map((c) => c.employeeId);
      const ikiminaDeductions = await this.ikiminaService.deductForBatch(
        tx,
        targetBatch.id,
        employeeIds,
      );

      let recalculatedTotalAmount: number | undefined = undefined;
      let recalculatedTotalDeductions: number | undefined = undefined;

      if (ikiminaDeductions.length > 0) {
        // Update each transaction's total_deductions and net_amount to include
        // the Ikimina deduction. The original calculation didn't account for it,
        // so we add it as a post-hoc adjustment.
        for (const deduction of ikiminaDeductions) {
          const calculation = calculations.find(
            (c) => c.employeeId === deduction.employeeId,
          );
          if (calculation) {
            const ikiminaAmount = deduction.amount;
            const updatedTotalDeductions = calculation.totalDeductions + ikiminaAmount;
            const updatedNetAmount = calculation.netAmount - ikiminaAmount;

            await tx.transactions.updateMany({
              where: {
                payment_batch_items: {
                  some: {
                    payment_batch_id: targetBatch.id,
                    employee_id: deduction.employeeId,
                  },
                },
              },
              data: {
                total_deductions: updatedTotalDeductions,
                net_amount: Math.max(0, updatedNetAmount),
              },
            });

            // Recalculate the batch-level total_deductions and total_amount
            // to include the post-hoc Ikimina deduction.
            calculation.totalDeductions = updatedTotalDeductions;
            calculation.netAmount = Math.max(0, updatedNetAmount);
          }
        }

        // Update batch totals to reflect Ikimina adjustments
        recalculatedTotalAmount = calculations.reduce(
          (sum, item) => sum + item.netAmount,
          0,
        );
        recalculatedTotalDeductions = calculations.reduce(
          (sum, item) => sum + item.totalDeductions,
          0,
        );

        await tx.payment_batches.update({
          where: { id: targetBatch.id },
          data: {
            total_deductions: recalculatedTotalDeductions,
            total_amount: recalculatedTotalAmount,
          },
        });
      }

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'payment_batches',
          entity_id: targetBatch.id,
          module_name: 'PAYROLL',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: existingDraft
            ? 'Updated payroll batch.'
            : 'Created payroll batch.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            batch_code: targetBatch.batch_code,
            working_location_id: workingLocationId.toString(),
            payroll_month: dto.payroll_month,
            payroll_year: dto.payroll_year,
            total_employees: calculations.length,
            total_amount: recalculatedTotalAmount ?? totalAmount,
            total_gross: totalGross,
            total_allowances: totalAllowances,
            total_deductions: recalculatedTotalDeductions ?? totalDeductions,
            total_tax: totalTax,
          },
        },
      });

      return tx.payment_batches.findUniqueOrThrow({
        where: { id: targetBatch.id },
        include: this.batchIncludes(),
      });
    });

    await this.clearPayrollCache();

    if (batch.status !== (PAYMENT_BATCH_STATUS as any).DRAFT) {
      await this.notificationsService.notifyBranchManager(workingLocationId, {
        senderId: actor.userId,
        title: 'Payroll Batch Submitted',
        message: `${batch.batch_code} is awaiting manager approval.`,
        type: 'PAYROLL_APPROVAL_REQUEST',
        referenceId: batch.uuid,
        metadata: {
          redirect: `payroll/${batch.uuid}`,
          level: 'BRANCH_MANAGER',
          status: batch.status,
        },
      });
    }

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

  async submitBatch(uuid: string, actor: CurrentUserType) {
    const batch = await this.prisma.payment_batches.findUnique({
      where: { uuid },
      include: { working_locations: true },
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');

    if (
      batch.status === PAYMENT_BATCH_STATUS.APPROVED ||
      batch.status === PAYMENT_BATCH_STATUS.REJECTED
    ) {
      throw new BadRequestException('Terminal batches cannot be modified.');
    }

    if (batch.status !== (PAYMENT_BATCH_STATUS as any).DRAFT) {
      throw new BadRequestException('Only DRAFT batches can be submitted.');
    }

    if (batch.submitted_by.toString() !== actor.userId) {
      // Allow Accountant role even if they didn't create it?
      // Spec says "ACCOUNTANT (creates) -> BRANCH_MANAGER (approves)"
      // So normally the submitter IS the accountant.
      // But let's be strict.
      // throw new ForbiddenException('Only the creator can submit the batch.');
    }

    const updated = await this.prisma.payment_batches.update({
      where: { id: batch.id },
      data: {
        status: PAYMENT_BATCH_STATUS.PENDING,
        submitted_at: new Date(),
      },
      include: this.batchIncludes(),
    });

    await this.notificationsService.notifyBranchManager(
      batch.working_location_id,
      {
        senderId: actor.userId,
        title: 'Payroll Batch Submitted',
        message: `${batch.batch_code} is awaiting manager approval.`,
        type: 'PAYROLL_APPROVAL_REQUEST',
        referenceId: batch.uuid,
        metadata: {
          redirect: `payroll/${batch.uuid}`,
          level: 'BRANCH_MANAGER',
          status: updated.status,
        },
      },
    );

    await this.clearPayrollCache();
    return this.serializeBatch(updated);
  }

  async findBatch(uuid: string, actor: CurrentUserType) {
    const batch = await this.prisma.payment_batches.findUnique({
      where: { uuid },
      include: this.batchIncludes(),
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');
    this.ensureActorCanViewWorkingLocation(actor, batch.working_location_id);

    return this.serializeBatch(batch);
  }

  async exportBatchCsv(uuid: string, actor: CurrentUserType) {
    const batch = await this.prisma.payment_batches.findUnique({
      where: { uuid },
      include: this.batchIncludes(),
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');
    this.ensureActorCanViewWorkingLocation(actor, batch.working_location_id);

    const headers = [
      'Batch Code',
      'Period',
      'Working Location',
      'Employee Name',
      'Phone Number',
      'Department',
      'Item Status',
      'Gross Pay',
      'Base Pay',
      'Allowances',
      'Tax',
      'Deductions',
      'Net Pay',
      'Attendance Days',
      'Payment Method',
      'Transaction Status',
    ];

    const rows = batch.payment_batch_items.map((item) => {
      const employeeName =
        `${item.employees?.first_name ?? ''} ${item.employees?.last_name ?? ''}`.trim();
      return [
        batch.batch_code,
        `${batch.payroll_month}/${batch.payroll_year}`,
        batch.working_locations?.name ?? batch.working_location_id.toString(),
        employeeName,
        item.employees?.phone_number ?? '',
        (item.employees as any)?.departments?.name ??
          item.employees?.department_id?.toString() ??
          '',
        item.status,
        item.transactions?.gross_amount?.toString() ?? '0',
        item.transactions?.base_amount?.toString() ?? '0',
        item.transactions?.allowance_amount?.toString() ?? '0',
        item.transactions?.tax_amount?.toString() ?? '0',
        item.transactions?.total_deductions?.toString() ?? '0',
        item.transactions?.net_amount?.toString() ?? '0',
        item.transactions?.attendance_days?.toString() ?? '0',
        item.transactions?.payment_method ?? '',
        item.transactions?.transaction_status ?? '',
      ];
    });

    const content = [headers, ...rows]
      .map((row) => row.map((value) => this.csvCell(value)).join(','))
      .join('\r\n');
    const date = new Date().toISOString().slice(0, 10);

    return {
      filename: `reg-pay-batch-${batch.uuid}-${date}.csv`,
      content,
    };
  }

  async approveItem(
    uuid: string,
    dto: ApprovePayrollItemDto,
    actor: CurrentUserType,
  ) {
    const item = await this.findItemByUuidOrThrow(uuid);
    this.ensureBatchCanStillBeReviewed(item.payment_batches);
    await this.ensureActorCanApproveBatch(actor, item.payment_batches);

    const approved = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.payment_batch_items.update({
        where: { id: item.id },
        data: {
          status: PAYMENT_BATCH_STATUS.APPROVED as any,
          approved_by: BigInt(actor.userId),
          approved_at: new Date(),
          rejection_reason: null,
        },
        include: { employees: true, transactions: true, users: true },
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

    await this.clearPayrollCache();
    return this.serializeItem(approved);
  }

  async rejectItem(
    uuid: string,
    dto: RejectPayrollItemDto,
    actor: CurrentUserType,
  ) {
    const item = await this.findItemByUuidOrThrow(uuid);
    this.ensureBatchCanStillBeReviewed(item.payment_batches);
    await this.ensureActorCanApproveBatch(actor, item.payment_batches);

    const rejected = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.payment_batch_items.update({
        where: { id: item.id },
        data: {
          status: PAYMENT_BATCH_STATUS.REJECTED as any,
          approved_by: BigInt(actor.userId),
          approved_at: new Date(),
          rejection_reason: dto.rejection_reason,
        },
        include: { employees: true, transactions: true, users: true },
      });

      await tx.transactions.update({
        where: { id: item.transaction_id },
        data: { transaction_status: TRANSACTION_STATUS.REJECTED as any },
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

    // Notify the submitter about the denied employee
    const batch = await this.prisma.payment_batches.findUnique({
      where: { id: item.payment_batch_id },
      select: {
        submitted_by: true,
        batch_code: true,
        created_at: true,
        uuid: true,
      },
    });

    if (batch) {
      const rejectedCount = await this.prisma.payment_batch_items.count({
        where: {
          payment_batch_id: item.payment_batch_id,
          status: PAYMENT_BATCH_STATUS.REJECTED,
        },
      });

      await this.notificationsService.create({
        userId: batch.submitted_by,
        senderId: actor.userId,
        title: 'Personnel Denied in Payroll',
        message: `${rejectedCount} employees on batch ${batch.batch_code} / ${batch.created_at.toISOString().split('T')[0]} are denied.`,
        type: 'PAYROLL_ITEM_REJECTED',
        referenceId: batch.uuid,
        metadata: {
          redirect: `payroll/${batch.uuid}`,
          reason: dto.rejection_reason,
        },
      });
    }

    await this.clearPayrollCache();
    return this.serializeItem(rejected);
  }

  async approveBatch(
    uuid: string,
    dto: ApprovePayrollItemDto,
    actor: CurrentUserType,
  ) {
    const batch = await this.prisma.payment_batches.findUnique({
      where: { uuid },
      include: { working_locations: true },
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');

    this.ensureBatchCanStillBeReviewed(batch);

    await this.ensureActorCanApproveBatch(actor, batch);

    const branchManager = await this.prisma.branch_managers.findFirst({
      where: {
        working_location_id: batch.working_location_id,
        is_active: true,
      },
    });

    const finalStep = branchManager ? 2 : 1;
    const isFinal = batch.current_approval_step >= finalStep;
    const nextStep = batch.current_approval_step + 1;

    const approved = await this.prisma.$transaction(async (tx) => {
      // Handle partial rejection split-off BEFORE updating the batch
      await this.handlePartialRejectionSplit(tx, batch.id, actor);

      if (isFinal) {
        const payableItems = await tx.payment_batch_items.findMany({
          where: {
            payment_batch_id: batch.id,
            status: { not: PAYMENT_BATCH_STATUS.REJECTED },
          },
          select: { transaction_id: true },
        });

        await tx.payment_batch_items.updateMany({
          where: {
            payment_batch_id: batch.id,
            status: { not: PAYMENT_BATCH_STATUS.REJECTED },
          },
          data: {
            status: PAYMENT_BATCH_STATUS.APPROVED,
            approved_by: BigInt(actor.userId),
            approved_at: new Date(),
          },
        });

        await tx.transactions.updateMany({
          where: {
            id: { in: payableItems.map((item) => item.transaction_id) },
          },
          data: {
            transaction_status: TRANSACTION_STATUS.PAID,
            approved_by: BigInt(actor.userId),
          },
        });
      }

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
          activity_description: isFinal
            ? 'Fully approved payroll batch.'
            : `Approved payroll batch step ${batch.current_approval_step}.`,
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
          redirect: `payroll/${approved.uuid}`,
          level: 'SUPER_ADMIN',
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
          redirect: `payroll/${approved.uuid}`,
          status: approved.status,
        },
      });
    }

    await this.clearPayrollCache();
    return this.serializeBatch(approved);
  }

  private async handlePartialRejectionSplit(
    tx: any,
    batchId: bigint,
    actor: CurrentUserType,
  ) {
    const rejectedItems = await tx.payment_batch_items.findMany({
      where: {
        payment_batch_id: batchId,
        status: PAYMENT_BATCH_STATUS.REJECTED,
      },
      include: {
        transaction: true,
        employee: { include: { working_locations: true } },
      },
    });

    if (rejectedItems.length === 0) return;

    const batch = await tx.payment_batches.findUnique({
      where: { id: batchId },
      include: { working_locations: true },
    });

    const branchName = batch.working_locations?.name || 'Unknown';
    const month = batch.payroll_month;
    const year = batch.payroll_year;
    const newBatchCode = `Rejected-${branchName}-${month}/${year}-${Date.now()}`;

    const newBatch = await tx.payment_batches.create({
      data: {
        uuid: generateUUID(),
        batch_code: newBatchCode,
        working_location_id: batch.working_location_id,
        payroll_month: month,
        payroll_year: year,
        total_employees: rejectedItems.length,
        total_amount: rejectedItems.reduce(
          (sum, item) => sum + Number(item.transaction.net_amount),
          0,
        ),
        total_gross: rejectedItems.reduce(
          (sum, item) => sum + Number(item.transaction.gross_amount),
          0,
        ),
        total_allowances: rejectedItems.reduce(
          (sum, item) => sum + Number(item.transaction.allowance_amount),
          0,
        ),
        total_deductions: rejectedItems.reduce(
          (sum, item) => sum + Number(item.transaction.total_deductions),
          0,
        ),
        total_tax: rejectedItems.reduce(
          (sum, item) => sum + Number(item.transaction.tax_amount),
          0,
        ),
        status: PAYMENT_BATCH_STATUS.DRAFT as any,
        submitted_by: batch.submitted_by,
        submitted_at: new Date(),
        updated_at: new Date(),
      },
    });

    for (const item of rejectedItems) {
      await tx.payment_batch_items.update({
        where: { id: item.id },
        data: {
          payment_batch_id: newBatch.id,
          status: PAYMENT_BATCH_STATUS.PENDING, // Reset to pending for the new batch
        },
      });
    }

    // Update original batch totals by subtracting the rejected items
    await tx.payment_batches.update({
      where: { id: batchId },
      data: {
        total_employees: { decrement: rejectedItems.length },
        total_amount: {
          decrement: rejectedItems.reduce(
            (sum, item) => sum + Number(item.transaction.net_amount),
            0,
          ),
        },
        total_gross: {
          decrement: rejectedItems.reduce(
            (sum, item) => sum + Number(item.transaction.gross_amount),
            0,
          ),
        },
        total_allowances: {
          decrement: rejectedItems.reduce(
            (sum, item) => sum + Number(item.transaction.allowance_amount),
            0,
          ),
        },
        total_deductions: {
          decrement: rejectedItems.reduce(
            (sum, item) => sum + Number(item.transaction.total_deductions),
            0,
          ),
        },
        total_tax: {
          decrement: rejectedItems.reduce(
            (sum, item) => sum + Number(item.transaction.tax_amount),
            0,
          ),
        },
      },
    });

    // Notify creator about the split
    await this.notificationsService.create({
      userId: batch.submitted_by,
      senderId: actor.userId,
      title: 'Rejected Employees Split into New Batch',
      message: `${rejectedItems.length} employees from batch ${batch.batch_code} were rejected and moved to a new batch: ${newBatchCode}.`,
      type: 'PAYROLL_PARTIAL_REJECTION',
      referenceId: newBatch.uuid,
      metadata: {
        redirect: `payroll/${newBatch.uuid}`,
        originalBatchUuid: batch.uuid,
      },
    });
  }

  async rejectBatch(
    uuid: string,
    dto: RejectPayrollItemDto,
    actor: CurrentUserType,
  ) {
    const batch = await this.prisma.payment_batches.findUnique({
      where: { uuid },
      include: { working_locations: true },
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');

    this.ensureBatchCanStillBeReviewed(batch);

    await this.ensureActorCanApproveBatch(actor, batch);

    const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');

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

      if (isSuperAdmin) {
        // Super Admin rejection is terminal
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
            activity_description: `Super Admin permanently rejected payroll batch: ${dto.rejection_reason}.`,
            action: AUDIT_ACTION.DENIED,
            new_values: {
              status: PAYMENT_BATCH_STATUS.REJECTED,
              rejected_reason: dto.rejection_reason,
            },
          },
        });

        return updated;
      } else {
        // Branch Manager rejection returns to DRAFT for corrections
        await tx.payment_batch_items.updateMany({
          where: { payment_batch_id: batch.id },
          data: {
            status: PAYMENT_BATCH_STATUS.PENDING,
            rejection_reason: null,
          },
        });

        const updated = await tx.payment_batches.update({
          where: { id: batch.id },
          data: {
            status: (PAYMENT_BATCH_STATUS as any).DRAFT,
            rejected_reason: dto.rejection_reason,
            current_approval_step: 1,
            approved_by: null,
            approved_at: null,
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
            activity_description: `Manager rejected payroll batch: ${dto.rejection_reason}. Returned to DRAFT.`,
            action: AUDIT_ACTION.DENIED,
            new_values: {
              status: PAYMENT_BATCH_STATUS.DRAFT,
              rejected_reason: dto.rejection_reason,
            },
          },
        });

        return updated;
      }
    });

    await this.notificationsService.create({
      userId: rejected.submitted_by,
      senderId: actor.userId,
      title: isSuperAdmin
        ? 'Payroll Batch Permanently Rejected'
        : 'Payroll Batch Returned for Corrections',
      message: isSuperAdmin
        ? `${rejected.batch_code} was permanently rejected by HQ. Reason: ${dto.rejection_reason}`
        : `${rejected.batch_code} was returned to you for updates. Reason: ${dto.rejection_reason}`,
      type: isSuperAdmin ? 'PAYROLL_REJECTED_FINAL' : 'PAYROLL_REJECTED',
      referenceId: rejected.uuid,
      metadata: {
        redirect: `payroll/${rejected.uuid}`,
        reason: dto.rejection_reason,
        status: rejected.status,
      },
    });

    await this.clearPayrollCache();
    return this.serializeBatch(rejected);
  }

  private async clearPayrollCache() {
    try {
      const store = (this.cacheManager as any).store;
      if (store && typeof store.keys === 'function') {
        const keys = await store.keys();
        for (const key of keys) {
          if (typeof key === 'string' && key.startsWith('payroll:batches')) {
            await this.cacheManager.del(key);
          }
        }
      } else {
        await this.cacheManager.del('payroll:batches');
      }
    } catch {
      await this.cacheManager.del('payroll:batches');
    }
  }

  private csvCell(value: unknown) {
    const text =
      value === null || value === undefined
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
    if (/[",\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
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
      department_id?: bigint | null;
      hire_date?: Date | null;
      contract_start_date?: Date | null;
      contract_end_date?: Date | null;
    },
    dto: CreatePayrollBatchDto,
  ): Promise<PayrollCalculation | null> {
    const month = dto.payroll_month;
    const year = dto.payroll_year;

    const periodStart = dto.start_date
      ? dayjs.tz(dto.start_date, RWANDA_TIMEZONE).startOf('day').toDate()
      : dayjs()
          .tz(RWANDA_TIMEZONE)
          .year(year)
          .month(month - 1)
          .startOf('month')
          .toDate();

    const periodEnd = dto.end_date
      ? dayjs.tz(dto.end_date, RWANDA_TIMEZONE).endOf('day').toDate()
      : dayjs()
          .tz(RWANDA_TIMEZONE)
          .year(year)
          .month(month - 1)
          .endOf('month')
          .toDate();

    if (periodEnd < periodStart) {
      throw new BadRequestException(
        'Payroll end date must be after start date.',
      );
    }

    const periodCalendarDays =
      dayjs
        .tz(periodEnd, RWANDA_TIMEZONE)
        .startOf('day')
        .diff(dayjs.tz(periodStart, RWANDA_TIMEZONE).startOf('day'), 'day') + 1;

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

    // Overtime is no longer a manually entered value. A day counts as an
    // overtime day whenever hours_worked exceeds the configured default
    // work hours (8/day unless changed in System Config), and each
    // overtime day earns one flat bonus — not a per-hour multiple.
    const defaultWorkHours = await this.systemConfigService.getDefaultWorkHours();
    const overtimeDays = attendance.filter(
      (record) => Number(record.hours_worked) > defaultWorkHours,
    ).length;

    const frequency = paymentStructure.payroll_frequency;

    // Flat-rate overtime bonus (default 2,500 RWF/day, configurable via
    // system_config) replaces the old per-employee overtime_rate multiplier
    // for every payroll frequency.
    const overtimeBonusPerDay = await this.systemConfigService.getOvertimeBonusPerDay();

    // CUSTOM (fixed-term) employees are anchored to their contract's own day
    // count rather than the calendar month, so daily_rate x contract days
    // becomes the "full period" baseline that attendance is measured against.
    const contractDays =
      employee.contract_start_date && employee.contract_end_date
        ? getContractDays(employee.contract_start_date, employee.contract_end_date)
        : null;

    // Determine expectedWorkDays - manual overrides always win, then CUSTOM/DAILY
    // contract days (if present), then the calendar.
    let expectedWorkDays = periodCalendarDays;
    if (dto.work_days !== undefined && dto.work_days !== null) {
      expectedWorkDays = dto.work_days;
    } else if ((frequency === 'CUSTOM' || frequency === 'DAILY') && contractDays) {
      expectedWorkDays = contractDays;
    }
    if (expectedWorkDays < 1) {
      expectedWorkDays = 1;
    }

    const prorationRatio = presentDays / expectedWorkDays;

    // Attendance is now the single source of truth for the 21-day
    // tax/allowance eligibility threshold across every frequency.
    const daysWorked = presentDays;
    const isOver21Days = daysWorked > 21;

    let baseAmount = 0;
    let phoneNumber: string | undefined = undefined;

    if (frequency === 'MONTHLY') {
      baseAmount = Number(paymentStructure.basic_salary);
    } else {
      // DAILY and CUSTOM: attendance drives what actually gets paid out.
      // A present day earns the daily_rate; an absent day earns 0 and is
      // deducted from the amount owed - this is identical for DAILY workers
      // and CUSTOM (fixed-term contract) employees.
      baseAmount = Number(paymentStructure.daily_rate) * presentDays;
    }

    // Apply manual overrides from DTO
    if (dto.overrides) {
      const override = dto.overrides.find(
        (o) => o.employee_id === employee.id.toString(),
      );
      if (override) {
        if (override.base_amount !== undefined) {
          baseAmount = override.base_amount;
        }
        if (override.phone_number !== undefined) {
          phoneNumber = override.phone_number;
        }
      }
    }

    let overtimeAmount = 0;
    let allowanceAmount = 0;
    let grossAmount = 0;
    let taxAmount = 0;
    let totalDeductions = 0;
    let netAmount = 0;
    let allowanceEligible = false;
    let monthlyGrossBeforeProration = 0;
    let monthlyNetBeforeProration = 0;
    let dailyNetRate: number | null = null;
    let allowances: any[] = [];
    let taxBreakdown: Array<{
      name: string;
      rate: number;
      full_amount: number;
      prorated_amount: number;
    }> = [];

    if (frequency === 'MONTHLY') {
      const basicSalary = baseAmount;
      const fullOvertime = calculateOvertimeBonus(overtimeDays, overtimeBonusPerDay);
      allowanceEligible = true;

      allowances = await this.prisma.allowances.findMany({
        where: { employee_id: employee.id, is_active: true },
      });
      const fullAllowance = allowances.reduce(
        (sum, allowance) => sum + Number(allowance.amount),
        0,
      );

      const fullMonthlyGross = basicSalary + fullAllowance + fullOvertime;
      monthlyGrossBeforeProration = fullMonthlyGross;

      // Full Tax
      const monthlyTaxes = await this.systemConfigService.findMonthlyTaxesAtDate(periodEnd);
      const fullTaxBreakdown = monthlyTaxes.map((tax) => ({
        name: tax.name,
        rate: Number(tax.rate),
        full_amount: fullMonthlyGross * (Number(tax.rate) / 100),
      }));
      const fullTax = fullTaxBreakdown.reduce(
        (sum, tax) => sum + tax.full_amount,
        0,
      );

      // Full Configured Deductions
      const employeeDeductions = await this.prisma.employee_deductions.findMany({
        where: {
          employee_id: employee.id,
          is_active: true,
          start_date: { lte: periodEnd },
          OR: [{ end_date: null }, { end_date: { gte: periodStart } }],
        },
        include: { deduction_types: true },
      });
      const fullConfiguredDeductions = employeeDeductions.reduce((sum, deduction) => {
        if (deduction.deduction_types.deduction_mode === 'PERCENTAGE') {
          return (
            sum +
            fullMonthlyGross *
              (Number(deduction.deduction_types.percentage_value) / 100)
          );
        }
        return sum + Number(deduction.deduction_types.amount);
      }, 0);

      const fullTaxAndDeductions = fullTax + fullConfiguredDeductions;
      const fullMonthlyNetAfterTax = fullMonthlyGross - fullTaxAndDeductions;
      monthlyNetBeforeProration = fullMonthlyNetAfterTax;

      dailyNetRate = fullMonthlyNetAfterTax / expectedWorkDays;

      // Prorated values
      baseAmount = basicSalary * prorationRatio;
      allowanceAmount = fullAllowance * prorationRatio;
      overtimeAmount = fullOvertime * prorationRatio;
      grossAmount = fullMonthlyGross * prorationRatio;
      taxAmount = fullTax * prorationRatio;
      taxBreakdown = fullTaxBreakdown.map((tax) => ({
        ...tax,
        prorated_amount: tax.full_amount * prorationRatio,
      }));
      totalDeductions = fullTaxAndDeductions * prorationRatio;
      netAmount = dailyNetRate * presentDays;
    } else if (isOver21Days) {
      // DAILY & CUSTOM, past the 21-day threshold: mirror the MONTHLY
      // approach - compute base/overtime/allowance/tax on the FULL
      // (pre-attendance) period, then prorate the entire result down by
      // how many days were actually present. Tax is only ever applied
      // once an employee has passed 21 days worked.
      allowanceEligible = true;

      const fullBase = Number(paymentStructure.daily_rate) * expectedWorkDays;
      const fullOvertime = calculateOvertimeBonus(overtimeDays, overtimeBonusPerDay);

      allowances = await this.prisma.allowances.findMany({
        where: { employee_id: employee.id, is_active: true },
      });
      const fullAllowance = allowances.reduce(
        (sum, allowance) => sum + Number(allowance.amount),
        0,
      );

      const fullGross = fullBase + fullOvertime + fullAllowance;
      monthlyGrossBeforeProration = fullGross;

      const monthlyTaxes = await this.systemConfigService.findMonthlyTaxesAtDate(periodEnd);
      const fullTaxBreakdown = monthlyTaxes.map((tax) => ({
        name: tax.name,
        rate: Number(tax.rate),
        full_amount: fullGross * (Number(tax.rate) / 100),
      }));
      const fullTax = fullTaxBreakdown.reduce(
        (sum, tax) => sum + tax.full_amount,
        0,
      );

      const employeeDeductions = await this.prisma.employee_deductions.findMany({
        where: {
          employee_id: employee.id,
          is_active: true,
          start_date: { lte: periodEnd },
          OR: [{ end_date: null }, { end_date: { gte: periodStart } }],
        },
        include: { deduction_types: true },
      });
      const fullConfiguredDeductions = employeeDeductions.reduce((sum, deduction) => {
        if (deduction.deduction_types.deduction_mode === 'PERCENTAGE') {
          return (
            sum +
            fullGross *
              (Number(deduction.deduction_types.percentage_value) / 100)
          );
        }
        return sum + Number(deduction.deduction_types.amount);
      }, 0);

      const fullTaxAndDeductions = fullTax + fullConfiguredDeductions;
      const fullNetAfterTax = fullGross - fullTaxAndDeductions;
      monthlyNetBeforeProration = fullNetAfterTax;

      dailyNetRate = fullNetAfterTax / expectedWorkDays;

      baseAmount = fullBase * prorationRatio; // == daily_rate * presentDays
      overtimeAmount = fullOvertime * prorationRatio;
      allowanceAmount = fullAllowance * prorationRatio;
      grossAmount = fullGross * prorationRatio;
      taxAmount = fullTax * prorationRatio;
      taxBreakdown = fullTaxBreakdown.map((tax) => ({
        ...tax,
        prorated_amount: tax.full_amount * prorationRatio,
      }));
      totalDeductions = fullTaxAndDeductions * prorationRatio;
      netAmount = dailyNetRate * presentDays;
    } else {
      // DAILY & CUSTOM, 21 days or fewer worked: no tax, no allowances -
      // straightforward attendance-driven pay plus the flat overtime bonus.
      allowanceEligible = false;
      overtimeAmount = calculateOvertimeBonus(overtimeDays, overtimeBonusPerDay);
      allowanceAmount = 0;
      grossAmount = baseAmount + overtimeAmount + allowanceAmount;
      taxAmount = 0;
      totalDeductions = 0;
      netAmount = Math.max(0, grossAmount - totalDeductions);
    }

    return {
      employeeId: employee.id,
      departmentId: employee.department_id ?? null,
      paymentStructureId: paymentStructure.id,
      baseAmount,
      allowanceAmount,
      taxAmount,
      attendanceDays: presentDays,
      payrollWorkDays:
        frequency === 'CUSTOM' || frequency === 'DAILY'
          ? presentDays
          : expectedWorkDays,
      payrollStartDate: periodStart,
      payrollEndDate: periodEnd,
      metadata: {
        configured_frequency: frequency,
        present_days: presentDays,
        expected_work_days: expectedWorkDays,
        contract_days: contractDays,
        overtime_bonus_per_day: overtimeBonusPerDay,
        default_work_hours: defaultWorkHours,
        daily_net_rate: dailyNetRate,
        monthly_gross_before_proration: monthlyGrossBeforeProration || null,
        monthly_net_before_proration: monthlyNetBeforeProration || null,
        proration_ratio: prorationRatio,
        overtime_days: overtimeDays,
        allowance_eligible: allowanceEligible,
        tax_breakdown: taxBreakdown,
        // original metadata fields
        days_worked: daysWorked,
        is_over_21_days: isOver21Days,
        period_calendar_days: periodCalendarDays,
        allowance_titles: allowances.map((allowance) => allowance.title),
      },
      grossAmount,
      totalDeductions,
      netAmount,
      phoneNumber,
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
    return actor.roles.some((role) => ['SUPER_ADMIN'].includes(role));
  }

  private batchScopeWhere(actor: CurrentUserType) {
    if (this.isSystemAdmin(actor)) return {};
    if (hasEffectivePermission(actor, 'payroll.read_all')) return {};
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

  private ensureActorCanViewWorkingLocation(
    actor: CurrentUserType,
    workingLocationId: bigint,
  ) {
    if (this.isSystemAdmin(actor)) return;
    if (hasEffectivePermission(actor, 'payroll.read_all')) return;
    this.ensureActorCanUseWorkingLocation(actor, workingLocationId);
  }

  private async ensureActorCanApproveBatch(
    actor: CurrentUserType,
    batch: {
      working_location_id: bigint;
      current_approval_step: number;
    },
  ) {
    const branchManager = await this.prisma.branch_managers.findFirst({
      where: {
        working_location_id: batch.working_location_id,
        is_active: true,
      },
    });

    const isSuperAdmin = actor.roles.includes('SUPER_ADMIN');
    const isBranchManager =
      actor.roles.includes('BRANCH_MANAGER') &&
      actor.working_location_id === batch.working_location_id.toString();

    if (branchManager) {
      if (batch.current_approval_step === 1) {
        if (isBranchManager || isSuperAdmin) return;
        throw new BadRequestException(
          'Only the BRANCH_MANAGER or SUPER_ADMIN can approve this payroll step.',
        );
      } else {
        if (isSuperAdmin) return;
        throw new BadRequestException(
          'Only SUPER_ADMIN can finalize payroll batches.',
        );
      }
    } else {
      // No branch manager, Super Admin handles it
      if (isSuperAdmin) return;
      throw new BadRequestException(
        'Only SUPER_ADMIN can approve this payroll.',
      );
    }
  }

  private ensureBatchCanStillBeReviewed(batch: {
    status?: PAYMENT_BATCH_STATUS | string;
    current_approval_step?: number;
  }) {
    if (
      batch.status === PAYMENT_BATCH_STATUS.APPROVED ||
      batch.status === PAYMENT_BATCH_STATUS.REJECTED
    ) {
      throw new BadRequestException('Terminal batches cannot be modified.');
    }

    const reviewableStatuses = new Set<string>([
      PAYMENT_BATCH_STATUS.PENDING,
      PAYMENT_BATCH_STATUS.IN_REVIEW,
      PAYMENT_BATCH_STATUS.MANAGER_APPROVED,
    ]);

    if (batch.status && !reviewableStatuses.has(batch.status)) {
      throw new BadRequestException(
        'Only submitted payroll batches can be approved or rejected.',
      );
    }
  }

  private async findItemByUuidOrThrow(uuid: string) {
    const item = await this.prisma.payment_batch_items.findUnique({
      where: { uuid },
      include: {
        payment_batches: {
          select: {
            working_location_id: true,
            current_approval_step: true,
            status: true,
          },
        },
      },
    });

    if (!item) throw new NotFoundException('Payroll item not found.');

    return item;
  }

  private batchIncludes() {
    return {
      working_locations: true,
      users_payment_batches_submitted_byTousers: true,
      users_payment_batches_approved_byTousers: true,
      payment_batch_items: {
        include: {
          employees: {
            include: {
              departments: {
                select: { name: true },
              },
            },
          },
          transactions: true,
          users: true,
        },
        orderBy: { created_at: 'asc' as const },
      },
      payroll_batch_approval_actions: {
        include: { users: true },
        orderBy: { action_at: 'asc' as const },
      },
      ikimina_contributions: true,
    };
  }

  private itemIncludes() {
    return {
      employees: {
        include: {
          departments: {
            select: { name: true },
          },
          ikimina_memberships: true,
        },
      },
      transactions: true,
      users: true,
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
      working_location: batch.working_locations
        ? {
            ...batch.working_locations,
            id: batch.working_locations.id.toString(),
            created_by: batch.working_locations.created_by?.toString() ?? null,
            updated_by: batch.working_locations.updated_by?.toString() ?? null,
            deleted_by: batch.working_locations.deleted_by?.toString() ?? null,
          }
        : undefined,
      items: batch.payment_batch_items?.map((item) => this.serializeItem(item)),
      approval_actions: batch.payroll_batch_approval_actions?.map((action) => ({
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
      ikimina_contributions: batch.ikimina_contributions?.map((c) => ({
        ...c,
        id: c.id.toString(),
        employee_id: c.employee_id.toString(),
        membership_id: c.membership_id.toString(),
        payroll_batch_id: c.payroll_batch_id?.toString() ?? null,
        amount: Number(c.amount),
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
      employee: item.employees
        ? {
            ...item.employees,
            id: item.employees.id.toString(),
            created_by: item.employees.created_by?.toString() ?? null,
            department_id: item.employees.department_id?.toString() ?? null,
            working_location_id:
              item.employees.working_location_id?.toString() ?? null,
            employment_category_id:
              item.employees.employment_category_id?.toString() ?? null,
            department: item.employees.departments
              ? {
                  ...item.employees.departments,
                  id: item.employees.departments.id.toString(),
                  working_location_id:
                    item.employees.departments.working_location_id.toString(),
                }
              : null,
            ikimina_membership: item.employees.ikimina_memberships
              ? {
                  ...item.employees.ikimina_memberships,
                  id: item.employees.ikimina_memberships.id.toString(),
                  employee_id: item.employees.ikimina_memberships.employee_id.toString(),
                  created_by: item.employees.ikimina_memberships.created_by?.toString() ?? null,
                  monthly_amount: Number(item.employees.ikimina_memberships.monthly_amount),
                  is_active: item.employees.ikimina_memberships.is_active,
                }
              : null,
          }
        : undefined,
      transaction: item.transactions
        ? {
            ...item.transactions,
            id: item.transactions.id.toString(),
            employee_id: item.transactions.employee_id.toString(),
            payment_structure_id:
              item.transactions.payment_structure_id.toString(),
            approved_by: item.transactions.approved_by?.toString() ?? null,
            gross_amount: item.transactions.gross_amount.toString(),
            base_amount: item.transactions.base_amount?.toString?.() ?? '0',
            allowance_amount:
              item.transactions.allowance_amount?.toString?.() ?? '0',
            tax_amount: item.transactions.tax_amount?.toString?.() ?? '0',
            total_deductions: item.transactions.total_deductions.toString(),
            net_amount: item.transactions.net_amount.toString(),
          }
        : undefined,
    };
  }

  private toBigInt(value: string, fieldName: string): bigint {
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException(
        `Please choose a valid ${fieldName.replace('_', ' ')}.`,
      );
    }

    return BigInt(value);
  }

  private diffCalendarDays(start: Date, end: Date) {
    return dayjs(end).diff(dayjs(start), 'day');
  }
}
