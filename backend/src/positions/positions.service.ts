import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  audit_logs_activity_type as ACTIVITY_TYPE,
  audit_logs_action as AUDIT_ACTION,
} from '@prisma/client';

import type { CurrentUserType } from '../auth/types/current-user.type';
import { isNumericId, normalizeEntityName } from '../common/utils/lookup.util';
import { generateUUID } from '../common/utils/uuid.util';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { AttachDeductionTypeDto } from './dto/attach-deduction-type.dto';
import { UpsertAllowanceTemplateDto } from './dto/upsert-allowance-template.dto';
import { AttachEmploymentCategoryDto } from './dto/attach-employment-category.dto';
import { serializePosition } from './position.model';

const POSITION_INCLUDES = {
  position_employment_categories: { include: { employment_categories: true } },
  position_deduction_types: { include: { deduction_types: true } },
  position_allowance_templates: true,
} as const;

@Injectable()
export class PositionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // A position is just a name/description shell now - its employment-category
  // variants (Monthly/Daily/Custom, each with their own default salary) are
  // attached afterward via attachEmploymentCategory(), mirroring how
  // deduction types and allowance templates already work.
  async createPosition(dto: CreatePositionDto, actor: CurrentUserType) {
    const existing = await this.prisma.positions.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `A position named '${dto.name}' already exists.`,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const position = await tx.positions.create({
        data: {
          uuid: generateUUID(),
          name: dto.name,
          description: dto.description,
          updated_at: new Date(),
        },
        include: POSITION_INCLUDES,
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'positions',
          entity_id: position.id,
          module_name: 'POSITIONS',
          activity_type: ACTIVITY_TYPE.CREATE,
          activity_description: `Created position '${position.name}'.`,
          action: AUDIT_ACTION.CREATED,
          new_values: { name: dto.name },
        },
      });

      return position;
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return serializePosition(created);
  }

  async findEmploymentCategories() {
    const categories = await this.prisma.employment_categories.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    return {
      employment_categories: categories.map((c) => ({
        ...c,
        id: c.id.toString(),
      })),
    };
  }

  async findPositions(status?: string) {
    const positions = await this.prisma.positions.findMany({
      where: status ? { status: status as any } : { status: 'ACTIVE' },
      include: POSITION_INCLUDES,
      orderBy: { name: 'asc' },
    });

    return { positions: positions.map((p) => serializePosition(p)) };
  }

  async findPositionByUuid(uuid: string) {
    const position = await this.findByUuidOrThrow(uuid);
    return serializePosition(position);
  }

  async updatePosition(
    uuid: string,
    dto: UpdatePositionDto,
    actor: CurrentUserType,
  ) {
    const current = await this.findByUuidOrThrow(uuid);

    if (dto.name && normalizeEntityName(dto.name) !== normalizeEntityName(current.name)) {
      const duplicate = await this.prisma.positions.findUnique({
        where: { name: dto.name },
      });
      if (duplicate) {
        throw new BadRequestException(
          `A position named '${dto.name}' already exists.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const position = await tx.positions.update({
        where: { id: current.id },
        data: {
          name: dto.name,
          description: dto.description,
          updated_at: new Date(),
        },
        include: POSITION_INCLUDES,
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'positions',
          entity_id: position.id,
          module_name: 'POSITIONS',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: `Updated position '${position.name}'.`,
          action: AUDIT_ACTION.UPDATED,
          new_values: dto as any,
        },
      });

      return position;
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return serializePosition(updated);
  }

  async archivePosition(uuid: string, actor: CurrentUserType) {
    const current = await this.findByUuidOrThrow(uuid);

    if (current.status === 'INACTIVE') {
      return serializePosition(current);
    }

    const archived = await this.prisma.$transaction(async (tx) => {
      const position = await tx.positions.update({
        where: { id: current.id },
        data: { status: 'INACTIVE', updated_at: new Date() },
        include: POSITION_INCLUDES,
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'positions',
          entity_id: position.id,
          module_name: 'POSITIONS',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: `Archived position '${position.name}'. Employees already assigned keep this position; it just no longer appears for new assignments.`,
          action: AUDIT_ACTION.UPDATED,
          old_values: { status: current.status },
          new_values: { status: 'INACTIVE' },
        },
      });

      return position;
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return serializePosition(archived);
  }

  async reactivatePosition(uuid: string, actor: CurrentUserType) {
    const current = await this.findByUuidOrThrow(uuid);

    if (current.status === 'ACTIVE') {
      return serializePosition(current);
    }

    const reactivated = await this.prisma.$transaction(async (tx) => {
      const position = await tx.positions.update({
        where: { id: current.id },
        data: { status: 'ACTIVE', updated_at: new Date() },
        include: POSITION_INCLUDES,
      });

      await tx.audit_logs.create({
        data: {
          user_id: BigInt(actor.userId),
          entity_table: 'positions',
          entity_id: position.id,
          module_name: 'POSITIONS',
          activity_type: ACTIVITY_TYPE.UPDATE,
          activity_description: `Reactivated position '${position.name}'.`,
          action: AUDIT_ACTION.UPDATED,
          old_values: { status: current.status },
          new_values: { status: 'ACTIVE' },
        },
      });

      return position;
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return serializePosition(reactivated);
  }

  // ── Employment-category variants (Monthly/Daily/Custom), each with its
  // own default salary - a position can carry several at once. ──────────

  async attachEmploymentCategory(
    uuid: string,
    dto: AttachEmploymentCategoryDto,
    actor: CurrentUserType,
  ) {
    const position = await this.findByUuidOrThrow(uuid);
    const employmentCategoryId = await this.resolveEmploymentCategoryId(
      dto.employment_category_id,
    );

    const existing = await this.prisma.position_employment_categories.findUnique({
      where: {
        position_id_employment_category_id: {
          position_id: position.id,
          employment_category_id: employmentCategoryId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'This employment category is already attached to this position. Edit it instead of attaching it again.',
      );
    }

    await this.prisma.position_employment_categories.create({
      data: {
        uuid: generateUUID(),
        position_id: position.id,
        employment_category_id: employmentCategoryId,
        default_basic_salary: dto.default_basic_salary,
        default_daily_rate: dto.default_daily_rate,
        default_overtime_rate: dto.default_overtime_rate,
        default_custom_work_days: dto.default_custom_work_days,
        updated_at: new Date(),
      },
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return this.findPositionByUuid(uuid);
  }

  async updateEmploymentCategory(
    uuid: string,
    variantUuid: string,
    dto: AttachEmploymentCategoryDto,
    actor: CurrentUserType,
  ) {
    const position = await this.findByUuidOrThrow(uuid);
    const variant = await this.prisma.position_employment_categories.findFirst({
      where: { uuid: variantUuid, position_id: position.id },
    });
    if (!variant) {
      throw new NotFoundException('Employment category variant not found on this position.');
    }

    await this.prisma.position_employment_categories.update({
      where: { id: variant.id },
      data: {
        default_basic_salary: dto.default_basic_salary,
        default_daily_rate: dto.default_daily_rate,
        default_overtime_rate: dto.default_overtime_rate,
        default_custom_work_days: dto.default_custom_work_days,
        updated_at: new Date(),
      },
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return this.findPositionByUuid(uuid);
  }

  async detachEmploymentCategory(
    uuid: string,
    variantUuid: string,
    actor: CurrentUserType,
  ) {
    const position = await this.findByUuidOrThrow(uuid);

    const inUseCount = await this.prisma.employees.count({
      where: {
        position_id: position.id,
        employment_category_id: {
          in: (
            await this.prisma.position_employment_categories.findMany({
              where: { uuid: variantUuid, position_id: position.id },
              select: { employment_category_id: true },
            })
          ).map((v) => v.employment_category_id),
        },
        deleted_at: null,
      },
    });
    if (inUseCount > 0) {
      throw new BadRequestException(
        `${inUseCount} employee(s) are currently assigned to this position with this employment category. Transfer them to a different category first.`,
      );
    }

    await this.prisma.position_employment_categories.deleteMany({
      where: { uuid: variantUuid, position_id: position.id },
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return this.findPositionByUuid(uuid);
  }

  async attachDeductionType(
    uuid: string,
    dto: AttachDeductionTypeDto,
    actor: CurrentUserType,
  ) {
    const position = await this.findByUuidOrThrow(uuid);
    const deductionTypeId = await this.resolveDeductionTypeId(
      dto.deduction_type_id,
    );

    const existing = await this.prisma.position_deduction_types.findUnique({
      where: {
        position_id_deduction_type_id: {
          position_id: position.id,
          deduction_type_id: deductionTypeId,
        },
      },
    });

    if (!existing) {
      await this.prisma.position_deduction_types.create({
        data: {
          uuid: generateUUID(),
          position_id: position.id,
          deduction_type_id: deductionTypeId,
        },
      });
    }

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return this.findPositionByUuid(uuid);
  }

  async detachDeductionType(
    uuid: string,
    deductionTypeIdInput: string,
    actor: CurrentUserType,
  ) {
    const position = await this.findByUuidOrThrow(uuid);
    const deductionTypeId = await this.resolveDeductionTypeId(
      deductionTypeIdInput,
    );

    await this.prisma.position_deduction_types.deleteMany({
      where: { position_id: position.id, deduction_type_id: deductionTypeId },
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return this.findPositionByUuid(uuid);
  }

  async addAllowanceTemplate(
    uuid: string,
    dto: UpsertAllowanceTemplateDto,
    actor: CurrentUserType,
  ) {
    const position = await this.findByUuidOrThrow(uuid);

    await this.prisma.position_allowance_templates.create({
      data: {
        uuid: generateUUID(),
        position_id: position.id,
        allowance_type_id:
          dto.allowance_type_id && isNumericId(dto.allowance_type_id)
            ? BigInt(dto.allowance_type_id)
            : undefined,
        title: dto.title,
        default_amount: dto.default_amount,
        description: dto.description,
        updated_at: new Date(),
      },
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return this.findPositionByUuid(uuid);
  }

  async updateAllowanceTemplate(
    uuid: string,
    templateUuid: string,
    dto: UpsertAllowanceTemplateDto,
    actor: CurrentUserType,
  ) {
    const position = await this.findByUuidOrThrow(uuid);
    const template = await this.prisma.position_allowance_templates.findFirst(
      { where: { uuid: templateUuid, position_id: position.id } },
    );
    if (!template) {
      throw new NotFoundException('Allowance template not found.');
    }

    await this.prisma.position_allowance_templates.update({
      where: { id: template.id },
      data: {
        allowance_type_id:
          dto.allowance_type_id && isNumericId(dto.allowance_type_id)
            ? BigInt(dto.allowance_type_id)
            : undefined,
        title: dto.title,
        default_amount: dto.default_amount,
        description: dto.description,
        updated_at: new Date(),
      },
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return this.findPositionByUuid(uuid);
  }

  async removeAllowanceTemplate(
    uuid: string,
    templateUuid: string,
    actor: CurrentUserType,
  ) {
    const position = await this.findByUuidOrThrow(uuid);
    await this.prisma.position_allowance_templates.deleteMany({
      where: { uuid: templateUuid, position_id: position.id },
    });

    this.notificationsService.broadcast({ type: 'positions_updated' });
    return this.findPositionByUuid(uuid);
  }

  private async findByUuidOrThrow(uuid: string) {
    const position = await this.prisma.positions.findUnique({
      where: { uuid },
      include: POSITION_INCLUDES,
    });
    if (!position) {
      throw new NotFoundException('Position not found.');
    }
    return position;
  }

  private async resolveEmploymentCategoryId(value: string) {
    const category = await this.prisma.employment_categories.findFirst({
      where: isNumericId(value) ? { id: BigInt(value) } : { uuid: value },
      select: { id: true, status: true },
    });
    if (!category) {
      throw new BadRequestException('Employment category not found.');
    }
    if (category.status !== 'ACTIVE') {
      throw new BadRequestException('Employment category is inactive.');
    }
    return category.id;
  }

  private async resolveDeductionTypeId(value: string) {
    const deductionType = await this.prisma.deduction_types.findFirst({
      where: isNumericId(value) ? { id: BigInt(value) } : { uuid: value },
      select: { id: true },
    });
    if (!deductionType) {
      throw new BadRequestException('Deduction type not found.');
    }
    return deductionType.id;
  }
}
