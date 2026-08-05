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
    // Cache key includes the actor's working_location_id and user ID so that
    // one actor's branch-scoped response never leaks to a different actor
    // scoped to a different branch under a colliding key. SUPER_ADMIN calls
    // without a specific location get 'all' (no branch scope to collide on).
    const actorId = actor?.userId ?? 'anonymous';
    const cacheKey = `departments_${workingLocationId ?? 'all'}_${q}_${actorId}`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

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
      },
      orderBy: { name: 'asc' },
    });

    const result = {
      departments: departments.map((d) => serializeDepartment(d)),
    };
    await this.cacheManager.set(cacheKey, result, 60000);
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
    });
    if (!current) throw new NotFoundException('Department not found.');
    this.ensureActorCanManageDepartment(actor, current.working_location_id);

    await this.prisma.$transaction(async (tx) => {
      await tx.departments.updateMany({
        where: {
          code: current.code,
          working_location_id: current.working_location_id,
          status: 'ACTIVE',
        },
        data: { status: 'INACTIVE' },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'departments',
          entity_id: current.id,
          module_name: 'DEPARTMENTS',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Soft deleted department for working location.',
          action: AUDIT_ACTION.UPDATED,
          old_values: { status: current.status },
          new_values: { status: 'INACTIVE' },
        },
      });
    });

    await this.cacheManager.del('working_locations');
    this.notificationsService.broadcast({ type: 'departments_updated' });
    return { message: 'Department deleted' };
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
      where: { code, working_location_id: workingLocationId },
      include: { working_locations: true },
    });

    if (existing?.status === 'ACTIVE') {
      return serializeDepartment(existing);
    }

    const normalizedNew = normalizeName(dto.name);
    const activeDepartments = await this.prisma.departments.findMany({
      where: {
        status: 'ACTIVE',
        code: { not: code },
        working_location_id: workingLocationId,
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
            data: { status: 'ACTIVE', name: dto.name, description: dto.description },
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
          new_values: { status: 'ACTIVE', code, name: dto.name },
        },
      });

      return saved;
    });

    await this.cacheManager.del('working_locations');
    this.notificationsService.broadcast({ type: 'departments_updated' });
    return serializeDepartment(result);
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
