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
}
