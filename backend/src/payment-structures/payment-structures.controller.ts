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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
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
import { CreateAllowanceDto } from './dto/create-allowance.dto';
import { CreateAllowanceTypeDto } from './dto/create-allowance-type.dto';
import { UpdateAllowanceTypeDto } from './dto/update-allowance-type.dto';

@ApiTags('Payment Structures')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('payment-structures')
export class PaymentStructuresController {
  constructor(
    private readonly paymentStructuresService: PaymentStructuresService,
  ) {}

  @Permissions('payment-structures.create')
  @Post()
  @ApiOperation({
    summary: 'Create a payment structure for an employee',
    description:
      'Sets up how an employee is paid (MONTHLY/DAILY/CUSTOM frequency, basic salary or daily rate). Superseding an existing active structure closes out the previous one (`effective_to`). Requires `payment-structures.create`.',
  })
  @ApiResponse({ status: 201, description: 'Payment structure created.' })
  create(
    @Body() dto: CreatePaymentStructureDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.create(dto, actor);
  }

  @Permissions('deductions.manage')
  @Post('deduction-types')
  @ApiOperation({
    summary: 'Create a deduction/tax type',
    description:
      'Defines a new system-wide deduction or custom tax type (FIXED amount or PERCENTAGE). This does NOT assign it to anyone - assignment happens via the employee-deductions endpoints below. Requires `deductions.manage`.',
  })
  @ApiResponse({ status: 201, description: 'Deduction type created.' })
  createDeductionType(
    @Body() dto: CreateDeductionTypeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.createDeductionType(dto, actor);
  }

  @Permissions('payment-structures.read')
  @Get('deduction-types')
  @ApiOperation({
    summary: 'List deduction/tax types',
    description:
      'Returns every deduction type defined in the system (both fixed and percentage-based). Requires `payment-structures.read`.',
  })
  @ApiResponse({ status: 200, description: 'List of deduction types.' })
  findDeductionTypes() {
    return this.paymentStructuresService.findDeductionTypes();
  }

  @Permissions('allowances.manage')
  @Post('allowance-types')
  @ApiOperation({
    summary: 'Create an allowance type',
    description:
      'Defines a new system-wide allowance type (e.g. Transport, Housing) with a default amount. This does NOT assign it to anyone - it just becomes pickable from the dropdown on Positions and Employees. Requires `allowances.manage`.',
  })
  @ApiResponse({ status: 201, description: 'Allowance type created.' })
  createAllowanceType(
    @Body() dto: CreateAllowanceTypeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.createAllowanceType(dto, actor);
  }

  @Permissions('payment-structures.read')
  @Get('allowance-types')
  @ApiOperation({
    summary: 'List allowance types',
    description:
      'Returns every allowance type defined in the system. Requires `payment-structures.read`.',
  })
  @ApiQuery({ name: 'include_inactive', required: false })
  @ApiResponse({ status: 200, description: 'List of allowance types.' })
  findAllowanceTypes(@Query('include_inactive') includeInactive?: string) {
    return this.paymentStructuresService.findAllowanceTypes(includeInactive === 'true');
  }

  @Permissions('allowances.manage')
  @Patch('allowance-types/:uuid')
  @ApiOperation({
    summary: 'Update or deactivate an allowance type',
    description: 'Requires `allowances.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Allowance type UUID.' })
  @ApiResponse({ status: 200, description: 'Allowance type updated.' })
  updateAllowanceType(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateAllowanceTypeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.updateAllowanceType(uuid, dto, actor);
  }

  @Permissions('payment-structures.read')
  @Get('calculate-paye')
  @ApiOperation({
    summary: 'Preview PAYE/income tax for a gross amount',
    description:
      'Runs the Rwanda PAYE progressive bracket calculation for a given gross salary, without persisting anything. Requires `payment-structures.read`.',
  })
  @ApiQuery({
    name: 'gross',
    required: true,
    description: 'Gross salary amount (RWF).',
  })
  @ApiResponse({
    status: 200,
    description: 'PAYE tax breakdown for the given gross amount.',
  })
  calculatePaye(@Query('gross') gross: string) {
    return this.paymentStructuresService.calculatePayeTax(Number(gross || 0));
  }

  @Permissions('deductions.manage')
  @Patch('deduction-types/:uuid')
  @ApiOperation({
    summary: 'Update a deduction/tax type',
    description:
      'Changes the name, mode, or rate of a deduction type. Requires `deductions.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Deduction type UUID.' })
  @ApiResponse({ status: 200, description: 'Deduction type updated.' })
  @ApiResponse({ status: 404, description: 'Deduction type not found.' })
  updateDeductionType(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateDeductionTypeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.updateDeductionType(uuid, dto, actor);
  }

