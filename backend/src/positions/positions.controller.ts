import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { AttachDeductionTypeDto } from './dto/attach-deduction-type.dto';
import { UpsertAllowanceTemplateDto } from './dto/upsert-allowance-template.dto';
import { AttachEmploymentCategoryDto } from './dto/attach-employment-category.dto';
import { PositionsService } from './positions.service';

@ApiTags('Positions')
@ApiBearerAuth('jwt')
@Controller('positions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Permissions('positions.manage')
  @Post()
  @ApiOperation({
    summary: 'Create a position',
    description:
      'Creates a position (e.g. Linesman, Driver, Electrician). Employment-category variants (Monthly/Daily/Custom), each with their own default salary, are attached afterward. Requires `positions.manage`.',
  })
  @ApiResponse({ status: 201, description: 'Position created.' })
  createPosition(
    @Body() dto: CreatePositionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.createPosition(dto, actor);
  }

  @Permissions('positions.read')
  @Get('employment-categories')
  @ApiOperation({
    summary: 'List employment categories',
    description:
      'Returns the ACTIVE employment categories (Monthly / Daily / Custom) a position can be linked to. Requires `positions.read`.',
  })
  findEmploymentCategories() {
    return this.positionsService.findEmploymentCategories();
  }

  @Permissions('positions.read')
  @Get()
  @ApiOperation({
    summary: 'List positions',
    description:
      'Lists positions, ACTIVE only by default. Requires `positions.read`.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'ACTIVE (default) or INACTIVE.',
  })
  @ApiResponse({ status: 200, description: 'List of positions.' })
  findPositions(@Query('status') status?: string) {
    return this.positionsService.findPositions(status);
  }

  @Permissions('positions.read')
  @Get(':uuid')
  @ApiOperation({ summary: 'Get a position by uuid' })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiResponse({ status: 200, description: 'Position detail.' })
  @ApiResponse({ status: 404, description: 'Position not found.' })
  findPosition(@Param('uuid') uuid: string) {
    return this.positionsService.findPositionByUuid(uuid);
  }

  @Permissions('positions.manage')
  @Patch(':uuid')
  @ApiOperation({ summary: 'Update a position' })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiResponse({ status: 200, description: 'Position updated.' })
  updatePosition(
    @Param('uuid') uuid: string,
    @Body() dto: UpdatePositionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.updatePosition(uuid, dto, actor);
  }

  @Permissions('positions.manage')
  @Patch(':uuid/archive')
  @ApiOperation({
    summary: 'Archive a position',
    description:
      'Marks the position INACTIVE so it stops appearing for new assignments. Employees already assigned keep it.',
  })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiResponse({ status: 200, description: 'Position archived.' })
  archivePosition(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.archivePosition(uuid, actor);
  }

  @Permissions('positions.manage')
  @Patch(':uuid/reactivate')
  @ApiOperation({
    summary: 'Reactivate an archived position',
    description:
      'Marks an INACTIVE position ACTIVE again so it reappears for new assignments. Requires `positions.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiResponse({ status: 200, description: 'Position reactivated.' })
  reactivatePosition(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.reactivatePosition(uuid, actor);
  }

  @Permissions('positions.manage')
  @Post(':uuid/employment-categories')
  @ApiOperation({
    summary: 'Attach an employment-category variant to a position',
    description:
      'A position can have several employment-category variants (Monthly/Daily/Custom), each with its own default salary. Assigning an employee to this position requires picking one of these variants. Requires `positions.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  attachEmploymentCategory(
    @Param('uuid') uuid: string,
    @Body() dto: AttachEmploymentCategoryDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.attachEmploymentCategory(uuid, dto, actor);
  }

  @Permissions('positions.manage')
  @Patch(':uuid/employment-categories/:variantUuid')
  @ApiOperation({ summary: 'Update an employment-category variant\'s default salary' })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiParam({ name: 'variantUuid', description: 'Position-employment-category variant UUID.' })
  updateEmploymentCategory(
    @Param('uuid') uuid: string,
    @Param('variantUuid') variantUuid: string,
    @Body() dto: AttachEmploymentCategoryDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.updateEmploymentCategory(uuid, variantUuid, dto, actor);
  }

  @Permissions('positions.manage')
  @Delete(':uuid/employment-categories/:variantUuid')
  @ApiOperation({
    summary: 'Detach an employment-category variant from a position',
    description: 'Fails if any employee is currently assigned to this exact position + employment category.',
  })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiParam({ name: 'variantUuid', description: 'Position-employment-category variant UUID.' })
  detachEmploymentCategory(
    @Param('uuid') uuid: string,
    @Param('variantUuid') variantUuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.detachEmploymentCategory(uuid, variantUuid, actor);
  }

  @Permissions('positions.manage')
  @Post(':uuid/deduction-types')
  @ApiOperation({ summary: 'Attach a default deduction type to a position' })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  attachDeductionType(
    @Param('uuid') uuid: string,
    @Body() dto: AttachDeductionTypeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.attachDeductionType(uuid, dto, actor);
  }

  @Permissions('positions.manage')
  @Delete(':uuid/deduction-types/:deductionTypeId')
  @ApiOperation({ summary: 'Detach a default deduction type from a position' })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiParam({ name: 'deductionTypeId', description: 'Deduction type id or uuid.' })
  detachDeductionType(
    @Param('uuid') uuid: string,
    @Param('deductionTypeId') deductionTypeId: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.detachDeductionType(
      uuid,
      deductionTypeId,
      actor,
    );
  }

  @Permissions('positions.manage')
  @Post(':uuid/allowance-templates')
  @ApiOperation({ summary: 'Add a default allowance template to a position' })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  addAllowanceTemplate(
    @Param('uuid') uuid: string,
    @Body() dto: UpsertAllowanceTemplateDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.addAllowanceTemplate(uuid, dto, actor);
  }

  @Permissions('positions.manage')
  @Patch(':uuid/allowance-templates/:templateUuid')
  @ApiOperation({ summary: 'Update a position allowance template' })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiParam({ name: 'templateUuid', description: 'Allowance template UUID.' })
  updateAllowanceTemplate(
    @Param('uuid') uuid: string,
    @Param('templateUuid') templateUuid: string,
    @Body() dto: UpsertAllowanceTemplateDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.updateAllowanceTemplate(
      uuid,
      templateUuid,
      dto,
      actor,
    );
  }

  @Permissions('positions.manage')
  @Delete(':uuid/allowance-templates/:templateUuid')
  @ApiOperation({ summary: 'Remove a position allowance template' })
  @ApiParam({ name: 'uuid', description: 'Position UUID.' })
  @ApiParam({ name: 'templateUuid', description: 'Allowance template UUID.' })
  removeAllowanceTemplate(
    @Param('uuid') uuid: string,
    @Param('templateUuid') templateUuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.positionsService.removeAllowanceTemplate(
      uuid,
      templateUuid,
      actor,
    );
  }
}
