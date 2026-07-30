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
import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateWorkingLocationDto } from './dto/create-working-location.dto';
import { UpdateWorkingLocationDto } from './dto/update-working-location.dto';
import { OrganizationService } from './organization.service';

@ApiTags('Organization')
@ApiBearerAuth('jwt')
@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Permissions('branches.manage')
  @Post('working-locations')
  @ApiOperation({
    summary: 'Create a working location (branch or HQ)',
    description:
      'Creates a new branch or headquarters. Requires `branches.manage`. Only one HQ can exist at a time. Every existing department name/code is automatically copied into the new location.',
  })
  @ApiResponse({ status: 201, description: 'Working location created.' })
  @ApiResponse({
    status: 400,
    description: 'Duplicate name, or a second HQ was attempted.',
  })
  @ApiResponse({
    status: 403,
    description: 'Missing branches.manage permission.',
  })
  createWorkingLocation(
    @Body() dto: CreateWorkingLocationDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.createWorkingLocation(dto, actor);
  }

  @Public()
  @Get('working-locations')
  @ApiOperation({
    summary: 'List working locations (public)',
    description:
      'Public endpoint (used by the registration form) when called without a token. When called by an authenticated non-privileged user, results are scoped to their own branch unless `scope=transfer` is passed by someone holding a transfer permission, or the caller holds `branches.read_all`/SUPER_ADMIN.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search by name or address.',
  })
  @ApiQuery({
    name: 'scope',
    required: false,
    description:
      'Pass "transfer" to bypass branch scoping when picking a transfer destination (requires employees.transfer or employees.transfer_approve).',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of working locations with user/department/employee counts.',
  })
  findWorkingLocations(
    @CurrentUser() actor?: CurrentUserType,
    @Query('q') q?: string,
    @Query('scope') scope?: string,
  ) {
    return this.organizationService.findWorkingLocations(actor, q, scope);
  }

  @Permissions('branches.manage')
  @Patch('working-locations/:uuid')
  @ApiOperation({
    summary: 'Update a working location',
    description:
      'Renames, re-addresses, or changes the type of a branch/HQ. Requires `branches.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Working location UUID.' })
  @ApiResponse({ status: 200, description: 'Working location updated.' })
  @ApiResponse({ status: 404, description: 'Working location not found.' })
  updateWorkingLocation(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateWorkingLocationDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.updateWorkingLocation(uuid, dto, actor);
  }

  @Permissions('branches.manage')
  @Patch('working-locations/:uuid/delete')
  @ApiOperation({
    summary: 'Soft-delete a working location',
    description:
      'Marks a branch/HQ as deleted (retained for historical/audit purposes). Requires `branches.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Working location UUID.' })
  @ApiResponse({ status: 200, description: 'Working location soft-deleted.' })
  @ApiResponse({ status: 404, description: 'Working location not found.' })
  deleteWorkingLocation(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.deleteWorkingLocation(uuid, actor);
  }

  @Permissions('branch-manager.manage')
  @Patch('working-locations/:uuid/manager')
  @ApiOperation({
    summary: 'Assign the branch manager for a working location',
    description:
      'Sets (or replaces) the active branch manager for a location. The target user must already be ACTIVE and assigned to that working location. Requires `branch-manager.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Working location UUID.' })
  @ApiResponse({ status: 200, description: 'Branch manager assigned.' })
  @ApiResponse({
    status: 400,
    description: 'Target user is not an active member of this branch.',
  })
  assignBranchManager(
    @Param('uuid') uuid: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.assignBranchManager(uuid, dto, actor);
  }
}
