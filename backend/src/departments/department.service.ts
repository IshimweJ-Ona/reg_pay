import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import {
  audit_logs_activity_type as ACTIVITY_TYPE,
  audit_logs_action as AUDIT_ACTION,
  Prisma,
} from '@prisma/client';

import type { CurrentUserType } from '../auth/types/current-user.type';
import { hasEffectivePermission } from '../common/utils/effective-permissions.util';
import {
  isNumericId,
  normalizeEntityName,
  normalizeSearch,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { EnableDepartmentAtLocationDto } from './dto/enable-department-at-location.dto';
import { serializeDepartment } from './department.model';

function normalizeName(name: string): string {
  return normalizeEntityName(name);
}

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  // Permission check is handled entirely by @Permissions('departments.manage')
  // + PermissionsGuard at the controller. No role check here — this keeps
  // any custom role holding that permission key able to call this method.
  async createDepartment(dto: CreateDepartmentDto, actor: CurrentUserType) {
    if (!dto.code || !dto.name) {
      throw new BadRequestException('Department code and name are required.');
    }
    const departmentCode = dto.code;
    const departmentName = dto.name;

    const targetLocations = await this.resolveDepartmentWriteLocations(actor);

    const activeDepartments = await this.prisma.departments.findMany({
      where: {
        status: 'ACTIVE',
        working_location_id: { in: targetLocations },
      },
      select: { name: true },
    });
    const normalizedNew = normalizeName(departmentName);
    const duplicate = activeDepartments.find(
      (d) => normalizeName(d.name) === normalizedNew,
    );
    if (duplicate) {
      throw new BadRequestException(
        `A department named '${duplicate.name}' already exists.`,
      );
    }

    const departments = await this.prisma.$transaction(async (tx) => {
      await tx.departments.createMany({
        data: targetLocations.map((workingLocationId) => ({
          uuid: generateUUID(),
          working_location_id: workingLocationId,
          code: departmentCode,
          name: departmentName,
          description: dto.description,
          updated_at: new Date(),
        })),
        skipDuplicates: true,
      });

      const created = await tx.departments.findMany({
        where: {
          code: departmentCode,
          working_location_id: { in: targetLocations },
        },
        include: { working_locations: true },
        orderBy: { working_location_id: 'asc' },
      });

      if (!created.length) {
        throw new BadRequestException(
          'Department already exists in all working locations.',
        );
      }

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'departments',
          entity_id: created[0].id,
          module_name: 'DEPARTMENTS',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: this.canReadAllBranches(actor)
            ? 'Created global department across all working locations.'
            : 'Created branch department.',
          action: AUDIT_ACTION.CREATED,
          old_values: Prisma.JsonNull,
          new_values: {
            code: dto.code,
            name: dto.name,
            description: dto.description ?? null,
          },
        },
      });

      return created;
    });

    await this.cacheManager.del('working_locations');
    this.notificationsService.broadcast({ type: 'departments_updated' });
    return { departments: departments.map((d) => serializeDepartment(d)) };
  }

  async findDepartments(
    actor?: CurrentUserType,
    workingLocationIdInput?: string,
    qInput?: string,
  ) {
    let workingLocationId: bigint | undefined;
    const canReadAllBranches = this.canReadAllBranches(actor);

    if (workingLocationIdInput) {
      workingLocationId = await this.resolveWorkingLocationId(
        workingLocationIdInput,
      );

      if (
        actor &&
        !canReadAllBranches &&
        actor.working_location_id &&
        workingLocationId.toString() !== actor.working_location_id
      ) {
        throw new BadRequestException(
          'You can only access departments in your working location.',
        );
      }
    } else if (actor && !canReadAllBranches && actor.working_location_id) {
      workingLocationId = BigInt(actor.working_location_id);
    }

    const q = normalizeSearch(qInput);
    const departments = await this.prisma.departments.findMany({
      where: {
        working_location_id: workingLocationId,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { code: { contains: q } },
                { description: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        working_locations: true,
        _count: { select: { users: true, employees: true } },
        department_deactivation_requests: {
          where: { status: 'PENDING' },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = {
      departments: departments.map((d) => serializeDepartment(d)),
    };
    return result;
  }

  // Edits always apply to exactly this one working_location's row - a
  // rename/code change never fans out to other locations sharing the same
  // name/code, even for a read-all actor. Each location's department is
  // managed independently once you've drilled into it.
  async updateDepartment(
    uuid: string,
    dto: UpdateDepartmentDto,
    actor: CurrentUserType,
  ) {
    const current = await this.prisma.departments.findUnique({
      where: { uuid },
    });
    if (!current) throw new NotFoundException('Department not found.');
    this.ensureActorCanManageDepartment(actor, current.working_location_id);

    const newName = dto.name ?? current.name;
    const newCode = dto.code ?? current.code;
    const newDescription = dto.description ?? current.description;

    const activeDepartments = await this.prisma.departments.findMany({
      where: {
        status: 'ACTIVE',
        code: { not: current.code },
        working_location_id: current.working_location_id,
      },
      select: { name: true },
    });

    const normalizedNew = normalizeName(newName);
    const duplicate = activeDepartments.find(
      (d) => normalizeName(d.name) === normalizedNew,
    );
    if (duplicate) {
      throw new BadRequestException(
        `A department named '${duplicate.name}' already exists.`,
      );
    }

    const oldValues = {
      code: current.code,
      name: current.name,
      description: current.description,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.departments.update({
        where: { id: current.id },
        data: { name: newName, code: newCode, description: newDescription },
        include: { working_locations: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'departments',
          entity_id: saved.id,
          module_name: 'DEPARTMENTS',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated department details.',
          action: AUDIT_ACTION.UPDATED,
          old_values: oldValues,
          new_values: {
            code: saved.code,
            name: saved.name,
            description: saved.description,
          },
        },
      });

      return saved;
    });

    await this.cacheManager.del('working_locations');
    this.notificationsService.broadcast({ type: 'departments_updated' });
    return serializeDepartment(updated);
  }

  async deleteDepartment(uuid: string, actor: CurrentUserType) {
    const current = await this.prisma.departments.findUnique({
      where: { uuid },
      include: {
        working_locations: true,
        _count: { select: { users: true, employees: true } },
        department_deactivation_requests: {
          where: { status: 'PENDING' },
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });
    if (!current) throw new NotFoundException('Department not found.');
    this.ensureActorCanManageDepartment(actor, current.working_location_id);

    if (current.status === 'INACTIVE') {
      return {
        message: 'Department is already archived.',
        status: 'ARCHIVED',
        department: serializeDepartment(current),
      };
    }

    const remainingEmployees = await this.countAssignedEmployees(current.id);

    if (remainingEmployees > 0) {
      return this.requestDepartmentDeactivation(
        current,
        actor,
        remainingEmployees,
      );
    }

    const archived = await this.archiveDepartmentNow(
      current.id,
      actor.userId,
      'Archived empty department for working location.',
    );

    return {
      message: 'Department archived.',
      status: 'ARCHIVED',
      department: serializeDepartment(archived),
    };
  }

  // Toggles a department "on" for one specific working location - the
  // counterpart to deleteDepartment's per-location "off" toggle. Reactivates
  // an archived (INACTIVE) row for that (code, location) pair if one exists,
  // otherwise creates a fresh row there. SUPER_ADMIN / branches.read_all only:
  // a branch-scoped manager can already reach this department via the normal
  // createDepartment/deleteDepartment flow for their own branch, but assigning
  // it to an arbitrary *other* location is a cross-branch action.
  async enableAtLocation(
    code: string,
    workingLocationIdInput: string,
    dto: EnableDepartmentAtLocationDto,
    actor: CurrentUserType,
  ) {
    if (!this.canReadAllBranches(actor)) {
      throw new ForbiddenException(
        'Only Super Admins (or branches.read_all) can assign a department to another working location.',
      );
    }

    const workingLocationId = await this.resolveWorkingLocationId(
      workingLocationIdInput,
    );

    const existing = await this.prisma.departments.findFirst({
      where: {
        working_location_id: workingLocationId,
        OR: [{ code }, { name: dto.name }],
      },
      include: { working_locations: true },
      orderBy: [{ status: 'desc' }, { created_at: 'asc' }],
    });

    if (existing?.status === 'ACTIVE') {
      return serializeDepartment(existing);
    }

    const normalizedNew = normalizeName(dto.name);
    const activeDepartments = await this.prisma.departments.findMany({
      where: {
        status: 'ACTIVE',
        working_location_id: workingLocationId,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      select: { name: true },
    });
    const duplicate = activeDepartments.find(
      (d) => normalizeName(d.name) === normalizedNew,
    );
    if (duplicate) {
      throw new BadRequestException(
        `A department named '${duplicate.name}' already exists at this location.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.departments.update({
            where: { id: existing.id },
            data: {
              status: 'ACTIVE',
              name: dto.name,
              description: dto.description,
              updated_at: new Date(),
            },
            include: { working_locations: true },
          })
        : await tx.departments.create({
            data: {
              uuid: generateUUID(),
              working_location_id: workingLocationId,
              code,
              name: dto.name,
              description: dto.description,
              updated_at: new Date(),
            },
            include: { working_locations: true },
          });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'departments',
          entity_id: saved.id,
          module_name: 'DEPARTMENTS',
          activity_type: existing ? ACTIVITY_TYPE.UPDATE : ACTIVITY_TYPE.CREATE,
          activity_description: existing
            ? 'Reactivated department for working location.'
            : 'Assigned department to an additional working location.',
          action: existing ? AUDIT_ACTION.UPDATED : AUDIT_ACTION.CREATED,
          old_values: existing
            ? { status: existing.status }
            : Prisma.JsonNull,
          new_values: {
            status: 'ACTIVE',
            code: saved.code,
            name: dto.name,
          },
        },
      });

      await tx.department_deactivation_requests.updateMany({
        where: { department_id: saved.id, status: 'PENDING' },
        data: {
          status: 'CANCELLED',
          remaining_employee_count: 0,
          completed_by: BigInt(actor.userId),
          completed_at: new Date(),
          updated_at: new Date(),
        },
      });

      return tx.departments.findUniqueOrThrow({
        where: { id: saved.id },
        include: {
          working_locations: true,
          _count: { select: { users: true, employees: true } },
          department_deactivation_requests: {
            where: { status: 'PENDING' },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });
    });

    await this.cacheManager.del('working_locations');
    await this.notificationsService.notifyBranchManager(workingLocationId, {
      senderId: actor.userId,
      title: 'Department Available Again',
      message: `${result.name} is now available again at ${result.working_locations.name}.`,
      type: 'DEPARTMENT_REACTIVATED',
      referenceId: result.uuid,
      metadata: {
        department_uuid: result.uuid,
        department_id: result.id.toString(),
        working_location_id: result.working_location_id.toString(),
      },
    });
    this.notificationsService.broadcast({ type: 'departments_updated' });
    return serializeDepartment(result);
  }

  async archivePendingDepartmentIfEmpty(
    departmentId: bigint,
    actorUserId: string | bigint,
  ) {
    const pending =
      await this.prisma.department_deactivation_requests.findFirst({
        where: { department_id: departmentId, status: 'PENDING' },
        include: {
          departments: { include: { working_locations: true } },
        },
      });

    if (!pending) return null;

    const remainingEmployees = await this.countAssignedEmployees(departmentId);

    if (remainingEmployees > 0) {
      await this.prisma.department_deactivation_requests.update({
        where: { id: pending.id },
        data: {
          remaining_employee_count: remainingEmployees,
          updated_at: new Date(),
        },
      });
      return null;
    }

    const archived = await this.archiveDepartmentNow(
      departmentId,
      actorUserId,
      'Automatically archived department after all employees were transferred.',
    );

    await this.notificationsService.notifyBranchManager(
      pending.working_location_id,
      {
        senderId: actorUserId,
        title: 'Department Archived Automatically',
        message: `${pending.departments.name} at ${pending.departments.working_locations.name} has been archived because all employees were transferred.`,
        type: 'DEPARTMENT_ARCHIVED',
        referenceId: pending.departments.uuid,
        metadata: {
          department_uuid: pending.departments.uuid,
          department_id: pending.department_id.toString(),
          working_location_id: pending.working_location_id.toString(),
        },
      },
    );

    return archived;
  }

  private async requestDepartmentDeactivation(
    department: Record<string, any>,
    actor: CurrentUserType,
    remainingEmployees: number,
  ) {
    const { request, created } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.department_deactivation_requests.findFirst({
        where: { department_id: department.id, status: 'PENDING' },
      });

      const saved = existing
        ? await tx.department_deactivation_requests.update({
            where: { id: existing.id },
            data: {
              remaining_employee_count: remainingEmployees,
              updated_at: new Date(),
            },
          })
        : await tx.department_deactivation_requests.create({
            data: {
              uuid: generateUUID(),
              department_id: department.id,
              working_location_id: department.working_location_id,
              requested_by: BigInt(actor.userId),
              requested_employee_count: remainingEmployees,
              remaining_employee_count: remainingEmployees,
              reason:
                'Department archive requested while employees are still assigned.',
              updated_at: new Date(),
            },
          });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'departments',
          entity_id: department.id,
          module_name: 'DEPARTMENTS',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: existing
            ? 'Refreshed pending department archive request.'
            : 'Requested department archive pending employee transfers.',
          action: AUDIT_ACTION.UPDATED,
          old_values: { status: department.status },
          new_values: {
            status: 'PENDING_TRANSFER',
            remaining_employee_count: remainingEmployees,
          },
        },
      });

      return { request: saved, created: !existing };
    });

    if (created) {
      await this.notificationsService.notifyBranchManager(
        department.working_location_id,
        {
          senderId: actor.userId,
          title: 'Transfer Employees Before Department Archive',
          message: `${department.name} at ${department.working_locations?.name ?? 'this working location'} has ${remainingEmployees} employee${remainingEmployees === 1 ? '' : 's'} assigned. Please transfer all employees out of this department; REG Pay will archive it automatically when the department is empty.`,
          type: 'DEPARTMENT_DEACTIVATION_REQUIRED',
          referenceId: request.uuid,
          metadata: {
            department_uuid: department.uuid,
            department_id: department.id.toString(),
            working_location_id: department.working_location_id.toString(),
            remaining_employee_count: remainingEmployees,
          },
        },
      );
    }

    await this.cacheManager.del('working_locations');
    this.notificationsService.broadcast({ type: 'departments_updated' });

    return {
      message: `Archive is pending. ${remainingEmployees} employee${remainingEmployees === 1 ? '' : 's'} must be transferred out first.`,
      status: 'PENDING_TRANSFER',
      remaining_employee_count: remainingEmployees,
      pending_deactivation: {
        uuid: request.uuid,
        requested_employee_count: request.requested_employee_count,
        remaining_employee_count: request.remaining_employee_count,
        requested_at: request.created_at,
      },
      department: serializeDepartment({
        ...department,
        department_deactivation_requests: [request],
      }),
    };
  }

  private async archiveDepartmentNow(
    departmentId: bigint,
    actorUserId: string | bigint,
    activityDescription: string,
  ) {
    const archived = await this.prisma.$transaction(async (tx) => {
      const before = await tx.departments.findUnique({
        where: { id: departmentId },
        include: {
          working_locations: true,
          _count: { select: { users: true, employees: true } },
        },
      });

      if (!before) {
        throw new NotFoundException('Department not found.');
      }

      if (before.status !== 'INACTIVE') {
        await tx.departments.update({
          where: { id: departmentId },
          data: { status: 'INACTIVE', updated_at: new Date() },
        });
      }

      await tx.department_deactivation_requests.updateMany({
        where: { department_id: departmentId, status: 'PENDING' },
        data: {
          status: 'COMPLETED',
          remaining_employee_count: 0,
          completed_by: BigInt(actorUserId),
          completed_at: new Date(),
          updated_at: new Date(),
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actorUserId),
          entity_table: 'departments',
          entity_id: departmentId,
          module_name: 'DEPARTMENTS',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: activityDescription,
          action: AUDIT_ACTION.UPDATED,
          old_values: { status: before.status },
          new_values: { status: 'INACTIVE' },
        },
      });

      return tx.departments.findUniqueOrThrow({
        where: { id: departmentId },
        include: {
          working_locations: true,
          _count: { select: { users: true, employees: true } },
          department_deactivation_requests: {
            where: { status: 'PENDING' },
            orderBy: { created_at: 'desc' },
            take: 1,
          },
        },
      });
    });

    await this.cacheManager.del('working_locations');
    this.notificationsService.broadcast({ type: 'departments_updated' });

    return archived;
  }

  private countAssignedEmployees(departmentId: bigint) {
    return this.prisma.employees.count({
      where: {
        department_id: departmentId,
        deleted_at: null,
      },
    });
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
      throw new NotFoundException('Working location not found.');
    return workingLocation.id;
  }

  private canReadAllBranches(actor?: CurrentUserType) {
    return !!(
      actor?.roles?.includes('SUPER_ADMIN') ||
      hasEffectivePermission(actor, 'branches.read_all')
    );
  }

  private async resolveDepartmentWriteLocations(actor: CurrentUserType) {
    if (!this.canReadAllBranches(actor)) {
      if (!actor.working_location_id) {
        throw new BadRequestException(
          'Your account has no working location assigned.',
        );
      }
      return [BigInt(actor.working_location_id)];
    }

    const locations = await this.prisma.working_locations.findMany({
      where: { deleted_at: null },
      select: { id: true },
    });

    if (!locations.length) {
      throw new BadRequestException(
        'Create a working location before creating departments.',
      );
    }

    return locations.map((location) => location.id);
  }

  private ensureActorCanManageDepartment(
    actor: CurrentUserType,
    workingLocationId: bigint,
  ) {
    if (this.canReadAllBranches(actor)) return;
    if (
      actor.working_location_id &&
      actor.working_location_id === workingLocationId.toString()
    ) {
      return;
    }
    throw new BadRequestException(
      'You can only manage departments in your working location.',
    );
  }
}
