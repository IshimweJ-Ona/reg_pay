import { Body, Controller, Get, Post, Param, Patch, Query, UseGuards } from '@nestjs/common';
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

@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Permissions('branches.manage')
  @Post('working-locations')
  createWorkingLocation(
    @Body() dto: CreateWorkingLocationDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.createWorkingLocation(dto, actor);
  }

  @Public()
  @Get('working-locations')
  findWorkingLocations(
    @CurrentUser() actor?: CurrentUserType,
    @Query('q') q?: string,
    @Query('scope') scope?: string,
  ) {
    return this.organizationService.findWorkingLocations(actor, q, scope);
  }

  @Permissions('branches.manage')
  @Patch('working-locations/:uuid')
  updateWorkingLocation(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateWorkingLocationDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.updateWorkingLocation(uuid, dto, actor);
  }

  @Permissions('branches.manage')
  @Patch('working-locations/:uuid/delete')
  deleteWorkingLocation(@Param('uuid') uuid: string, @CurrentUser() actor: CurrentUserType) {
    return this.organizationService.deleteWorkingLocation(uuid, actor);
  }

  @Permissions('branch-manager.manage')
  @Patch('working-locations/:uuid/manager')
  assignBranchManager(
    @Param('uuid') uuid: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.assignBranchManager(uuid, dto, actor);
  }
}