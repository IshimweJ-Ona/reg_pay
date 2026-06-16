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
import { SystemConfigService } from '../system-config/system-config.service';
import { ApprovePayrollItemDto } from './dto/approve-payroll-item.dto';
import { CreatePayrollBatchDto } from './dto/create-payroll-batch.dto';
import { RejectPayrollItemDto } from './dto/reject-payroll-item.dto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const RWANDA_TIMEZONE = 'Africa/Kigali';

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
  phoneNumber?: string;
};

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly systemConfigService: SystemConfigService,
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
        ...(dto.categories && dto.categories.length > 0
          ? {
              employment_category: {
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
    const alreadyProcessedItems = await this.prisma.payment_batch_items.findMany({
      where: {
        batch: {
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

    if (existingDraft && (existingDraft.status === PAYMENT_BATCH_STATUS.APPROVED || existingDraft.status === PAYMENT_BATCH_STATUS.REJECTED)) {
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
            transaction_status: TRANSACTION_STATUS.PENDING,
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
            total_amount: totalAmount,
            total_gross: totalGross,
            total_allowances: totalAllowances,
            total_deductions: totalDeductions,
            total_tax: totalTax,
          },
        },
      });

      return tx.payment_batches.findUniqueOrThrow({
        where: { id: targetBatch.id },
        include: this.batchIncludes(),
      });
    });

    // Invalidate payroll batches cache when a new batch is created
    await this.cacheManager.del('payroll:batches');

    if (batch.status !== (PAYMENT_BATCH_STATUS as any).DRAFT) {
      await this.notificationsService.notifyBranchManager(workingLocationId, {
        senderId: actor.userId,
        title: 'Payroll Batch Submitted',
        message: `${batch.batch_code} is awaiting manager approval.`,
        type: 'PAYROLL_APPROVAL_REQUEST',
        referenceId: batch.uuid,
        metadata: {
          redirect: `payroll/${batch.uuid}`,
          level: 'MANAGER',
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
      include: { working_location: true },
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
          level: 'MANAGER',
          status: updated.status,
        },
      },
    );

    return this.serializeBatch(updated);
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
    
    if (
      batch.status === PAYMENT_BATCH_STATUS.APPROVED ||
      batch.status === PAYMENT_BATCH_STATUS.REJECTED
    ) {
      throw new BadRequestException('Terminal batches cannot be modified.');
    }

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
          redirect: `payroll/${approved.uuid}`,
          status: approved.status,
        },
      });
    }

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
        employee: { include: { working_location: true } },
      },
    });

    if (rejectedItems.length === 0) return;

    const batch = await tx.payment_batches.findUnique({
      where: { id: batchId },
      include: { working_location: true },
    });

    const branchName = batch.working_location.name;
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
        status: PAYMENT_BATCH_STATUS.DRAFT,
        submitted_by: batch.submitted_by,
        submitted_at: new Date(),
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
      include: { working_location: true },
    });

    if (!batch) throw new NotFoundException('Payroll batch not found.');

    if (
      batch.status === PAYMENT_BATCH_STATUS.APPROVED ||
      batch.status === PAYMENT_BATCH_STATUS.REJECTED
    ) {
      throw new BadRequestException('Terminal batches cannot be modified.');
    }

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
      title: isSuperAdmin ? 'Payroll Batch Permanently Rejected' : 'Payroll Batch Returned for Corrections',
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
      dayjs.tz(periodEnd, RWANDA_TIMEZONE).startOf('day').diff(dayjs.tz(periodStart, RWANDA_TIMEZONE).startOf('day'), 'day') + 1;

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

    // Determine days worked for eligibility
    const daysWorked =
      paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.MONTHLY
        ? presentDays
        : paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.CUSTOM
          ? requestedWorkDays
          : presentDays;

    const isOver21Days = daysWorked > 21;

    let baseAmount = 0;
    let phoneNumber: string | undefined = undefined;

    if (paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.MONTHLY) {
      baseAmount = Number(paymentStructure.basic_salary);
    } else {
      // DAILY or CUSTOM
      const daysToPay =
        paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.CUSTOM
          ? requestedWorkDays
          : presentDays;
      baseAmount = Number(paymentStructure.daily_rate) * daysToPay;
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

    const overtimeAmount =
      Number(paymentStructure.overtime_rate) * overtimeHours;

    // Allowance: Always for monthly, or if > 21 days for others
    const allowanceEligible =
      isOver21Days ||
      paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.MONTHLY;
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

    // Global Tax logic
    let taxAmount = 0;
    if (
      isOver21Days ||
      paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.MONTHLY
    ) {
      const monthlyTaxes =
        await this.systemConfigService.findMonthlyTaxesAtDate(periodEnd);
      taxAmount = monthlyTaxes.reduce((sum, tax) => {
        return sum + grossAmount * (Number(tax.rate) / 100);
      }, 0);
    }

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
        paymentStructure.payroll_frequency === EMPLOYMENT_TYPE.CUSTOM
          ? requestedWorkDays
          : null,
      payrollStartDate: periodStart,
      payrollEndDate: periodEnd,
      metadata: {
        configured_frequency: paymentStructure.payroll_frequency,
        days_worked: daysWorked,
        is_over_21_days: isOver21Days,
        period_calendar_days: periodCalendarDays,
        overtime_hours: overtimeHours,
        allowance_eligible: allowanceEligible,
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
