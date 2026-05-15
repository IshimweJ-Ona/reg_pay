import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreatePaymentStructureDto } from './dto/create-payment-structure.dto';
import { UpdatePaymentStructureDto } from './dto/update-payment-structure.dto';
import { PaymentStructuresService } from './payment-structures.service';
import { CreateDeductionTypeDto } from './dto/create-deduction-type.dto';
import { UpdateDeductionTypeDto } from './dto/update-deduction-type.dto';
import { CreateEmployeeDeductionDto } from './dto/create-employee-deduction.dto';
import { UpdateEmployeeDeductionDto } from './dto/update-employee-deduction.dto';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'FINANCE')
@Controller('payment-structures')
export class PaymentStructuresController {
  constructor(private readonly paymentStructuresService: PaymentStructuresService) {}

  @Permissions('payment-structures.create')
  @Post()
  create(
    @Body() dto: CreatePaymentStructureDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.create(dto, actor);
  }

  @Permissions('payment-structures.create')
  @Post('deduction-types')
  createDeductionType(
    @Body() dto: CreateDeductionTypeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.createDeductionType(dto, actor);
  }

  @Permissions('payment-structures.read')
  @Get('deduction-types')
  findDeductionTypes() {
    return this.paymentStructuresService.findDeductionTypes();
  }

  @Permissions('payment-structures.update')
  @Patch('deduction-types/:uuid')
  updateDeductionType(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateDeductionTypeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.updateDeductionType(
      uuid,
      dto,
      actor,
    );
  }
  
  @Permissions('payment-structures.update')
  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdatePaymentStructureDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.update(uuid, dto, actor);
  }

  @Permissions('payment-structures.read')
  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.paymentStructuresService.findByEmployee(employeeId);
  }

  @Permissions('payment-structures.read')
  @Get('employee/:employeeId/active')
  findActiveByEmployee(@Param('employeeId') employeeId: string) {
    return this.paymentStructuresService.findActiveByEmployee(employeeId);
  }

  @Permissions('payment-structures.create')
  @Post('employee-deductions')
  createEmployeeDeduction(
    @Body() dto: CreateEmployeeDeductionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.createEmployeeDeduction(
      dto,
      actor,
    );
  }

  @Permissions('payment-structures.read')
  @Get('employee-deductions/employee/:employeeId')
  findEmployeeDeductions(
    @Param('employeeId') employeeId: string,
  ) {
    return this.paymentStructuresService.findEmployeeDeductions(
      employeeId,
    );
  }

  @Permissions('payment-structures.update')
  @Patch('employee-deductions/:uuid')
  updateEmployeeDeduction(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateEmployeeDeductionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.updateEmployeeDeduction(
      uuid,
      dto,
      actor,
    );
  }

  @Permissions('payment-structures.delete')
  @Patch('employee-deductions/:uuid/delete')
  deleteEmployeeDeduction(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.deleteEmployeeDeduction(
      uuid,
      actor,
    );
  }
}
