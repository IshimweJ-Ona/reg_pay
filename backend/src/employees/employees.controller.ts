import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import { AssignUserAccountDto } from './dto/assign-user-account.dto';
import { ApproveEmployeeDto } from './dto/approve-employee.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { SuspendEmployeeDto } from './dto/suspend-employee.dto';
import { TransferEmployeeDto } from './dto/transfer-employee.dto';
import { EmployeesService } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post('register')
  register(@Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER')
  @Permissions('employees.create')
  @Post()
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.create(dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER')
  @Permissions('employees.read')
  @Get()
  findAll() {
    return this.employeesService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER')
  @Permissions('employees.read')
  @Get(':uuid')
  findOne(@Param('uuid') uuid: string) {
    return this.employeesService.findOne(uuid);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER')
  @Permissions('employees.approve')
  @Patch(':uuid/approve')
  approve(
    @Param('uuid') uuid: string,
    @Body() dto: ApproveEmployeeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.approve(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER')
  @Permissions('employees.update')
  @Patch(':uuid/link-user')
  assignUserAccount(
    @Param('uuid') uuid: string,
    @Body() dto: AssignUserAccountDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.assignUserAccount(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER')
  @Permissions('employees.transfer')
  @Patch(':uuid/transfer')
  transfer(
    @Param('uuid') uuid: string,
    @Body() dto: TransferEmployeeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.transfer(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HQ_MANAGER')
  @Permissions('employees.transfer')
  @Patch('transfer-requests/:uuid/approve')
  approveTransfer(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.approveTransfer(uuid, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HQ_MANAGER')
  @Permissions('employees.transfer')
  @Patch('transfer-requests/:uuid/reject')
  rejectTransfer(
    @Param('uuid') uuid: string,
    @Body() dto: RejectTransferDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.rejectTransfer(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER')
  @Permissions('employees.suspend')
  @Patch(':uuid/suspend')
  suspend(
    @Param('uuid') uuid: string,
    @Body() dto: SuspendEmployeeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.suspend(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'BRANCH_MANAGER')
  @Permissions('employees.update')
  @Patch(':uuid/reactivate')
  reactivate(@Param('uuid') uuid: string, @CurrentUser() actor: CurrentUserType) {
    return this.employeesService.reactivate(uuid, actor);
  }
}
