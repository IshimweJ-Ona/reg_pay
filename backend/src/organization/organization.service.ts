import { BadRequestException, Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { ACTIVITY_TYPE, AUDIT_ACTION, WORKING_LOCATION_TYPE, Prisma } from '@prisma/client';

import type { CurrentUserType } from '../auth/types/current-user.type';
import { isNumericId, normalizeSearch, requireUuidOrNumeric } from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateWorkingLocationDto } from './dto/create-working-location.dto';
import { UpdateWorkingLocationDto } from './dto/update-working-location.dto';

function normalizeName(name: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ').trim();
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  // No role check — @Permissions('branches.manage') + PermissionsGuard
  // at the controller already gates this. Any role holding that permission
  // key can call it, and SUPER_ADMIN bypasses inside the guard.
  async createWorkingLocation(dto: CreateWorkingLocationDto, actor: CurrentUserType) {
    if (!dto.name || !dto.type || !dto.address) {
      throw new BadRequestException(
        'Name, type, and address are required to create a working location.',
      );
    }
    const locationName = dto.name;
    const locationType = dto.type;
    const locationAddress = dto.address;

    const activeLocations = await this.prisma.working_locations.findMany({
      where: { deleted_at: null },
      select: { name: true },
    });
    const normalizedNew = normalizeName(locationName);
    const duplicate = activeLocations.find((loc) => normalizeName(loc.name) === normalizedNew);
    if (duplicate) {
      throw new BadRequestException(`A working location named '${duplicate.name}' already exists.`);
    }

    if (locationType === WORKING_LOCATION_TYPE.HQ) {
      const existingHq = await this.prisma.working_locations.findFirst({
        where: { type: WORKING_LOCATION_TYPE.HQ, deleted_at: null },
        select: { id: true },
      });
      if (existingHq) throw new BadRequestException('Only one HQ can exist.');
    }

    const workingLocation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.working_locations.create({
        data: {
          uuid: generateUUID(),
          name: locationName,
          type: locationType,
          address: locationAddress,
          created_by: BigInt(actor.userId),
        },
      });

      const existingDepartments = await tx.departments.findMany({
        where: { status: 'ACTIVE' },
        distinct: ['code'],
        select: { code: true, name: true, description: true },
      });

      if (existingDepartments.length) {
        await tx.departments.createMany({
          data: existingDepartments.map((department) => ({
            uuid: generateUUID(),
            working_location_id: created.id,
            code: department.code,
            name: department.name,
            description: department.description,
          })),
          skipDuplicates: true,
        });
      }

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'working_locations',
          entity_id: created.id,
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: `Created ${locationType.toLowerCase()} working location.`,
          action: AUDIT_ACTION.CREATED,
          old_values: Prisma.JsonNull,
          new_values: { name: created.name, type: created.type, address: created.address },
        },
      });

      return created;
    });

    await this.cacheManager.del('working_locations');
    return this.serializeWorkingLocation(workingLocation);
  }

  async findWorkingLocations(actor?: CurrentUserType, qInput?: string, scope?: string) {
    const q = normalizeSearch(qInput);
    const isSuperAdmin = actor?.roles.includes('SUPER_ADMIN') ?? false;

    // Transfers are inherently cross-branch: the whole point is picking a
    // DIFFERENT working location than the employee's (and the actor's) own.
    // Restricting this list to just the actor's own branch — the normal,
    // correct behavior everywhere else this endpoint is used — would make
    // it impossible for a branch manager to ever choose a destination.
    // Only actors who actually hold a transfer permission get this bypass.
    const canSeeAllForTransfer =
      scope === 'transfer' &&
      !!actor &&
      (actor.permissions?.includes('employees.transfer') ||
        actor.permissions?.includes('employees.transfer_approve'));

    const isUnrestricted = isSuperAdmin || canSeeAllForTransfer;

    const cacheKey = actor
      ? q
        ? `working_locations_${actor.userId}_${q}_${scope ?? ''}`
        : `working_locations_${actor.userId}_${scope ?? ''}`
      : q
        ? `working_locations_${q}`
        : `working_locations_public`;

    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;

    const workingLocations = await this.prisma.working_locations.findMany({
      where: {
        deleted_at: null,
        ...(actor && !isUnrestricted && actor.working_location_id
          ? { id: BigInt(actor.working_location_id) }
          : {}),
        ...(q ? { OR: [{ name: { contains: q } }, { address: { contains: q } }] } : {}),
      },
      include: {
        _count: { select: { users: true, departments: true, employees: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    const result = {
      working_locations: workingLocations.map((wl) => this.serializeWorkingLocation(wl)),
    };

    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }

  async updateWorkingLocation(uuid: string, dto: UpdateWorkingLocationDto, actor: CurrentUserType) {
    const current = await this.prisma.working_locations.findFirst({
      where: { uuid, deleted_at: null },
    });
    if (!current) throw new NotFoundException('Branch not found.');

    const newName = dto.name ?? current.name;
    const newType = dto.type ?? current.type;
    const newAddress = dto.address ?? current.address;

    const activeLocations = await this.prisma.working_locations.findMany({
      where: { deleted_at: null, id: { not: current.id } },
      select: { name: true },
    });
    const normalizedNew = normalizeName(newName);
    const duplicate = activeLocations.find((loc) => normalizeName(loc.name) === normalizedNew);
    if (duplicate) {
      throw new BadRequestException(`A working location named '${duplicate.name}' already exists.`);
    }

    if (newType === WORKING_LOCATION_TYPE.HQ && current.type !== WORKING_LOCATION_TYPE.HQ) {
      const existingHq = await this.prisma.working_locations.findFirst({
        where: { type: WORKING_LOCATION_TYPE.HQ, deleted_at: null },
        select: { id: true },
      });
      if (existingHq) throw new BadRequestException('Only one headquarters branch can exist.');
    }

    const oldValues = { name: current.name, type: current.type, address: current.address };

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.working_locations.update({
        where: { id: current.id },
        data: {
          name: newName,
          type: newType,
          address: newAddress,
          updated_by: BigInt(actor.userId),
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'working_locations',
          entity_id: saved.id,
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated branch details.',
          action: AUDIT_ACTION.UPDATED,
          old_values: oldValues,
          new_values: { name: saved.name, type: saved.type, address: saved.address },
        },
      });

      return saved;
    });

    await this.cacheManager.del('working_locations');
    return this.serializeWorkingLocation(updated);
  }

  async deleteWorkingLocation(uuid: string, actor: CurrentUserType) {
    const current = await this.prisma.working_locations.findFirst({
      where: { uuid, deleted_at: null },
    });
    if (!current) throw new NotFoundException('Working location not found.');

    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.working_locations.update({
        where: { id: current.id },
        data: { deleted_at: new Date(), deleted_by: BigInt(actor.userId) },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'working_locations',
          entity_id: current.id,
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Soft deleted working location.',
          action: AUDIT_ACTION.UPDATED,
          old_values: { deleted_at: current.deleted_at },
          new_values: { deleted_at: new Date().toISOString() },
        },
      });

      return tx.working_locations.findUnique({ where: { id: current.id } });
    });

    await this.cacheManager.del('working_locations');
    return this.serializeWorkingLocation(deleted as any);
  }

  async assignBranchManager(
    workingLocationUuid: string,
    dto: AssignManagerDto,
    actor: CurrentUserType,
  ) {
    if (!dto.user_id) throw new BadRequestException('User is required.');
    const userId = await this.resolveUserId(dto.user_id);

    const branch = await this.prisma.working_locations.findFirst({
      where: { uuid: workingLocationUuid, deleted_at: null },
    });
    if (!branch) throw new NotFoundException('Working location not found.');

    const workingLocationId = branch.id;

    const user = await this.prisma.users.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        working_location_id: workingLocationId,
        deleted_at: null,
      },
    });
    if (!user) {
      throw new BadRequestException(
        'Branch manager must be an active user in that branch or HQ.',
      );
    }

    // A working location can only have one active manager at a time —
    // capture who (if anyone) held it before we reassign, for the audit log.
    const previousManager = await this.prisma.branch_managers.findFirst({
      where: { working_location_id: workingLocationId, is_active: true },
      select: { user_id: true },
    });

    const manager = await this.prisma.$transaction(async (tx) => {
      await tx.branch_managers.updateMany({
        where: { working_location_id: workingLocationId, is_active: true },
        data: { is_active: false, unassigned_at: new Date() },
      });

      const assigned = await tx.branch_managers.create({
        data: {
          uuid: generateUUID(),
          working_location_id: workingLocationId,
          user_id: userId,
          assigned_by: BigInt(actor.userId),
        },
        include: { user: true, branch: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'branch_managers',
          entity_id: assigned.id,
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Assigned active branch manager.',
          action: AUDIT_ACTION.UPDATED,
          old_values: {
            working_location_id: workingLocationId.toString(),
            user_id: previousManager?.user_id?.toString() ?? null,
          },
          new_values: {
            working_location_id: workingLocationId.toString(),
            user_id: userId.toString(),
          },
        },
      });

      return assigned;
    });

    return this.serializeManager(manager);
  }

  private serializeWorkingLocation(workingLocation: Record<string, any>) {
    return {
      ...workingLocation,
      id: workingLocation.id.toString(),
      created_by: workingLocation.created_by?.toString() ?? null,
      updated_by: workingLocation.updated_by?.toString() ?? null,
      deleted_by: workingLocation.deleted_by?.toString() ?? null,
    };
  }

  private async resolveUserId(value: string) {
    requireUuidOrNumeric(value, 'user_id');

    const user = await this.prisma.users.findFirst({
      where: isNumericId(value)
        ? { id: BigInt(value), deleted_at: null }
        : { uuid: value, deleted_at: null },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('User not found.');
    return user.id;
  }

  private serializeManager(manager: Record<string, any>) {
    return {
      ...manager,
      id: manager.id.toString(),
      working_location_id: manager.working_location_id?.toString(),
      user_id: manager.user_id.toString(),
      assigned_by: manager.assigned_by.toString(),
      user: manager.user
        ? {
            ...manager.user,
            id: manager.user.id.toString(),
            working_location_id: manager.user.working_location_id?.toString() ?? null,
            department_id: manager.user.department_id?.toString() ?? null,
          }
        : undefined,
    };
  }
}