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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { AssignManagerDto } from './dto/assign-manager.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { CreateWorkingLocationDto } from './dto/create-working-location.dto';
import { OrganizationService } from './organization.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('working-locations')
  createWorkingLocation(
    @Body() dto: CreateWorkingLocationDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.createWorkingLocation(dto, actor);
  }

  @Get('working-locations')
  findWorkingLocations() {
    return this.organizationService.findWorkingLocations();
  }

  @Post('departments')
  createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.createDepartment(dto, actor);
  }

  @Get('departments')
  findDepartments(@Query('working_location_id') workingLocationId?: string) {
    return this.organizationService.findDepartments(workingLocationId);
  }

  @Patch('working-locations/:id/manager')
  assignBranchManager(
    @Param('id') id: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.assignBranchManager(id, dto, actor);
  }

  @Patch('departments/:id/manager')
  assignDepartmentManager(
    @Param('id') id: string,
    @Body() dto: AssignManagerDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.organizationService.assignDepartmentManager(id, dto, actor);
  }
}
