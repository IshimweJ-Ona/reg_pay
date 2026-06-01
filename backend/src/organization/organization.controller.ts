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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateWorkingLocationDto } from './dto/create-working-location.dto';
import { OrganizationService } from './organization.service';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @Permissions('branches.manage')
  @Post('working-locations')
  createWorkingLocation(
    @Body() dto: CreateWorkingLocationDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.createWorkingLocation(dto, actor);
  }

  @Get('working-locations')
  findWorkingLocations(@Query('q') q?: string) {
    return this.organizationService.findWorkingLocations(q);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
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

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @Permissions('departments.manage')
  @Post('departments')
  createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.createDepartment(dto, actor);
  }

  @Get('departments')
  findDepartments(
    @Query('working_location_id') workingLocationId?: string,
    @Query('q') q?: string,
  ) {
    return this.organizationService.findDepartments(workingLocationId, q);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
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

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
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

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
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
