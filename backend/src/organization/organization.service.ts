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
  WORKING_LOCATION_TYPE,
} from '@prisma/client';

import type { CurrentUserType } from '../auth/types/current-user.type';
import {
  isNumericId,
  normalizeSearch,
  requireUuidOrNumeric,
} from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';

import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateWorkingLocationDto } from './dto/create-working-location.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: cacheManager.Cache,
  ) {}

  async createWorkingLocation(
    dto: CreateWorkingLocationDto,
    actor: CurrentUserType,
  ) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException(
        'Only SUPER_ADMIN can create working locations.',
      );
    }
    if (dto.type === WORKING_LOCATION_TYPE.HQ) {
      const existingHq = await this.prisma.working_locations.findFirst({
        where: {
          type: WORKING_LOCATION_TYPE.HQ,
          deleted_at: null,
        },
        select: { id: true },
      });

      if (existingHq) {
        throw new BadRequestException('Only one HQ can exist.');
      }
    }

    const workingLocation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.working_locations.create({
        data: {
          uuid: generateUUID(),
          name: dto.name,
          type: dto.type,
          address: dto.address,
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
          activity_description: `Created ${dto.type.toLowerCase()} working location.`,
          action: AUDIT_ACTION.CREATED,
          new_values: {
            name: created.name,
            type: created.type,
            address: created.address,
          },
        },
      });

      return created;
    });

    // Invalidate working locations cache to reflect the new entry
    await this.cacheManager.del('working_locations');

    return this.serializeWorkingLocation(workingLocation);
  }

  // Find all working locations with optional query filter and caching
  async findWorkingLocations(actor?: CurrentUserType, qInput?: string) {
    const q = normalizeSearch(qInput);

    // Unauthenticated callers (login page dropdown) get all locations , no cache ket by user
    const isSuperAdmin = actor?.roles.includes('SUPER_ADMIN') ?? false;
    const cacheKey = actor
      ? q ? `working_locations_${actor.userId}_${q}` : `working_locations_${actor.userId}`
      : q ? `working_locations_${q}`: `working_locations_public`;

    // Check if the result is already in cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached as any;


    const workingLocations = await this.prisma.working_locations.findMany({
      where: {
        deleted_at: null,
        ...(actor && !isSuperAdmin && actor.working_location_id
          ? { id: BigInt(actor.working_location_id) }
          : {}),
        ...(q
          ? {
              OR: [{ name: { contains: q } }, { address: { contains: q } }],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            users: true,
            departments: true,
            employees: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    const result = {
      working_locations: workingLocations.map((workingLocation) =>
        this.serializeWorkingLocation(workingLocation),
      ),
    };

    // Store results in cache for 60 seconds
    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }

  async updateWorkingLocation(
    uuid: string,
    dto: CreateWorkingLocationDto,
    actor: CurrentUserType,
  ) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException(
        'Only a system administrator can update branches.',
      );
    }

    const current = await this.prisma.working_locations.findFirst({
      where: { uuid, deleted_at: null },
    });

    if (!current) {
      throw new NotFoundException('Branch not found.');
    }

    if (
      dto.type === WORKING_LOCATION_TYPE.HQ &&
      current.type !== WORKING_LOCATION_TYPE.HQ
    ) {
      const existingHq = await this.prisma.working_locations.findFirst({
        where: { type: WORKING_LOCATION_TYPE.HQ, deleted_at: null },
        select: { id: true },
      });

      if (existingHq) {
        throw new BadRequestException(
          'Only one headquarters branch can exist.',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.working_locations.update({
        where: { id: current.id },
        data: {
          name: dto.name,
          type: dto.type,
          address: dto.address,
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
          new_values: {
            name: saved.name,
            type: saved.type,
            address: saved.address,
          },
        },
      });

      return saved;
    });

    await this.cacheManager.del('working_locations');
    return this.serializeWorkingLocation(updated);
  }

  async createDepartment(dto: CreateDepartmentDto, actor: CurrentUserType) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException(
        'Only SUPER_ADMIN can create global departments.',
      );
    }

    const targetLocations = (
      await this.prisma.working_locations.findMany({
        where: { deleted_at: null },
        select: { id: true },
      })
    ).map((location) => location.id);

    if (!targetLocations.length) {
      throw new BadRequestException(
        'Create a working location before creating departments.',
      );
    }

    const departments = await this.prisma.$transaction(async (tx) => {
      await tx.departments.createMany({
        data: targetLocations.map((workingLocationId) => ({
          uuid: generateUUID(),
          working_location_id: workingLocationId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
        })),
        skipDuplicates: true,
      });

      const created = await tx.departments.findMany({
        where: {
          code: dto.code,
          working_location_id: { in: targetLocations },
        },
        include: { working_location: true },
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
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description:
            'Created global department across all working locations.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            code: dto.code,
            name: dto.name,
          },
        },
      });

      return created;
    });

    await this.cacheManager.del('working_locations');

    return {
      departments: departments.map((department) =>
        this.serializeDepartment(department),
      ),
    };
  }

  // Find departments for a working location with optional query filter and caching
  async findDepartments(
    actor?: CurrentUserType,
    workingLocationIdInput?: string,
    qInput?: string,
  ) {
    let workingLocationId: bigint | undefined;

    if (workingLocationIdInput) {
      workingLocationId = await this.resolveWorkingLocationId(
        workingLocationIdInput,
      );
    } else if (
      actor &&
      !actor.roles.includes('SUPER_ADMIN') &&
      actor.working_location_id
    ) {
      workingLocationId = BigInt(actor.working_location_id);
    }

    const q = normalizeSearch(qInput);
    const cacheKey = `departments_${workingLocationId ?? 'all'}_${q}`;

    // Check if the result is already in cache
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
        working_location: true,
        _count: {
          select: {
            users: true,
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = {
      departments: departments.map((department) =>
        this.serializeDepartment(department),
      ),
    };

    // Store results in cache for 60 seconds
    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }

  async updateDepartment(
    uuid: string,
    dto: CreateDepartmentDto,
    actor: CurrentUserType,
  ) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException(
        'Only a system administrator can update departments.',
      );
    }

    const current = await this.prisma.departments.findUnique({
      where: { uuid },
    });

    if (!current) {
      throw new NotFoundException('Department not found.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.departments.updateMany({
        where: { code: current.code, status: 'ACTIVE' },
        data: { name: dto.name, code: dto.code, description: dto.description },
      });

      const saved = await tx.departments.findUniqueOrThrow({
        where: { id: current.id },
        include: { working_location: true },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'departments',
          entity_id: saved.id,
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Updated department details.',
          action: AUDIT_ACTION.UPDATED,
          new_values: { code: saved.code, name: saved.name },
        },
      });

      return saved;
    });

    await this.cacheManager.del('working_locations');
    return this.serializeDepartment(updated);
  }

  async deleteWorkingLocation(uuid: string, actor: CurrentUserType) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException(
        'Only SUPER_ADMIN can delete working locations.',
      );
    }

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
          new_values: { deleted_at: new Date().toISOString() },
        },
      });

      return tx.working_locations.findUnique({ where: { id: current.id } });
    });

    await this.cacheManager.del('working_locations');
    return this.serializeWorkingLocation(deleted as any);
  }

  async deleteDepartment(uuid: string, actor: CurrentUserType) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException('Only SUPER_ADMIN can delete departments.');
    }

    const current = await this.prisma.departments.findUnique({
      where: { uuid },
    });
    if (!current) throw new NotFoundException('Department not found.');

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
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Soft deleted department for working location.',
          action: AUDIT_ACTION.UPDATED,
          new_values: { status: 'INACTIVE' },
        },
      });
    });

    await this.cacheManager.del('working_locations');
    return { message: 'Department deleted' };
  }

  async assignBranchManager(
    workingLocationUuid: string,
    dto: AssignManagerDto,
    actor: CurrentUserType,
  ) {
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw new BadRequestException(
        'Only SUPER_ADMIN can assign branch managers.',
      );
    }
    const userId = await this.resolveUserId(dto.user_id);

    const branch = await this.prisma.working_locations.findFirst({
      where: {
        uuid: workingLocationUuid,
        deleted_at: null,
      },
    });

    if (!branch) {
      throw new NotFoundException('Working location not found.');
    }

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

    const manager = await this.prisma.$transaction(async (tx) => {
      await tx.branch_managers.updateMany({
        where: {
          working_location_id: workingLocationId,
          is_active: true,
        },
        data: {
          is_active: false,
          unassigned_at: new Date(),
        },
      });

      const assigned = await tx.branch_managers.create({
        data: {
          uuid: generateUUID(),
          working_location_id: workingLocationId,
          user_id: userId,
          assigned_by: BigInt(actor.userId),
        },
        include: {
          user: true,
          branch: true,
        },
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

  async assignDepartmentManager(
    departmentUuid: string,
    dto: AssignManagerDto,
    actor: CurrentUserType,
  ) {
    const userId = await this.resolveUserId(dto.user_id);

    const department = await this.prisma.departments.findUnique({
      where: { uuid: departmentUuid },
    });

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    const departmentId = department.id;

    const user = await this.prisma.users.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        working_location_id: department.working_location_id,
        department_id: departmentId,
        deleted_at: null,
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Department manager must be an active user assigned to that department.',
      );
    }

    const manager = await this.prisma.$transaction(async (tx) => {
      await tx.department_managers.updateMany({
        where: {
          department_id: departmentId,
          is_active: true,
        },
        data: {
          is_active: false,
          unassigned_at: new Date(),
        },
      });

      const assigned = await tx.department_managers.create({
        data: {
          uuid: generateUUID(),
          department_id: departmentId,
          user_id: userId,
          assigned_by: BigInt(actor.userId),
        },
        include: {
          user: true,
          department: true,
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'department_managers',
          entity_id: assigned.id,
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: 'Assigned active department manager.',
          action: AUDIT_ACTION.UPDATED,
          new_values: {
            department_id: departmentId.toString(),
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
      select: { id: true },
    });

    if (!workingLocation) {
      throw new NotFoundException('Working location not found.');
    }

    return workingLocation.id;
  }

  private async resolveUserId(value: string) {
    requireUuidOrNumeric(value, 'user_id');

    const user = await this.prisma.users.findFirst({
      where: isNumericId(value)
        ? {
            id: BigInt(value),
            deleted_at: null,
          }
        : {
            uuid: value,
            deleted_at: null,
          },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user.id;
  }

  private ensureActorCanUseWorkingLocation(
    actor: CurrentUserType,
    workingLocationId: bigint,
  ) {
    if (actor.roles.some((role) => ['SUPER_ADMIN', 'ADMIN'].includes(role))) {
      return;
    }

    if (
      actor.roles.some((role) =>
        ['BRANCH_MANAGER', 'MANAGER', 'ON_MANAGER'].includes(role),
      ) &&
      actor.working_location_id === workingLocationId.toString()
    ) {
      return;
    }

    throw new BadRequestException('You can only manage your working location.');
  }

  private serializeDepartment(department: Record<string, any>) {
    return {
      ...department,
      id: department.id.toString(),
      working_location_id: department.working_location_id.toString(),
      working_location: department.working_location
        ? this.serializeWorkingLocation(department.working_location)
        : undefined,
    };
  }

  private serializeManager(manager: Record<string, any>) {
    return {
      ...manager,
      id: manager.id.toString(),
      working_location_id: manager.working_location_id?.toString(),
      department_id: manager.department_id?.toString(),
      user_id: manager.user_id.toString(),
      assigned_by: manager.assigned_by.toString(),
      user: manager.user
        ? {
            ...manager.user,
            id: manager.user.id.toString(),
            working_location_id:
              manager.user.working_location_id?.toString() ?? null,
            department_id: manager.user.department_id?.toString() ?? null,
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
