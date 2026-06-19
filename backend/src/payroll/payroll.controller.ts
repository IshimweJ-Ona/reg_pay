import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { ApprovePayrollItemDto } from './dto/approve-payroll-item.dto';
import { CreatePayrollBatchDto } from './dto/create-payroll-batch.dto';
import { RejectPayrollItemDto } from './dto/reject-payroll-item.dto';
import { PayrollService } from './payroll.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'FINANCE')
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Permissions('payroll.create')
  @Post('batches')
  createBatch(
    @Body() dto: CreatePayrollBatchDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.createBatch(dto, actor);
  }

  @Permissions('payroll.create')
  @Post('batches/:uuid/submit')
  submitBatch(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.submitBatch(uuid, actor);
  }

  @Permissions('payroll.read')
  @Get('batches')
  findBatches(@CurrentUser() actor: CurrentUserType, @Query('q') q?: string) {
    return this.payrollService.findBatches(actor, q);
  }

  @Permissions('payroll.read')
  @Get('batches/:uuid')
  findBatch(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.findBatch(uuid, actor);
  }

  @Permissions('payroll.approve')
  @Patch('batches/:uuid/approve')
  approveBatch(
    @Param('uuid') uuid: string,
    @Body() dto: ApprovePayrollItemDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.approveBatch(uuid, dto, actor);
  }

  @Permissions('payroll.approve')
  @Patch('batches/:uuid/reject')
  rejectBatch(
    @Param('uuid') uuid: string,
    @Body() dto: RejectPayrollItemDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.rejectBatch(uuid, dto, actor);
  }

  @Permissions('payroll.approve')
  @Patch('batches/items/:uuid/approve')
  approveItem(
    @Param('uuid') uuid: string,
    @Body() dto: ApprovePayrollItemDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.approveItem(uuid, dto, actor);
  }

  @Permissions('payroll.approve')
  @Patch('batches/items/:uuid/reject')
  rejectItem(
    @Param('uuid') uuid: string,
    @Body() dto: RejectPayrollItemDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.payrollService.rejectItem(uuid, dto, actor);
  }
}
