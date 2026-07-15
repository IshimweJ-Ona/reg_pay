import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

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
  @Permissions('roles.manage', 'roles.manage_own_location', 'users.update', 'users.approve')
  @Get()
  findAll(@CurrentUser() actor: CurrentUserType) {
    return this.rolesService.findAll(actor);
  }

  @Permissions('roles.manage', 'roles.manage_own_location')
  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: CurrentUserType) {
    return this.rolesService.create(dto, actor);
  }

  @Permissions('roles.manage', 'roles.manage_own_location')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.rolesService.update(id, dto, actor);
  }
}