  @Permissions('payment-structures.update')
  @Patch(':uuid')
  @ApiOperation({
    summary: 'Update a payment structure',
    description:
      'Edits an existing payment structure (rate, frequency, effective dates). Requires `payment-structures.update`.',
  })
  @ApiParam({ name: 'uuid', description: 'Payment structure UUID.' })
  @ApiResponse({ status: 200, description: 'Payment structure updated.' })
  @ApiResponse({ status: 404, description: 'Payment structure not found.' })
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdatePaymentStructureDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.update(uuid, dto, actor);
  }

  @Permissions('payment-structures.read')
  @Get('employee/:employeeId')
  @ApiOperation({
    summary: "List an employee's payment structure history",
    description:
      'Returns every payment structure ever set for this employee, most recent first. Requires `payment-structures.read`.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee id or uuid.' })
  @ApiResponse({ status: 200, description: 'Payment structure history.' })
  findByEmployee(
    @Param('employeeId') employeeId: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.findByEmployee(employeeId, actor);
  }

  @Permissions('payment-structures.read')
  @Get('employee/:employeeId/active')
  @ApiOperation({
    summary: "Get an employee's currently active payment structure",
    description:
      'Returns the single payment structure currently in effect (effective_to is null or in the future). Requires `payment-structures.read`.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee id or uuid.' })
  @ApiResponse({ status: 200, description: 'The active payment structure.' })
  @ApiResponse({
    status: 404,
    description: 'No active payment structure for this employee.',
  })
  findActiveByEmployee(
    @Param('employeeId') employeeId: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.findActiveByEmployee(
      employeeId,
      actor,
    );
  }

  @Permissions('deductions.manage')
  @Post('employee-deductions')
  @ApiOperation({
    summary: 'Assign a deduction/custom tax to an employee',
    description:
      'Attaches an existing deduction type to a specific employee, active from a given start date. Requires `deductions.manage`.',
  })
  @ApiResponse({ status: 201, description: 'Deduction assigned to employee.' })
  createEmployeeDeduction(
    @Body() dto: CreateEmployeeDeductionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.createEmployeeDeduction(dto, actor);
  }

  @Permissions('payment-structures.read')
  @Get('employee-deductions/employee/:employeeId')
  @ApiOperation({
    summary: "List an employee's assigned deductions",
    description:
      'Returns every deduction/custom tax currently or previously assigned to this employee. Requires `payment-structures.read`.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee id or uuid.' })
  @ApiResponse({ status: 200, description: 'List of employee deductions.' })
  findEmployeeDeductions(
    @Param('employeeId') employeeId: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.findEmployeeDeductions(
      employeeId,
      actor,
    );
  }

  @Permissions('deductions.manage')
  @Patch('employee-deductions/:uuid')
  @ApiOperation({
    summary: 'Update an employee deduction assignment',
    description:
      'Changes the active window (start/end date) or active flag of an assigned deduction. Requires `deductions.manage`.',
  })
  @ApiParam({
    name: 'uuid',
    description: 'Employee deduction assignment UUID.',
  })
  @ApiResponse({ status: 200, description: 'Employee deduction updated.' })
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

  @Permissions('deductions.manage')
  @Patch('employee-deductions/:uuid/delete')
  @ApiOperation({
    summary: 'Remove an employee deduction assignment',
    description:
      'Deactivates the deduction assignment so it no longer applies to future payroll batches. Requires `deductions.manage`.',
  })
  @ApiParam({
    name: 'uuid',
    description: 'Employee deduction assignment UUID.',
  })
  @ApiResponse({ status: 200, description: 'Employee deduction removed.' })
  deleteEmployeeDeduction(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.deleteEmployeeDeduction(uuid, actor);
  }

  @Permissions('payment-structures.create')
  @Post('allowances')
  @ApiOperation({
    summary: 'Add an allowance to an employee',
    description:
      'Creates a recurring allowance amount added on top of base salary during payroll calculation. Requires `payment-structures.create`.',
  })
  @ApiResponse({ status: 201, description: 'Allowance created.' })
  createAllowance(
    @Body() dto: CreateAllowanceDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.createAllowance(dto, actor);
  }

  @Permissions('payment-structures.read')
  @Get('allowances/employee/:employeeId')
  @ApiOperation({
    summary: "List an employee's allowances",
    description:
      'Returns every allowance (active and inactive) configured for this employee. Requires `payment-structures.read`.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee id or uuid.' })
  @ApiResponse({ status: 200, description: 'List of allowances.' })
  findAllowances(
    @Param('employeeId') employeeId: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.findAllowances(employeeId, actor);
  }

  @Permissions('payment-structures.update')
  @Patch('allowances/:uuid/deactivate')
  @ApiOperation({
    summary: 'Deactivate an allowance',
    description:
      'Stops the allowance from being included in future payroll calculations, without deleting its history. Requires `payment-structures.update`.',
  })
  @ApiParam({ name: 'uuid', description: 'Allowance UUID.' })
  @ApiResponse({ status: 200, description: 'Allowance deactivated.' })
  deactivateAllowance(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.deactivateAllowance(uuid, actor);
  }

  @Permissions('payment-structures.update')
  @Patch('allowances/:uuid')
  @ApiOperation({
    summary: 'Update an allowance',
    description:
      'Edits the amount, name, or active flag of an existing allowance. Requires `payment-structures.update`.',
  })
  @ApiParam({ name: 'uuid', description: 'Allowance UUID.' })
  @ApiResponse({ status: 200, description: 'Allowance updated.' })
  updateAllowance(
    @Param('uuid') uuid: string,
    @Body() dto: Partial<CreateAllowanceDto>,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.paymentStructuresService.updateAllowance(uuid, dto, actor);
  }
}
