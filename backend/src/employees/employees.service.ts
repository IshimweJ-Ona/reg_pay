import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import {
  ACTION_TYPE,
  ACTIVITY_TYPE,
  ATTENDANCE_STATUS,
  AUDIT_ACTION,
  APPROVAL_STATUS,
  STATUS_ACTIVE_INACTIVE,
  STATUS_USER,
  TRANSFER_SUBJECT,
} from '@prisma/client';

import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import {
  isNumericId,
  isUuid,
  normalizeSearch,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { SuspendEmployeeDto } from './dto/suspend-employee.dto';
import { TransferEmployeeDto } from './dto/transfer-employee.dto';
import { BulkImportEmployeeDto, BulkImportEmployeeItem } from './dto/bulk-import-employee.dto';

import { NotificationsService } from '../notifications/notifications.service';
import { PaymentStructuresService } from '../payment-structures/payment-structures.service';
import { calculateCustomContractTotal } from '../common/utils/payroll-calc.util';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly paymentStructuresService: PaymentStructuresService,
  ) {}

  async create(dto: CreateEmployeeDto, actor?: CurrentUserType) {
    if (!dto.first_name || !dto.last_name) {
      throw new BadRequestException(
        'First name and last name are required to create an employee.',
      );
    }
    const firstName = dto.first_name;
    const lastName = dto.last_name;

    const managerScoped =
      actor?.roles?.some((role) => ['BRANCH_MANAGER'].includes(role)) &&
      !this.isSystemAdmin(actor);
    const effectiveWorkingLocationInput =
      managerScoped && actor?.working_location_id
        ? actor.working_location_id
        : dto.working_location_id;
    const workingLocationId = effectiveWorkingLocationInput
      ? await this.resolveWorkingLocationId(effectiveWorkingLocationInput)
      : null;

    const departmentId = dto.department_id
      ? await this.resolveDepartmentId(dto.department_id, workingLocationId)
      : null;

    const categoryId = dto.employment_category_id
      ? this.toBigInt(dto.employment_category_id, 'employment_category_id')
      : null;

    if (workingLocationId && departmentId) {
      await this.ensureOrganization(workingLocationId, departmentId);
    }

    if (categoryId) {
      await this.ensureEmploymentCategory(categoryId);
    }

    this.ensureActorCanUseScope(
      actor,
      workingLocationId,
      departmentId,
      'create employees',
    );

    const employee = await this.prisma.$transaction(async (tx) => {
      // Duplicate checks
      if (dto.email) {
        const existing = await tx.employees.findFirst({
          where: { email: dto.email, deleted_at: null },
          select: { uuid: true },
        });
        if (existing) {
          throw new BadRequestException(
            `An employee with email "${dto.email}" already exists (uuid: ${existing.uuid}).`,
          );
        }
      }

      if (dto.phone_number) {
        const existing = await tx.employees.findFirst({
          where: { phone_number: dto.phone_number, deleted_at: null },
          select: { uuid: true },
        });
        if (existing) {
          throw new BadRequestException(
            `An employee with phone number "${dto.phone_number}" already exists (uuid: ${existing.uuid}).`,
          );
        }
      }

      if (dto.national_id) {
        const existing = await tx.employees.findFirst({
          where: { national_id: dto.national_id, deleted_at: null },
          select: { uuid: true },
        });
        if (existing) {
          throw new BadRequestException(
            `An employee with national ID "${dto.national_id}" already exists (uuid: ${existing.uuid}).`,
          );
        }
      }

      const created = await tx.employees.create({
        data: {
          uuid: generateUUID(),
          first_name: firstName,
          last_name: lastName,
          email: dto.email,
          phone_number: dto.phone_number,
          national_id: dto.national_id,
          gender: dto.gender,
          hire_date: dto.hire_date ? new Date(dto.hire_date) : null,
          contract_start_date: dto.contract_start_date ? new Date(dto.contract_start_date) : null,
          contract_end_date: dto.contract_end_date ? new Date(dto.contract_end_date) : null,
          department_id: departmentId,
          working_location_id: workingLocationId,
          employment_category_id: categoryId,
          status: STATUS_USER.ACTIVE,
          created_by: actor ? BigInt(actor.userId) : null,
        },
        include: this.employeeIncludes(),
      });

      // Unified Salary Creation
      if (categoryId && (dto.basic_salary || dto.daily_rate)) {
        const category = await tx.employment_categories.findUnique({
          where: { id: categoryId },
        });
        if (category) {
          const isCustom = category.payroll_frequency === 'CUSTOM';
          const dailyRate = category.payroll_frequency === 'MONTHLY'
            ? (dto.daily_rate ?? '5000')
            : (dto.daily_rate ?? '3000');

          await tx.payment_structures.create({
            data: {
              uuid: generateUUID(),
              employee_id: created.id,
              payroll_frequency: category.payroll_frequency,
              basic_salary: category.payroll_frequency === 'MONTHLY'
                ? (dto.basic_salary ?? '150000')
                : isCustom
                  ? this.resolveCustomBasicSalary(
                      dailyRate,
                      created.contract_start_date,
                      created.contract_end_date,
                      dto.basic_salary ?? '0',
                    )
                  : '0',
              daily_rate: dailyRate,
              overtime_rate: '0',
              tax_percentage: dto.tax_percentage ?? '0',
              custom_work_days: null,
              effective_from: new Date(),
            },
          });
        }
      }

      // Unified Allowance Creation
      if (dto.allowance_title && dto.allowance_amount) {
        await tx.allowances.create({
          data: {
            uuid: generateUUID(),
            employee_id: created.id,
            title: dto.allowance_title,
            amount: dto.allowance_amount,
          },
        });
      }

      if (actor) {
        await tx.audit_logs.create({
          data: {
            user_id: BigInt(actor.userId),
            employee_id: created.id,
            entity_table: 'employees',
            entity_id: created.id,
            module_name: 'EMPLOYEES',
            activity_type: ACTIVITY_TYPE.CREATE,
            activity_description:
              'Created employee profile with salary and benefits.',
            action: AUDIT_ACTION.CREATED,
            new_values: {
              working_location_id: workingLocationId?.toString() ?? null,
              department_id: departmentId?.toString() ?? null,
              employment_category_id: categoryId?.toString() ?? null,
            },
          },
        });
      }

      return created;
    });

    await this.clearEmployeeCache();
    this.notificationsService.broadcast({ type: 'employees_updated' });

    return this.serializeEmployee(employee);
  }

  /**
   * For CUSTOM (fixed-term) employees, basic_salary isn't user-entered - it's
   * the full contract value: daily_rate x contract days. Falls back to the
   * supplied/default value when contract dates aren't set yet.
   */
  private resolveCustomBasicSalary(
    dailyRate: string,
    contractStartDate?: Date | null,
    contractEndDate?: Date | null,
    fallback = '0',
  ): string {
    if (contractStartDate && contractEndDate) {
      return calculateCustomContractTotal(
        Number(dailyRate),
        contractStartDate,
        contractEndDate,
      ).toString();
    }
    return fallback;
  }

  // Helper to clear all employee-related caches
  private async clearEmployeeCache() {
    try {
      // In cache-manager v5+, store.keys() returns all keys.
      // We use (this.cacheManager as any) to bypass strict typing on the store property.
      const store = (this.cacheManager as any).store;
      if (store && typeof store.keys === 'function') {
        const keys = await store.keys();
        for (const key of keys) {
          if (typeof key === 'string' && key.startsWith('employees:all')) {
            await this.cacheManager.del(key);
          }
        }
      } else {
        await this.cacheManager.del('employees:all');
      }
    } catch (err) {
      // Fallback to primary key if store.keys() is not supported
      await this.cacheManager.del('employees:all');
    }
  }

  async findAll(actor: CurrentUserType, qInput?: string) {
    const q = normalizeSearch(qInput);
    const cacheKey = `employees:all:${actor.userId}:${actor.working_location_id ?? ''}:${q ?? ''}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const employees = await this.prisma.employees.findMany({
      where: {
        deleted_at: null,
        ...this.employeeScopeWhere(actor),
        ...(q
          ? {
              OR: [
                {
                  first_name: {
                    contains: q,
                  },
                },
                {
                  last_name: {
                    contains: q,
                  },
                },
                {
                  email: {
                    contains: q,
                  },
                },
                {
                  phone_number: {
                    contains: q,
                  },
                },
                {
                  national_id: {
                    contains: q,
                  },
                },
              ],
            }
          : {}),
      },
      distinct: ['uuid'],
      include: this.employeeIncludes(),
      orderBy: {
        created_at: 'desc',
      },
    });

    const result = {
      employees: employees.map((employee) => this.serializeEmployee(employee)),
    };
    await this.cacheManager.set(cacheKey, result, 30000); // 30 seconds cache
    return result;
  }

  async findOne(uuid: string, actor: CurrentUserType) {
    const employee = await this.prisma.employees.findUnique({
      where: { uuid },
      include: {
        ...this.employeeIncludes(),
        employee_history: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });

    if (!employee || employee.deleted_at) {
      throw new NotFoundException('Employee not found.');
    }

    this.ensureActorCanAccessEmployee(actor, employee);

    return this.serializeEmployee(employee);
  }

  // Update employee profile details with audit logging
  async update(
    uuid: string,
    dto: Partial<CreateEmployeeDto>,
    actor: CurrentUserType,
  ) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);
    this.ensureActorCanAccessEmployee(actor, employee);

    const workingLocationId = dto.working_location_id
      ? await this.resolveWorkingLocationId(dto.working_location_id)
      : undefined;

    const departmentId = dto.department_id
      ? await this.resolveDepartmentId(
          dto.department_id,
          workingLocationId ?? employee.working_location_id,
        )
      : undefined;

    const categoryId = dto.employment_category_id
      ? this.toBigInt(dto.employment_category_id, 'employment_category_id')
      : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.email) {
        const existing = await tx.employees.findFirst({
          where: {
            email: dto.email,
            deleted_at: null,
            NOT: { id: employee.id },
          },
          select: { uuid: true },
        });
        if (existing) {
          throw new BadRequestException(
            `Another employee with email "${dto.email}" already exists (uuid: ${existing.uuid}).`,
          );
        }
      }

      if (dto.phone_number) {
        const existing = await tx.employees.findFirst({
          where: {
            phone_number: dto.phone_number,
            deleted_at: null,
            NOT: { id: employee.id },
          },
          select: { uuid: true },
        });
        if (existing) {
          throw new BadRequestException(
            `Another employee with phone number "${dto.phone_number}" already exists (uuid: ${existing.uuid}).`,
          );
        }
      }

      if (dto.national_id) {
        const existing = await tx.employees.findFirst({
          where: {
            national_id: dto.national_id,
            deleted_at: null,
            NOT: { id: employee.id },
          },
          select: { uuid: true },
        });
        if (existing) {
          throw new BadRequestException(
            `Another employee with national ID "${dto.national_id}" already exists (uuid: ${existing.uuid}).`,
          );
        }
      }

      // 1. Update Profile (Only include provided fields)
      const employeeUpdateData: any = {};
      if (dto.first_name !== undefined)
        employeeUpdateData.first_name = dto.first_name;
      if (dto.last_name !== undefined)
        employeeUpdateData.last_name = dto.last_name;
      if (dto.email !== undefined) employeeUpdateData.email = dto.email;
      if (dto.phone_number !== undefined)
        employeeUpdateData.phone_number = dto.phone_number;
      if (dto.national_id !== undefined)
        employeeUpdateData.national_id = dto.national_id;
      if (dto.gender !== undefined) employeeUpdateData.gender = dto.gender;
      if (dto.hire_date !== undefined)
        employeeUpdateData.hire_date = new Date(dto.hire_date);
      if (dto.contract_start_date !== undefined)
        employeeUpdateData.contract_start_date = dto.contract_start_date
          ? new Date(dto.contract_start_date)
          : null;
      if (dto.contract_end_date !== undefined)
        employeeUpdateData.contract_end_date = dto.contract_end_date
          ? new Date(dto.contract_end_date)
          : null;
      if (departmentId !== undefined)
        employeeUpdateData.department_id = departmentId;
      if (workingLocationId !== undefined)
        employeeUpdateData.working_location_id = workingLocationId;
      if (categoryId !== undefined)
        employeeUpdateData.employment_category_id = categoryId;

      const saved = await tx.employees.update({
        where: { id: employee.id },
        data: employeeUpdateData,
        include: this.employeeIncludes(),
      });

      // 2. Update Salary (Payment Structure) if salary/category/contract fields changed
      const targetCategoryId = categoryId ?? employee.employment_category_id;
      const hasSalaryPatch =
        dto.basic_salary !== undefined ||
        dto.daily_rate !== undefined ||
        dto.tax_percentage !== undefined ||
        dto.contract_start_date !== undefined ||
        dto.contract_end_date !== undefined ||
        categoryId !== undefined;

      if (targetCategoryId && hasSalaryPatch) {
        const category = await tx.employment_categories.findUnique({
          where: { id: targetCategoryId },
        });

        if (category) {
          const currentStructure = await tx.payment_structures.findFirst({
            where: { employee_id: employee.id, effective_to: null },
          });

          const isMonthly = category.payroll_frequency === 'MONTHLY';
          const isCustom = category.payroll_frequency === 'CUSTOM';

          const resolvedDailyRate = isMonthly
            ? (dto.daily_rate ?? (currentStructure?.daily_rate && Number(currentStructure.daily_rate) !== 0 ? currentStructure.daily_rate.toString() : '5000'))
            : (dto.daily_rate ?? (currentStructure?.daily_rate && Number(currentStructure.daily_rate) !== 0 ? currentStructure.daily_rate.toString() : '3000'));

          const structureData = {
            payroll_frequency: category.payroll_frequency,
            basic_salary: isMonthly
              ? (dto.basic_salary ?? (currentStructure?.basic_salary && Number(currentStructure.basic_salary) !== 0 ? currentStructure.basic_salary.toString() : '150000'))
              : isCustom
                ? this.resolveCustomBasicSalary(
                    resolvedDailyRate,
                    saved.contract_start_date,
                    saved.contract_end_date,
                    dto.basic_salary ?? currentStructure?.basic_salary?.toString() ?? '0',
                  )
                : '0',
            daily_rate: resolvedDailyRate,
            overtime_rate: currentStructure?.overtime_rate ?? '0',
            tax_percentage:
              dto.tax_percentage ?? currentStructure?.tax_percentage ?? '0',
            custom_work_days: null,
          };

          if (
            currentStructure &&
            currentStructure.payroll_frequency === category.payroll_frequency
          ) {
            // Update existing
            await tx.payment_structures.update({
              where: { id: currentStructure.id },
              data: structureData,
            });
          } else {
            // Close old and create new
            await tx.payment_structures.updateMany({
              where: { employee_id: employee.id, effective_to: null },
              data: { effective_to: new Date() },
            });

            await tx.payment_structures.create({
              data: {
                ...structureData,
                uuid: generateUUID(),
                employee_id: employee.id,
                effective_from: new Date(),
              },
            });
          }
        }
      }

      // 3. Update Allowance if provided
      if (
        dto.allowance_title !== undefined ||
        dto.allowance_amount !== undefined
      ) {
        const existingAllowance = await tx.allowances.findFirst({
          where: { employee_id: employee.id },
        });

        if (existingAllowance) {
          await tx.allowances.update({
            where: { id: existingAllowance.id },
            data: {
              title: dto.allowance_title ?? existingAllowance.title,
              amount: dto.allowance_amount ?? existingAllowance.amount,
            },
          });
        } else if (dto.allowance_title && dto.allowance_amount) {
          await tx.allowances.create({
            data: {
              uuid: generateUUID(),
              employee_id: employee.id,
              title: dto.allowance_title,
              amount: dto.allowance_amount,
            },
          });
        }
      }

      // Log the update activity for auditing
      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: saved.id,
          entity_table: 'employees',
          entity_id: saved.id,
          module_name: 'EMPLOYEES',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description:
            'Updated employee profile, salary, and benefits in a unified operation.',
          action: AUDIT_ACTION.UPDATED,
          old_values: this.serializeEmployee(employee),
          new_values: this.serializeEmployee(saved),
        },
      });

      return tx.employees.findUniqueOrThrow({
        where: { id: saved.id },
        include: this.employeeIncludes(),
      });
    });

    await this.clearEmployeeCache();
    this.notificationsService.broadcast({ type: 'employees_updated' });

    return this.serializeEmployee(updated);
  }

  async transfer(
    uuid: string,
    dto: TransferEmployeeDto,
    actor: CurrentUserType,
  ) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);

    this.ensureActorCanAccessEmployee(actor, employee);

    if (!dto.working_location_id || !dto.department_id) {
      throw new BadRequestException(
        'Working location and department are required for employee transfer.',
      );
    }

    const workingLocationId = await this.resolveWorkingLocationId(
      dto.working_location_id,
    );

    const departmentId = await this.resolveDepartmentId(
      dto.department_id,
      workingLocationId,
    );

    const categoryId = dto.employment_category_id
      ? this.toBigInt(dto.employment_category_id, 'employment_category_id')
      : employee.employment_category_id;

    if (!categoryId) {
      throw new BadRequestException(
        'Employee must have an employment category before transfer.',
      );
    }

    await this.ensureOrganization(workingLocationId, departmentId);

    await this.ensureEmploymentCategory(categoryId);

    const request = await this.prisma.transfer_requests.create({
      data: {
        uuid: generateUUID(),
        subject_type: TRANSFER_SUBJECT.EMPLOYEE,
        employee_id: employee.id,
        old_working_location_id: employee.working_location_id,
        new_working_location_id: workingLocationId,
        old_department_id: employee.department_id,
        new_department_id: departmentId,
        reason: dto.reason,
        requested_by: BigInt(actor.userId),
        current_level: 'BRANCH_MANAGER',
      },
    });

    // Notify Branch Manager
    if (employee.working_location_id) {
      await this.notificationsService.notifyBranchManager(
        employee.working_location_id,
        {
          senderId: actor.userId,
          title: 'Employee Transfer Request',
          message: `A transfer request has been initiated for employee ${employee.first_name} ${employee.last_name}.`,
          type: 'TRANSFER_REQUEST',
          referenceId: request.uuid,
          metadata: { level: 'BRANCH_MANAGER' },
        },
      );
    } else {
      await this.notificationsService.notifyAdmins({
        senderId: actor.userId,
        title: 'Employee Transfer Request',
        message: `A transfer request has been initiated for employee ${employee.first_name} ${employee.last_name}.`,
        type: 'TRANSFER_REQUEST',
        referenceId: request.uuid,
        metadata: { level: 'SUPER_ADMIN' },
      });
      await this.prisma.transfer_requests.update({
        where: { id: request.id },
        data: { current_level: 'SUPER_ADMIN' },
      });
    }

    return this.serializeTransferRequest(request);
  }

  async approveTransfer(requestUuid: string, actor: CurrentUserType) {
    const request = await this.findTransferRequestOrThrow(requestUuid);

    if (!request.employee_id) {
      throw new BadRequestException('Transfer request has no employee.');
    }

    const hasTransferApprove = actor.permissions.includes('employees.transfer_approve') || this.isSystemAdmin(actor);
    const isAdmin = this.isSystemAdmin(actor);

    if (request.current_level === 'BRANCH_MANAGER') {
      if (!hasTransferApprove) {
        throw new ForbiddenException(
          'Only a user with transfer approval permission can approve this at this level.',
        );
      }

      const updated = await this.prisma.transfer_requests.update({
        where: { id: request.id },
        data: {
          current_level: 'SUPER_ADMIN',
          history: ((request.history as any[]) || []).concat([
            {
              level: 'BRANCH_MANAGER',
              action: 'APPROVED',
              by: actor.userId,
              at: new Date().toISOString(),
            },
          ]),
        },
      });

      await this.notificationsService.notifyAdmins({
        senderId: actor.userId,
        title: 'Employee Transfer Request Awaiting Admin Approval',
        message:
          'An employee transfer request has been approved by the Branch Manager and requires final admin approval.',
        type: 'TRANSFER_REQUEST',
        referenceId: request.uuid,
        metadata: { level: 'SUPER_ADMIN' },
      });

      return this.serializeTransferRequest(updated);
    }

    if (request.current_level === 'SUPER_ADMIN') {
      if (!isAdmin) {
        throw new ForbiddenException(
          'Only an Admin can finalize this transfer.',
        );
      }

      const employee = await this.prisma.employees.findUniqueOrThrow({
        where: { id: request.employee_id },
      });

      const updated = await this.prisma.$transaction(async (tx) => {
        const transferred = await tx.employees.update({
          where: { id: request.employee_id! },
          data: {
            working_location_id: request.new_working_location_id,
            department_id: request.new_department_id,
          },
          include: this.employeeIncludes(),
        });

        await tx.employee_history.create({
          data: {
            uuid: generateUUID(),
            employee_id: employee.id,
            action_type: ACTION_TYPE.TRANSFER,
            old_department_id: employee.department_id,
            new_department_id: request.new_department_id,
            old_location_id: employee.working_location_id,
            new_location_id: request.new_working_location_id,
            old_employment_category_id: employee.employment_category_id,
            new_employment_category_id: employee.employment_category_id,
            status: STATUS_ACTIVE_INACTIVE.ACTIVE,
            reason: request.reason,
            changed_by: BigInt(actor.userId),
            approved_by: BigInt(actor.userId),
          },
        });

        await tx.transfer_requests.update({
          where: { id: request.id },
          data: {
            status: APPROVAL_STATUS.APPROVED,
            approved_by: BigInt(actor.userId),
            approved_at: new Date(),
            current_level: 'FINALIZED',
            history: ((request.history as any[]) || []).concat([
              {
                level: 'SUPER_ADMIN',
                action: 'APPROVED',
                by: actor.userId,
                at: new Date().toISOString(),
              },
            ]),
          },
        });

        return transferred;
      });

      // Notify the requestor
      await this.notificationsService.create({
        userId: request.requested_by,
        senderId: actor.userId,
        title: 'Employee Transfer Request Finalized',
        message: `Your transfer request for ${employee.first_name} ${employee.last_name} has been fully approved.`,
        type: 'TRANSFER_APPROVED',
        referenceId: request.uuid,
      });

      await this.clearEmployeeCache();
      this.notificationsService.broadcast({ type: 'employees_updated' });

      return this.serializeEmployee(updated);
    }

    throw new BadRequestException('Invalid transfer request level.');
  }

  async rejectTransfer(
    requestUuid: string,
    dto: RejectTransferDto,
    actor: CurrentUserType,
  ) {
    const request = await this.findTransferRequestOrThrow(requestUuid);

    const rejected = await this.prisma.transfer_requests.update({
      where: {
        id: request.id,
      },
      data: {
        status: APPROVAL_STATUS.REJECTED,
        rejection_reason: dto.rejection_reason,
        approved_by: BigInt(actor.userId),
        approved_at: new Date(),
        current_level: 'REJECTED',
        history: ((request.history as any[]) || []).concat([
          {
            level: request.current_level,
            action: 'REJECTED',
            by: actor.userId,
            at: new Date().toISOString(),
            reason: dto.rejection_reason,
          },
        ]),
      },
    });

    // Notify the requestor
    await this.notificationsService.create({
      userId: request.requested_by,
      senderId: actor.userId,
      title: 'Employee Transfer Request Rejected',
      message: `Your transfer request was rejected. Reason: ${dto.rejection_reason}`,
      type: 'TRANSFER_REJECTED',
      referenceId: request.uuid,
    });

    return this.serializeTransferRequest(rejected);
  }

  async suspend(uuid: string, dto: SuspendEmployeeDto, actor: CurrentUserType) {
    return this.changeStatus(
      uuid,
      STATUS_USER.SUSPENDED,
      ACTION_TYPE.SUSPENDED,
      dto.reason,
      actor,
    );
  }

  async reactivate(uuid: string, actor: CurrentUserType) {
    return this.changeStatus(
      uuid,
      STATUS_USER.ACTIVE,
      ACTION_TYPE.UPDATE,
      'Employee reactivated.',
      actor,
    );
  }

  async bulkImport(dto: BulkImportEmployeeDto, actor: CurrentUserType) {
    if (!dto.employees || dto.employees.length === 0) {
      throw new BadRequestException('No employees provided for bulk import.');
    }

    if (dto.employees.length > 500) {
      throw new BadRequestException('Maximum 500 employees allowed per bulk import.');
    }

    const results: any[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < dto.employees.length; i++) {
      const item = dto.employees[i];
      const rowNum = i + 1;

      try {
        if (!item.first_name || !item.last_name) {
          throw new BadRequestException('First name and last name are required.');
        }

        const managerScoped =
          actor?.roles?.some((role) => ['BRANCH_MANAGER'].includes(role)) &&
          !this.isSystemAdmin(actor);
        const effectiveWorkingLocationInput =
          managerScoped && actor?.working_location_id
            ? actor.working_location_id
            : item.working_location_id;
        const workingLocationId = effectiveWorkingLocationInput
          ? await this.resolveWorkingLocationId(effectiveWorkingLocationInput)
          : null;

        const departmentId = item.department_id
          ? await this.resolveDepartmentId(item.department_id, workingLocationId)
          : null;

        const categoryId = item.employment_category_id
          ? this.toBigInt(item.employment_category_id, 'employment_category_id')
          : null;

        if (workingLocationId && departmentId) {
          await this.ensureOrganization(workingLocationId, departmentId);
        }

        if (categoryId) {
          await this.ensureEmploymentCategory(categoryId);
        }

        this.ensureActorCanUseScope(
          actor,
          workingLocationId,
          departmentId,
          'bulk import employees',
        );

        const created = await this.prisma.$transaction(async (tx) => {
          // Duplicate checks
          if (item.email) {
            const existing = await tx.employees.findFirst({
              where: { email: item.email, deleted_at: null },
              select: { uuid: true },
            });
            if (existing) {
              throw new BadRequestException(
                `An employee with email "${item.email}" already exists (uuid: ${existing.uuid}).`,
              );
            }
          }

          if (item.phone_number) {
            const existing = await tx.employees.findFirst({
              where: { phone_number: item.phone_number, deleted_at: null },
              select: { uuid: true },
            });
            if (existing) {
              throw new BadRequestException(
                `An employee with phone number "${item.phone_number}" already exists (uuid: ${existing.uuid}).`,
              );
            }
          }

          if (item.national_id) {
            const existing = await tx.employees.findFirst({
              where: { national_id: item.national_id, deleted_at: null },
              select: { uuid: true },
            });
            if (existing) {
              throw new BadRequestException(
                `An employee with national ID "${item.national_id}" already exists (uuid: ${existing.uuid}).`,
              );
            }
          }

          const created = await tx.employees.create({
            data: {
              uuid: generateUUID(),
              first_name: item.first_name,
              last_name: item.last_name,
              email: item.email,
              phone_number: item.phone_number,
              national_id: item.national_id,
              gender: item.gender as any,
              contract_start_date: item.contract_start_date ? new Date(item.contract_start_date) : null,
              contract_end_date: item.contract_end_date ? new Date(item.contract_end_date) : null,
              department_id: departmentId,
              working_location_id: workingLocationId,
              employment_category_id: categoryId,
              status: STATUS_USER.ACTIVE,
              created_by: BigInt(actor.userId),
            },
            include: this.employeeIncludes(),
          });

          // Create payment structure if category and salary info provided
          if (categoryId && (item.basic_salary || item.daily_rate)) {
            const category = await tx.employment_categories.findUnique({
              where: { id: categoryId },
            });
            if (category) {
              const isCustom = category.payroll_frequency === 'CUSTOM';
              const dailyRate = category.payroll_frequency === 'MONTHLY'
                ? (item.daily_rate ?? '5000')
                : (item.daily_rate ?? '3000');

              await tx.payment_structures.create({
                data: {
                  uuid: generateUUID(),
                  employee_id: created.id,
                  payroll_frequency: category.payroll_frequency,
                  basic_salary: category.payroll_frequency === 'MONTHLY'
                    ? (item.basic_salary ?? '150000')
                    : isCustom
                      ? this.resolveCustomBasicSalary(
                          dailyRate,
                          created.contract_start_date,
                          created.contract_end_date,
                          item.basic_salary ?? '0',
                        )
                      : '0',
                  daily_rate: dailyRate,
                  overtime_rate: '0',
                  tax_percentage: item.tax_percentage ?? '0',
                  effective_from: new Date(),
                },
              });
            }
          }

          await tx.audit_logs.create({
            data: {
              user_id: BigInt(actor.userId),
              employee_id: created.id,
              entity_table: 'employees',
              entity_id: created.id,
              module_name: 'EMPLOYEES',
              activity_type: ACTIVITY_TYPE.CREATE,
              activity_description: 'Bulk imported employee profile.',
              action: AUDIT_ACTION.CREATED,
              new_values: {
                working_location_id: workingLocationId?.toString() ?? null,
                department_id: departmentId?.toString() ?? null,
                employment_category_id: categoryId?.toString() ?? null,
              },
            },
          });

          return created;
        });

        results.push(this.serializeEmployee(created));
      } catch (error: any) {
        errors.push({
          row: rowNum,
          message: error?.message ?? 'Unknown error occurred',
        });
      }
    }

    await this.clearEmployeeCache();
    this.notificationsService.broadcast({ type: 'employees_updated' });

    if (errors.length > 0) {
      return {
        imported: results.length,
        total: dto.employees.length,
        employees: results,
        errors,
      };
    }

    return {
      imported: results.length,
      total: dto.employees.length,
      employees: results,
    };
  }

  /**
   * Runs once a day (just after midnight) so an employee is automatically
   * paused the day after their contract ends, instead of waiting for the
   * next payroll batch to be created for their branch (which is the only
   * other place this was previously triggered from). Requires
   * `@nestjs/schedule`'s ScheduleModule.forRoot() to be registered in
   * app.module.ts for this decorator to actually fire.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async autoPauseExpiredContractsCron() {
    await this.autoPauseExpiredContracts();
  }

  /**
   * Auto-pause employees whose contract end date has passed
   * Only applies to DAILY and CUSTOM employment categories
   */
  async autoPauseExpiredContracts(workingLocationId?: bigint) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find daily/custom employees with expired contracts
    const expiredEmployees = await this.prisma.employees.findMany({
      where: {
        status: STATUS_USER.ACTIVE,
        contract_end_date: {
          lt: today,
        },
        employment_category: {
          name: {
            in: ['DAILY', 'CUSTOM'],
          },
        },
        ...(workingLocationId && { working_location_id: workingLocationId }),
        deleted_at: null,
      },
      include: this.employeeIncludes(),
    });

    if (expiredEmployees.length === 0) {
      return { paused_count: 0 };
    }

    // Update all expired employees to PAUSED status
    await this.prisma.$transaction(async (tx) => {
      for (const employee of expiredEmployees) {
        const reason = employee.contract_end_date
          ? `Contract working days have ended (ended ${employee.contract_end_date.toISOString().split('T')[0]}).`
          : 'Contract working days have ended.';
        await tx.employees.update({
          where: { id: employee.id },
          data: { status: STATUS_USER.PAUSED, pause_reason: reason },
        });

        // Log the pause action
        await tx.employee_history.create({
          data: {
            uuid: generateUUID(),
            employee_id: employee.id,
            action_type: ACTION_TYPE.SUSPENDED,
            old_department_id: employee.department_id,
            new_department_id: employee.department_id,
            old_location_id: employee.working_location_id,
            new_location_id: employee.working_location_id,
            old_employment_category_id: employee.employment_category_id,
            new_employment_category_id: employee.employment_category_id,
            status: STATUS_ACTIVE_INACTIVE.INACTIVE,
            reason: `Contract ended on ${employee.contract_end_date?.toISOString().split('T')[0]}. Employee paused automatically.`,
            changed_by: BigInt(1), // System user
            approved_by: BigInt(1),
          },
        });

        // Create audit log
        await tx.audit_logs.create({
          data: {
            user_id: BigInt(1), // System user
            employee_id: employee.id,
            entity_table: 'employees',
            entity_id: employee.id,
            module_name: 'EMPLOYEES',
            activity_type: ACTIVITY_TYPE.UPDATE,
            activity_description: 'Employee auto-paused: contract end date expired.',
            action: AUDIT_ACTION.UPDATED,
            old_values: {
              status: employee.status,
            },
            new_values: {
              status: STATUS_USER.PAUSED,
              contract_end_date: employee.contract_end_date?.toISOString(),
            },
            changed_fields: ['status'],
          },
        });
      }
    });

    await this.clearEmployeeCache();
    this.notificationsService.broadcast({ type: 'employees_updated' });

    return { paused_count: expiredEmployees.length };
  }

  private async changeStatus(
    uuid: string,
    status: STATUS_USER,
    actionType: ACTION_TYPE,
    reason: string | undefined,
    actor: CurrentUserType,
  ) {
    const employee = await this.findEmployeeByUuidOrThrow(uuid);

    if (
      !employee.working_location_id ||
      !employee.department_id ||
      !employee.employment_category_id
    ) {
      throw new BadRequestException(
        'Employee must be approved before status changes.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.employees.update({
        where: {
          id: employee.id,
        },
        data: {
          status,
        },
        include: this.employeeIncludes(),
      });

      await tx.employee_history.create({
        data: {
          uuid: generateUUID(),
          employee_id: employee.id,
          action_type: actionType,
          old_department_id: employee.department_id,
          new_department_id: employee.department_id,
          old_location_id: employee.working_location_id,
          new_location_id: employee.working_location_id,
          old_employment_category_id: employee.employment_category_id,
          new_employment_category_id: employee.employment_category_id,
          status:
            status === STATUS_USER.ACTIVE
              ? STATUS_ACTIVE_INACTIVE.ACTIVE
              : STATUS_ACTIVE_INACTIVE.INACTIVE,
          reason,
          changed_by: BigInt(actor.userId),
          approved_by: BigInt(actor.userId),
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          employee_id: employee.id,
          entity_table: 'employees',
          entity_id: employee.id,
          module_name: 'EMPLOYEES',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: `Employee status changed to ${status}.`,
          action: AUDIT_ACTION.UPDATED,
          old_values: {
            status: employee.status,
          },
          new_values: {
            status,
            reason,
          },
          changed_fields: ['status'],
        },
      });

      return changed;
    });

    await this.clearEmployeeCache();
    this.notificationsService.broadcast({ type: 'employees_updated' });

    return this.serializeEmployee(updated);
  }

  private async resolveWorkingLocationId(value: string) {
    requireUuidOrNumeric(value, 'working_location_id');

    const workingLocation = await this.prisma.working_locations.findFirst({
      where: isNumericId(value)
        ? {
            id: BigInt(value),
            deleted_at: null,
          }
        : {
            uuid: value,
            deleted_at: null,
          },
      select: {
        id: true,
      },
    });

    if (!workingLocation) {
      throw new BadRequestException('Working location does not exist.');
    }

    return workingLocation.id;
  }

  private async resolveDepartmentId(
    value: string,
    workingLocationId?: bigint | null,
  ) {
    requireUuidOrNumeric(value, 'department_id');

    const department = await this.prisma.departments.findFirst({
      where: {
        ...(isNumericId(value) ? { id: BigInt(value) } : { uuid: value }),
        ...(workingLocationId
          ? {
              working_location_id: workingLocationId,
            }
          : {}),
        status: STATUS_ACTIVE_INACTIVE.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!department) {
      throw new BadRequestException(
        'Department does not exist for the selected working location.',
      );
    }

    return department.id;
  }

  private async findEmployeeByUuidOrThrow(uuid: string) {
    const employee = await this.prisma.employees.findUnique({
      where: { uuid },
    });

    if (!employee || employee.deleted_at) {
      throw new NotFoundException('Employee not found.');
    }

    return employee;
  }

  private async findTransferRequestOrThrow(uuid: string) {
    const request = await this.prisma.transfer_requests.findFirst({
      where: {
        uuid,
        subject_type: TRANSFER_SUBJECT.EMPLOYEE,
        status: APPROVAL_STATUS.PENDING,
      },
    });

    if (!request) {
      throw new NotFoundException(
        'Pending employee transfer request not found.',
      );
    }

    return request;
  }

  private async ensureOrganization(
    workingLocationId: bigint,
    departmentId: bigint,
  ) {
    const department = await this.prisma.departments.findFirst({
      where: {
        id: departmentId,
        working_location_id: workingLocationId,
        status: STATUS_ACTIVE_INACTIVE.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!department) {
      throw new BadRequestException(
        'Department does not exist for the selected working location.',
      );
    }
  }

  private async ensureEmploymentCategory(categoryId: bigint) {
    const category = await this.prisma.employment_categories.findFirst({
      where: {
        id: categoryId,
        status: STATUS_ACTIVE_INACTIVE.ACTIVE,
      },
      select: {
        id: true,
      },
    });

    if (!category) {
      throw new BadRequestException(
        'Employment category does not exist or is inactive.',
      );
    }
  }

  private employeeIncludes() {
    return {
      createdBy: true,
      department: true,
      working_location: true,
      employment_category: true,
      // Include the most recent active payment structure
      payment_structures: {
        orderBy: { effective_from: 'desc' as const },
        take: 1,
      },
      // Include all attendance for accurate rate calculation
      time_records: {
        orderBy: { attendance_date: 'desc' as const },
      },
    };
  }

  private serializeEmployee(employee: Record<string, any>) {
    const timeRecords = employee.time_records || [];

    // Improved Attendance Logic:
    // 1. If we have NO records at all, rate is 0%.
    // 2. If we have records, calculate present percentage.

    const presentCount = timeRecords.filter(
      (r) => r.attendance_status === ATTENDANCE_STATUS.PRESENT,
    ).length;

    const attendanceRate = timeRecords.length
      ? Math.round((presentCount / timeRecords.length) * 100)
      : 0;

    const latestRecord = timeRecords[0];

    return {
      ...employee,
      id: employee.id.toString(),
      created_by: employee.created_by?.toString() ?? null,
      department_id: employee.department_id?.toString() ?? null,
      working_location_id: employee.working_location_id?.toString() ?? null,
      employment_category_id:
        employee.employment_category_id?.toString() ?? null,
      attendance_stats: {
        rate: attendanceRate,
        last_status: latestRecord?.attendance_status ?? null,
        last_date: latestRecord?.attendance_date ?? null,
        record_count: timeRecords.length,
      },
    };
  }

  private serializeTransferRequest(request: Record<string, any>) {
    return {
      ...request,
      id: request.id.toString(),
      user_id: request.user_id?.toString() ?? null,
      employee_id: request.employee_id?.toString() ?? null,
      old_working_location_id:
        request.old_working_location_id?.toString() ?? null,
      new_working_location_id: request.new_working_location_id.toString(),
      old_department_id: request.old_department_id?.toString() ?? null,
      new_department_id: request.new_department_id?.toString() ?? null,
      requested_by: request.requested_by.toString(),
      approved_by: request.approved_by?.toString() ?? null,
    };
  }

  private isSystemAdmin(actor?: CurrentUserType) {
    return !!actor?.roles?.some((role) => ['SUPER_ADMIN'].includes(role));
  }

  private employeeScopeWhere(actor: CurrentUserType) {
    if (this.isSystemAdmin(actor)) {
      return {};
    }

    const where: Record<string, any> = {};

    if (actor.working_location_id) {
      where.working_location_id = BigInt(actor.working_location_id);
    }

    const isBranchManager = actor.roles.some((role) =>
      ['BRANCH_MANAGER'].includes(role),
    );

    const isAttendanceActor =
      actor.permissions.includes('attendance.create') ||
      actor.permissions.includes('attendance.read') ||
      actor.permissions.includes('attendance.update') ||
      actor.permissions.includes('attendance.approve');

    if (!isBranchManager && isAttendanceActor && actor.department_id) {
      where.department_id = BigInt(actor.department_id);
    }

    return where;
  }

  private ensureActorCanAccessEmployee(
    actor: CurrentUserType,
    employee: {
      working_location_id?: bigint | null;
      department_id?: bigint | null;
    },
  ) {
    if (this.isSystemAdmin(actor)) {
      return;
    }

    if (
      actor.working_location_id &&
      employee.working_location_id?.toString() !== actor.working_location_id
    ) {
      throw new ForbiddenException(
        'You can only access employees in your working location.',
      );
    }

    const isBranchManager = actor.roles.some((role) =>
      ['BRANCH_MANAGER'].includes(role),
    );

    const isAttendanceActor =
      actor.permissions.includes('attendance.create') ||
      actor.permissions.includes('attendance.read') ||
      actor.permissions.includes('attendance.update') ||
      actor.permissions.includes('attendance.approve');

    if (
      !isBranchManager &&
      isAttendanceActor &&
      actor.department_id &&
      employee.department_id?.toString() !== actor.department_id
    ) {
      throw new ForbiddenException(
        'Attendance users can only access employees in their department.',
      );
    }
  }

  private ensureActorCanUseScope(
    actor: CurrentUserType | undefined,
    workingLocationId: bigint | null,
    departmentId: bigint | null,
    action: string,
  ) {
    if (!actor || this.isSystemAdmin(actor)) {
      return;
    }

    if (
      actor.working_location_id &&
      workingLocationId?.toString() !== actor.working_location_id
    ) {
      throw new ForbiddenException(
        `You can only ${action} in your working location.`,
      );
    }

    const isBranchManager = actor.roles.some((role) =>
      ['BRANCH_MANAGER'].includes(role),
    );

    const isAttendanceActor =
      actor.permissions.includes('attendance.create') ||
      actor.permissions.includes('attendance.update');

    if (
      !isBranchManager &&
      isAttendanceActor &&
      actor.department_id &&
      departmentId?.toString() !== actor.department_id
    ) {
      throw new ForbiddenException(
        `You can only ${action} in your department.`,
      );
    }
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
