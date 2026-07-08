import { Body, Controller, Get, Post, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './department.service';

// Kept under 'organization/departments' to preserve the existing API contract.
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
    createDepartment(@Body() dto: CreateDepartmentDto, @CurrentUser() actor: CurrentUserType) {
        return this.departmentsService.createDepartment(dto, actor);
    }

    @Public()
    @Get()
    findDepartments(
        @CurrentUser() actor?: CurrentUserType,
        @Query('working_location_id') workingLocationId?: string,
        @Query('q') q?: string,
    ) {
        return this.departmentsService.findDepartments(actor, workingLocationId, q);
    }
    
    @Permissions('departments.manage')
    @Patch(':uuid')
    updateDepartment(
        @Param('uuid') uuid: string,
        @Body() dto: UpdateDepartmentDto,
        @CurrentUser() actor: CurrentUserType,
    ) {
        return this.departmentsService.updateDepartment(uuid, dto, actor);
    }
    
    @Permissions('departments.manage')
    @Patch(':uuid/delete')
    deleteDepartment(@Param('uuid') uuid: string, @CurrentUser() actor: CurrentUserType) {
        return this.departmentsService.deleteDepartment(uuid, actor);
    }
}