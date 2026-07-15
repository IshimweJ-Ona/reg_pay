import {
    BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { ACTIVITY_TYPE, AUDIT_ACTION, Prisma, EMPLOYMENT_TYPE } from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { isNumericId, requireUuidOrNumeric } from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

@Injectable()
export class IkiminaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  /**
   * Create an Ikimina membership for an employee.
   * Only MONTHLY employees may have an Ikimina membership — enforced here in the service layer.
   */
  async createMembership(dto: CreateMembershipDto, actor: CurrentUserType) {
    if (!dto.employee_id || !dto.monthly_amount) {
      throw new BadRequestException('Employee ID and monthly amount are required.');
    }

    const employeeId = this.toBigInt(dto.employee_id, 'employee_id');

    // Verify employee exists and is MONTHLY
    const employee = await this.prisma.employees.findUnique({
      where: { id: employeeId },
      include: {
        payment_structures: {
          orderBy: { effective_from: 'desc' },
          take: 1,
        },
        employment_category: true,
      },
    });

    if (!employee || employee.deleted_at) {
      throw new BadRequestException('Employee not found.');
    }

    // Check payroll frequency — only MONTHLY employees may join Ikimina
    const frequency = employee.payment_structures?.[0]?.payroll_frequency
      ?? employee.employment_category?.payroll_frequency;
    if (frequency !== EMPLOYMENT_TYPE.MONTHLY) {
      throw new BadRequestException(
        'Only employees with a MONTHLY payroll frequency may join Ikimina. This employee\'s payroll frequency is ' + frequency + '.',
      );
    }

    // Check for existing active membership
    const existing = await this.prisma.ikimina_memberships.findUnique({
      where: { employee_id: employeeId },
    });
    if (existing) {
      throw new BadRequestException(
        `This employee already has an Ikimina membership (${existing.is_active ? 'active' : 'inactive'}). Update the existing record instead.`,
      );
    }

    const membership = await this.prisma.$transaction(async (tx) => {
      const created = await tx.ikimina_memberships.create({
        data: {
          uuid: generateUUID(),
          employee_id: employeeId,
          monthly_amount: dto.monthly_amount,
          is_active: dto.is_active ?? true,
          created_by: BigInt(actor.userId),
        },
        include: { employee: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: employeeId,
          entity_table: 'ikimina_memberships',
          entity_id: created.id,
          module_name: 'IKIMINA',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: 'Created Ikimina savings membership.',
          action: AUDIT_ACTION.CREATED,
          old_values: Prisma.JsonNull,
          new_values: {
            employee_id: employeeId.toString(),
            monthly_amount: dto.monthly_amount,
            is_active: created.is_active,
          },
        },
      });

      return created;
    });

    return this.serializeMembership(membership);
  }

  async findMemberships(actor: CurrentUserType) {
    const memberships = await this.prisma.ikimina_memberships.findMany({
      include: {
        employee: {
          include: { department: true, working_location: true },
        },
        contributions: {
          select: { amount: true },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    return memberships.map((m) => {
      const totalSavings = m.contributions.reduce(
        (sum, c) => sum + Number(c.amount),
        0,
      );
      return {
        ...this.serializeMembership(m),
        total_savings: totalSavings,
      };
    });
  }

  async findMembershipByEmployee(employeeId: string) {
    const eid = this.toBigInt(employeeId, 'employee_id');
    const membership = await this.prisma.ikimina_memberships.findUnique({
      where: { employee_id: eid },
      include: {
        employee: true,
        contributions: {
          orderBy: { contribution_date: 'desc' },
        },
      },
    });

    if (!membership) throw new NotFoundException('No Ikimina membership found for this employee.');

    const totalSavings = membership.contributions.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );

    return {
      ...this.serializeMembership(membership),
      total_savings: totalSavings,
      contributions: membership.contributions.map((c) => ({
        ...c,
        id: c.id.toString(),
        employee_id: c.employee_id.toString(),
        membership_id: c.membership_id.toString(),
        payroll_batch_id: c.payroll_batch_id?.toString() ?? null,
        amount: Number(c.amount),
      })),
    };
  }

  async updateMembership(uuid: string, dto: UpdateMembershipDto, actor: CurrentUserType) {
    const membership = await this.prisma.ikimina_memberships.findUnique({
      where: { uuid },
    });

    if (!membership) throw new NotFoundException('Ikimina membership not found.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.ikimina_memberships.update({
        where: { id: membership.id },
        data: {
          monthly_amount: dto.monthly_amount ?? membership.monthly_amount,
          is_active: dto.is_active ?? membership.is_active,
        },
        include: { employee: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: membership.employee_id,
          entity_table: 'ikimina_memberships',
          entity_id: saved.id,
          module_name: 'IKIMINA',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated Ikimina membership.',
          action: AUDIT_ACTION.UPDATED,
          old_values: {
            monthly_amount: membership.monthly_amount.toString(),
            is_active: membership.is_active,
          },
          new_values: {
            monthly_amount: saved.monthly_amount.toString(),
            is_active: saved.is_active,
          },
        },
      });

      return saved;
    });

    return this.serializeMembership(updated);
  }

  /**
   * Called during batch creation — deduct Ikimina contributions for MONTHLY
   * employees with active memberships.
   */
  async deductForBatch(
    tx: any,
    batchId: bigint,
    employeeIds: bigint[],
  ) {
    if (employeeIds.length === 0) return [];

    const activeMemberships = await tx.ikimina_memberships.findMany({
      where: {
        employee_id: { in: employeeIds },
        is_active: true,
      },
    });

    if (activeMemberships.length === 0) return [];

    const deductions: Array<{
      employeeId: bigint;
      amount: number;
    }> = [];

    // Fetch all existing contributions for this batch in one query (N+1 query optimization)
    const existingContributions = await tx.ikimina_contributions.findMany({
      where: {
        payroll_batch_id: batchId,
        employee_id: { in: activeMemberships.map((m) => m.employee_id) },
      },
    });

    const existingMap = new Map<string, any>(
      existingContributions.map((c) => [c.employee_id.toString(), c]),
    );

    for (const membership of activeMemberships) {
      const existing = existingMap.get(membership.employee_id.toString());

      if (existing) {
        // Already deducted for this batch — skip
        deductions.push({
          employeeId: membership.employee_id,
          amount: Number(existing.amount),
        });
        continue;
      }

      const amount = Number(membership.monthly_amount);

      await tx.ikimina_contributions.create({
        data: {
          uuid: generateUUID(),
          employee_id: membership.employee_id,
          membership_id: membership.id,
          payroll_batch_id: batchId,
          amount: amount,
          contribution_date: new Date(),
        },
      });

      deductions.push({
        employeeId: membership.employee_id,
        amount,
      });
    }

    return deductions;
  }

  private serializeMembership(membership: Record<string, any>) {
    return {
      ...membership,
      id: membership.id.toString(),
      employee_id: membership.employee_id.toString(),
      created_by: membership.created_by?.toString() ?? null,
      monthly_amount: Number(membership.monthly_amount),
      employee: membership.employee
        ? {
            ...membership.employee,
            id: membership.employee.id.toString(),
            department_id: membership.employee.department_id?.toString() ?? null,
            working_location_id: membership.employee.working_location_id?.toString() ?? null,
            employment_category_id: membership.employee.employment_category_id?.toString() ?? null,
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
}