import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Patch,
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
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { EnableDepartmentAtLocationDto } from './dto/enable-department-at-location.dto';
import { DepartmentsService } from './department.service';

// Kept under 'organization/departments' to preserve the existing API contract.
@ApiTags('Departments')
@ApiBearerAuth('jwt')
@Controller('organization/departments')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  // No @Roles() here on purpose — @Permissions + PermissionsGuard is the
  // single source of truth, so any role holding 'departments.manage'
  // (or something that implies it, e.g. 'branches.manage') can call this,
  // and SUPER_ADMIN bypasses inside PermissionsGuard itself.

  @Permissions('departments.manage')
  @Post()
  @ApiOperation({
    summary: 'Create a department',
    description:
      'Creates a department. A SUPER_ADMIN/branches.manage caller creates it in every current working location at once (one row per location, sharing the same code/name); a branch-scoped caller creates it only in their own branch. Requires `departments.manage`.',
  })
  @ApiResponse({ status: 201, description: 'Department(s) created.' })
  @ApiResponse({
    status: 400,
    description: 'Duplicate department name for the target location(s).',
  })
  createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.departmentsService.createDepartment(dto, actor);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List departments (public)',
    description:
      'Public when called without a token. An authenticated non-privileged caller is restricted to their own working location unless they hold `branches.read_all`/SUPER_ADMIN. Each row includes a `_count`/`user_count`/`employee_count` and the parent working location.',
  })
  @ApiQuery({
    name: 'working_location_id',
    required: false,
    description: 'Filter to one working location (id or uuid).',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search by name, code, or description.',
  })
  @ApiQuery({
    name: 'for_assignment',
    required: false,
    description:
      'When true, only returns departments that can accept new assignments right now: ACTIVE and with no pending deactivation request. Use this for employee/user create, transfer, and batch-creation dropdowns.',
  })
  @ApiResponse({ status: 200, description: 'List of departments.' })
  findDepartments(
    @CurrentUser() actor?: CurrentUserType,
    @Query('working_location_id') workingLocationId?: string,
    @Query('q') q?: string,
    @Query('for_assignment') forAssignment?: string,
  ) {
    return this.departmentsService.findDepartments(
      actor,
      workingLocationId,
      q,
      forAssignment === 'true',
    );
  }

  @Permissions('departments.manage')
  @Patch(':uuid')
  @ApiOperation({
    summary: 'Update a department',
    description:
      'Renames/recodes a department. A SUPER_ADMIN/branches.manage caller updates every location sharing that department code at once; a branch-scoped caller can only update their own branch copy. Requires `departments.manage`.',
  })
  @ApiParam({
    name: 'uuid',
    description:
      'Department UUID (identifies one specific working-location instance).',
  })
  @ApiResponse({ status: 200, description: 'Department updated.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  updateDepartment(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.departmentsService.updateDepartment(uuid, dto, actor);
  }

  @Permissions('departments.manage')
  @Patch(':uuid/delete')
  @ApiOperation({
    summary: 'Soft-delete (archive) a department',
    description:
      'Marks the department INACTIVE. Existing employees must be transferred out first. Requires `departments.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Department UUID.' })
  @ApiResponse({ status: 200, description: 'Department archived.' })
  @ApiResponse({ status: 404, description: 'Department not found.' })
  deleteDepartment(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.departmentsService.deleteDepartment(uuid, actor);
  }

  @Permissions('departments.manage')
  @Patch(':uuid/suspend-and-archive')
  @ApiOperation({
    summary:
      'Resolve a pending deactivation by suspending everyone still assigned',
    description:
      'Alternate to transferring employees/users out one by one: suspends every ACTIVE employee and user still in this department, revokes their sessions, and archives the department immediately. Only usable while a deactivation request is pending. Requires `departments.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Department UUID.' })
  @ApiResponse({ status: 200, description: 'Department archived; staff suspended.' })
  @ApiResponse({
    status: 400,
    description: 'No pending deactivation request for this department.',
  })
  suspendAndArchive(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.departmentsService.suspendAndArchive(uuid, actor);
  }

  @Permissions('departments.manage')
  @Patch(':code/locations/:workingLocationId/enable')
  @ApiOperation({
    summary: 'Assign/reactivate a department at one specific working location',
    description:
      'Toggles a department "on" for exactly one working location - the counterpart to the /delete endpoint\'s per-location "off" toggle. Reactivates an archived row for that (code, location) pair if one exists, otherwise creates a fresh one. Super Admin / branches.read_all only.',
  })
  @ApiParam({ name: 'code', description: 'Department code shared across its location rows.' })
  @ApiParam({ name: 'workingLocationId', description: 'Target working location id or uuid.' })
  @ApiResponse({ status: 200, description: 'Department active at this location.' })
  @ApiResponse({ status: 403, description: 'Caller lacks cross-location assignment rights.' })
  enableAtLocation(
    @Param('code') code: string,
    @Param('workingLocationId') workingLocationId: string,
    @Body() dto: EnableDepartmentAtLocationDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.departmentsService.enableAtLocation(
      code,
      workingLocationId,
      dto,
      actor,
    );
  }
}
