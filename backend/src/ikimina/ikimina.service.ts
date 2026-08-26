import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Prisma } from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { isNumericId, requireUuidOrNumeric } from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';

const MEMBERSHIPS_LIST_CACHE_KEY = 'ikimina:memberships:all';
const membershipByEmployeeCacheKey = (employeeId: string) =>
  `ikimina:membership:employee:${employeeId}`;

@Injectable()
export class IkiminaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  private async invalidateMembershipCaches(employeeId?: bigint | string) {
    await this.cacheManager.del(MEMBERSHIPS_LIST_CACHE_KEY);
    if (employeeId !== undefined) {
      await this.cacheManager.del(
        membershipByEmployeeCacheKey(employeeId.toString()),
      );
    }
  }

  /**
   * Create an Ikimina membership for an employee.
   * Only MONTHLY employees may have an Ikimina membership — enforced here in the service layer.
   */
  async createMembership(dto: CreateMembershipDto, actor: CurrentUserType) {
    if (!dto.employee_id || !dto.monthly_amount) {
      throw new BadRequestException(
        'Employee ID and monthly amount are required.',
      );
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
        employment_categories: true,
      },
    });

    if (!employee || employee.deleted_at) {
      throw new BadRequestException('Employee not found.');
    }

    // Check payroll frequency — only MONTHLY employees may join Ikimina
    const frequency =
      employee.payment_structures?.[0]?.payroll_frequency ??
      employee.employment_categories?.payroll_frequency;
    if (frequency !== 'MONTHLY') {
      throw new BadRequestException(
        "Only employees with a MONTHLY payroll frequency may join Ikimina. This employee's payroll frequency is " +
          frequency +
          '.',
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
          // Denormalized from the employee at write-time so
          // permission-driven query scoping (MODULE_SCOPE_CONFIG) can
          // filter memberships by location without a relation join — this
          // is the fix for memberships previously having no effective
          // location scoping at all.
          working_location_id: employee.working_location_id,
          department_id: employee.department_id,
          updated_at: new Date(),
        },
        include: {
          employees: {
            include: { departments: true, working_locations: true },
          },
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: employeeId,
          entity_table: 'ikimina_memberships',
          entity_id: created.id,
          module_name: 'IKIMINA',
          activity_type: 'CREATE' as any,
          activity_description: 'Created Ikimina savings membership.',
          action: 'CREATED' as any,
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

    await this.invalidateMembershipCaches(employeeId);
    return this.serializeMembership(membership);
  }

  async findMemberships(actor: CurrentUserType) {
    const cached = await this.cacheManager.get(MEMBERSHIPS_LIST_CACHE_KEY);
    if (cached) return cached as any;

    const memberships = await this.prisma.ikimina_memberships.findMany({
      include: {
        employees: {
          include: { departments: true, working_locations: true },
        },
        ikimina_contributions: {
          select: { amount: true },
        },
      },
      orderBy: { joined_at: 'desc' },
    });

    const result = memberships.map((m) => {
      const totalSavings = (m as any).ikimina_contributions.reduce(
        (sum: number, c: any) => sum + Number(c.amount),
        0,
      );
      return {
        ...this.serializeMembership(m),
        total_savings: totalSavings,
      };
    });

    await this.cacheManager.set(MEMBERSHIPS_LIST_CACHE_KEY, result, 20000);
    return result;
  }

  async findMembershipByEmployee(employeeId: string) {
    const eid = this.toBigInt(employeeId, 'employee_id');
    const cacheKey = membershipByEmployeeCacheKey(eid.toString());
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const membership = await this.prisma.ikimina_memberships.findUnique({
      where: { employee_id: eid },
      include: {
        employees: {
          include: { departments: true, working_locations: true },
        },
        ikimina_contributions: {
          orderBy: { contribution_date: 'desc' },
        },
      },
    });

    if (!membership)
      throw new NotFoundException(
        'No Ikimina membership found for this employee.',
      );

    const totalSavings = (membership as any).ikimina_contributions.reduce(
      (sum: number, c: any) => sum + Number(c.amount),
      0,
    );

    const result = {
      ...this.serializeMembership(membership),
      total_savings: totalSavings,
      contributions: (membership as any).ikimina_contributions.map(
        (c: any) => ({
          ...c,
          id: c.id.toString(),
          employee_id: c.employee_id.toString(),
          membership_id: c.membership_id.toString(),
          payroll_batch_id: c.payroll_batch_id?.toString() ?? null,
          amount: Number(c.amount),
        }),
      ),
    };

    await this.cacheManager.set(cacheKey, result, 20000);
    return result;
  }

  async updateMembership(
    uuid: string,
    dto: UpdateMembershipDto,
    actor: CurrentUserType,
  ) {
    const membership = await this.prisma.ikimina_memberships.findUnique({
      where: { uuid },
    });

    if (!membership)
      throw new NotFoundException('Ikimina membership not found.');

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.ikimina_memberships.update({
        where: { id: membership.id },
        data: {
          monthly_amount: dto.monthly_amount ?? membership.monthly_amount,
          is_active: dto.is_active ?? membership.is_active,
          updated_at: new Date(),
        },
        include: {
          employees: {
            include: { departments: true, working_locations: true },
          },
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: membership.employee_id,
          entity_table: 'ikimina_memberships',
          entity_id: saved.id,
          module_name: 'IKIMINA',
          activity_type: 'UPDATE' as any,
          activity_description: 'Updated Ikimina membership.',
          action: 'UPDATED' as any,
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

    await this.invalidateMembershipCaches(membership.employee_id);
    return this.serializeMembership(updated);
  }

  /**
   * Remove an employee from the Ikimina savings program entirely.
   * Blocked if the membership has contributions tied to a processed payroll
   * batch — that's settled financial history and must stay immutable.
   * Deactivating (updateMembership with is_active: false) is the right move
   * for that case; this is for fully dropping a membership.
   */
  async removeMembership(uuid: string, actor: CurrentUserType) {
    const membership = await this.prisma.ikimina_memberships.findUnique({
      where: { uuid },
      include: {
        ikimina_contributions: { select: { id: true, payroll_batch_id: true } },
      },
    });

    if (!membership)
      throw new NotFoundException('Ikimina membership not found.');

    const hasProcessedContributions = membership.ikimina_contributions.some(
      (c) => c.payroll_batch_id !== null,
    );
    if (hasProcessedContributions) {
      throw new BadRequestException(
        'This membership has contributions already processed through payroll and cannot be removed. Deactivate it instead to stop future deductions.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ikimina_contributions.deleteMany({
        where: { membership_id: membership.id },
      });

      await tx.ikimina_memberships.delete({ where: { id: membership.id } });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: membership.employee_id,
          entity_table: 'ikimina_memberships',
          entity_id: membership.id,
          module_name: 'IKIMINA',
          activity_type: 'DELETE' as any,
          activity_description: 'Removed employee from Ikimina savings.',
          action: 'DELETED' as any,
          old_values: {
            employee_id: membership.employee_id.toString(),
            monthly_amount: membership.monthly_amount.toString(),
            is_active: membership.is_active,
          },
          new_values: Prisma.JsonNull,
        },
      });
    });

    await this.invalidateMembershipCaches(membership.employee_id);
    return { message: 'Employee removed from Ikimina savings.' };
  }

  /**
   * Called during batch creation — deduct Ikimina contributions for MONTHLY
   * employees with active memberships.
   */
  async deductForBatch(tx: any, batchId: bigint, employeeIds: bigint[]) {
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

    // Contributions just created affect total_savings shown by the read
    // endpoints above, so their cache entries can't be left stale.
    await Promise.all(
      deductions.map((d) => this.invalidateMembershipCaches(d.employeeId)),
    );

    return deductions;
  }

  private serializeMembership(membership: Record<string, any>) {
    return {
      ...membership,
      id: membership.id.toString(),
      employee_id: membership.employee_id.toString(),
      created_by: membership.created_by?.toString() ?? null,
      working_location_id: membership.working_location_id?.toString() ?? null,
      department_id: membership.department_id?.toString() ?? null,
      monthly_amount: Number(membership.monthly_amount),
      employee: membership.employees
        ? {
            ...membership.employees,
            id: membership.employees.id.toString(),
            department_id:
              membership.employees.department_id?.toString() ?? null,
            working_location_id:
              membership.employees.working_location_id?.toString() ?? null,
            position_id:
              membership.employees.position_id?.toString() ?? null,
            department: membership.employees.departments ?? null,
            working_location: membership.employees.working_locations ?? null,
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
