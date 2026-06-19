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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateWorkingLocationDto } from './dto/create-working-location.dto';
import { OrganizationService } from './organization.service';

@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Roles('SUPER_ADMIN')
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
  ) {
    return this.organizationService.findWorkingLocations(actor, q);
  }

  @Roles('SUPER_ADMIN')
  @Permissions('branches.manage')
  @Patch('working-locations/:uuid')
  updateWorkingLocation(
    @Param('uuid') uuid: string,
    @Body() dto: CreateWorkingLocationDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.updateWorkingLocation(uuid, dto, actor);
  }

  @Roles('SUPER_ADMIN')
  @Permissions('branches.manage')
  @Patch('working-locations/:uuid/delete')
  deleteWorkingLocation(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.deleteWorkingLocation(uuid, actor);
  }

  @Roles('SUPER_ADMIN')
  @Permissions('departments.manage')
  @Post('departments')
  createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.createDepartment(dto, actor);
  }

  @Public()
  @Get('departments')
  findDepartments(
    @CurrentUser() actor?: CurrentUserType,
    @Query('working_location_id') workingLocationId?: string,
    @Query('q') q?: string,
  ) {
    return this.organizationService.findDepartments(
      actor,
      workingLocationId,
      q,
    );
  }

  @Roles('SUPER_ADMIN')
  @Permissions('departments.manage')
  @Patch('departments/:uuid')
  updateDepartment(
    @Param('uuid') uuid: string,
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.updateDepartment(uuid, dto, actor);
  }

  @Roles('SUPER_ADMIN')
  @Permissions('departments.manage')
  @Patch('departments/:uuid/delete')
  deleteDepartment(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.deleteDepartment(uuid, actor);
  }

  @Roles('SUPER_ADMIN')
  @Permissions('branches.manage')
  @Patch('working-locations/:uuid/manager')
  assignBranchManager(
    @Param('uuid') uuid: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.assignBranchManager(uuid, dto, actor);
  }

  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  @Permissions('departments.manage')
  @Patch('departments/:uuid/manager')
  assignDepartmentManager(
    @Param('uuid') uuid: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.assignDepartmentManager(uuid, dto, actor);
  }
}
