import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('RBAC')
@ApiBearerAuth('jwt')
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Listing roles is needed not just by whoever manages roles, but by
  // anyone who needs to ASSIGN an existing role to a user (approving a new
  // account, editing a user's roles) — that's users.update/users.approve
  // territory, not roles.manage. Without this, e.g. a BRANCH_MANAGER who
  // can approve users and assign roles per their own permission set would
  // never be able to fetch the role list to choose from.
  @Permissions(
    'roles.manage',
    'roles.manage_own_location',
    'users.update',
    'users.approve',
  )
  @Get()
  @ApiOperation({
    summary: 'List roles',
    description:
      'Returns global roles plus, for a branch-scoped role manager, roles scoped to their own branch. Cached for 10 minutes. Requires roles.manage, roles.manage_own_location, users.update, or users.approve.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of roles with their permission_keys.',
  })
  findAll(@CurrentUser() actor: CurrentUserType) {
    return this.rolesService.findAll(actor);
  }

  @Permissions('roles.manage', 'roles.manage_own_location')
  @Post()
  @ApiOperation({
    summary: 'Create a role',
    description:
      'Creates a new role with a set of permission_keys. A caller with only roles.manage_own_location gets a branch-scoped role tied to their own working location; roles.manage creates a global role (or one scoped to any location passed in).',
  })
  @ApiResponse({ status: 201, description: 'Role created.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid permission key, or actor has no branch assigned.',
  })
  @ApiResponse({
    status: 409,
    description: 'A role with that name already exists at this scope.',
  })
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: CurrentUserType) {
    return this.rolesService.create(dto, actor);
  }

  @Permissions('roles.manage', 'roles.manage_own_location')
  @Patch(':id')
  @ApiOperation({
    summary: "Update a role's name, description, or permissions",
    description:
      'System role names cannot be renamed. When permission_keys changes, every user currently holding this role is notified (`permissions_updated`) so their access refreshes on their very next request — see JwtStrategy.',
  })
  @ApiParam({ name: 'id', description: 'Role id.' })
  @ApiResponse({ status: 200, description: 'Role updated.' })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.rolesService.update(id, dto, actor);
  }
}
