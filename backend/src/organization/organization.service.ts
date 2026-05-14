import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ACTIVITY_TYPE,
  AUDIT_ACTION,
  WORKING_LOCATION_TYPE,
} from '@prisma/client';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateWorkingLocationDto } from './dto/create-working-location.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkingLocation(
    dto: CreateWorkingLocationDto,
    actor: CurrentUserType,
  ) {
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

    return this.serializeWorkingLocation(workingLocation);
  }

  async findWorkingLocations() {
    const workingLocations = await this.prisma.working_locations.findMany({
      where: { deleted_at: null },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return workingLocations.map((workingLocation) =>
      this.serializeWorkingLocation(workingLocation),
    );
  }

  async createDepartment(dto: CreateDepartmentDto, actor: CurrentUserType) {
    const workingLocationId = this.toBigInt(
      dto.working_location_id,
      'working_location_id',
    );

    const workingLocation = await this.prisma.working_locations.findFirst({
      where: {
        id: workingLocationId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!workingLocation) {
      throw new NotFoundException('Working location not found.');
    }

    const department = await this.prisma.$transaction(async (tx) => {
      const created = await tx.departments.create({
        data: {
          uuid: generateUUID(),
          working_location_id: workingLocationId,
          code: dto.code,
          name: dto.name,
          description: dto.description,
        },
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'departments',
          entity_id: created.id,
          module_name: 'ORGANIZATION',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: 'Created department.',
          action: AUDIT_ACTION.CREATED,
          new_values: {
            working_location_id: workingLocationId.toString(),
            code: created.code,
            name: created.name,
          },
        },
      });

      return created;
    });

    return this.serializeDepartment(department);
  }

  async findDepartments(workingLocationIdInput?: string) {
    const workingLocationId = workingLocationIdInput
      ? this.toBigInt(workingLocationIdInput, 'working_location_id')
      : undefined;

    const departments = await this.prisma.departments.findMany({
      where: {
        working_location_id: workingLocationId,
      },
      orderBy: { name: 'asc' },
    });

    return departments.map((department) => this.serializeDepartment(department));
  }

  async assignBranchManager(
    workingLocationUuid: string,
    dto: AssignManagerDto,
    actor: CurrentUserType,
  ) {
    const userId = this.toBigInt(dto.user_id, 'user_id');

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
    const userId = this.toBigInt(dto.user_id, 'user_id');

    const department = await this.prisma.departments.findUnique({
      where: { uuid: departmentUuid },
    });

    if (!department) throw new NotFoundException('Department not found.');
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
        where: { department_id: departmentId, is_active: true },
        data: { is_active: false, unassigned_at: new Date() },
      });

      const assigned = await tx.department_managers.create({
        data: {
          uuid: generateUUID(),
          department_id: departmentId,
          user_id: userId,
          assigned_by: BigInt(actor.userId),
        },
        include: { user: true, department: true },
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

  private serializeDepartment(department: Record<string, any>) {
    return {
      ...department,
      id: department.id.toString(),
      working_location_id: department.working_location_id.toString(),
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
            working_location_id: manager.user.working_location_id?.toString() ?? null,
            department_id: manager.user.department_id?.toString() ?? null,
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
}
