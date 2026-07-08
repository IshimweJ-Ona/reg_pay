import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { SuspendEmployeeDto } from './dto/suspend-employee.dto';
import { TransferEmployeeDto } from './dto/transfer-employee.dto';
import {
  EmployeeEntity,
  PaginatedEmployeesEntity,
  TransferRequestEntity,
} from './entities/employee.entity';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // POST /employees
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions('employees.create')
  @ApiOperation({
    summary: 'Create a new employee',
    description:
      'Registers a new employee record. The actor creating the employee must have ' +
      'the `employees.create` permission. Branch managers can only create employees ' +
      'within their assigned branch.',
  })
  @ApiResponse({
    status: 201,
    description: 'Employee successfully created',
    type: EmployeeEntity,
  })
  @ApiResponse({
    status: 403,
    description:
      'Role or permission check failed, Do not have access to create employee.',
  })
  create(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.create(dto, actor);
  }

  // GET /employees
  @Get()
  @Permissions('employees.read')
  @ApiOperation({
    summary: 'List all employees',
    description:
      'Returns a list of employees visible to the authenticated user. ' +
      'Branch Managers see only employee in their branch. ' +
      'Super Admins see all employees across every location.' +
      'Optionally filter by name, email, or national ID using the `q` query parameter.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description:
      'Full-text search query matches against first name, last name, email, ' +
      'phone number, or national ID.',
    example: 'Jean Mugisha',
  })
  @ApiResponse({
    status: 200,
    description: 'Employees list returned successfully ',
    type: PaginatedEmployeesEntity,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid Bearer token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Restricted permission or role.',
  })
  findAll(@CurrentUser() actor: CurrentUserType, @Query('q') q?: string) {
    return this.employeesService.findAll(actor, q);
  }

  // GET /employees/:uuid
  @Get(':uuid')
  @Permissions('employees.read')
  @ApiOperation({
    summary: 'Get employee by UUID',
    description:
      'Returns the full profile of a single employee. Branch Managers can only ' +
      'retrieve employees belonging to their branch.',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    description: 'The UUID of the employee to retrieve.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee profile returned successfully.',
    type: EmployeeEntity,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid Bearer token.',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee not found.',
  })
  findOne(@Param('uuid') uuid: string, @CurrentUser() actor: CurrentUserType) {
    return this.employeesService.findOne(uuid, actor);
  }

  // PATCH /employees/:uuid
  @Patch(':uuid')
  @Permissions('employees.update')
  @ApiOperation({
    summary: 'Update employee profile',
    description:
      'Partially updates an employee records. All fields in the request body are ' +
      'optional only provided fields are updated. Branch Managers can only ' +
      'update employees within their own branch.',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    description: 'The UUID of the employee to update.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee profile updated successfully',
    type: EmployeeEntity,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error. Ex: `duplicate email or malformated phone_number.`',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid Bearer token.',
  })
  @ApiResponse({ status: 403, description: 'Restricted role or permission.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.update(uuid, dto, actor);
  }

  // PATCH /employees/:uuid/transfer
  @Patch(':uuid/transfer')
  @Permissions('employees.transfer')
  @ApiOperation({
    summary: 'Initiate an employee transfer',
    description:
      'Creates a transfer request to move an employee to a different branch or ' +
      'department. The request starts in `PENDING` status and must be approved by ' +
      'a Super Admin or Branch Manager of the target branch before it takes effect. ' +
      'An optional reason can be provided for audit trail purposes.',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    description: 'The UUID of the employee to transfer.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfer request created successfully, status is PENDING.',
    type: TransferRequestEntity,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid target location or department UUID.',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token.' })
  @ApiResponse({ status: 403, description: 'Restricted role or permission.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  transfer(
    @Param('uuid') uuid: string,
    @Body() dto: TransferEmployeeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.transfer(uuid, dto, actor);
  }

  // PATCH /employees/transfer-requests/:uuid/approve
  @Patch('transfer-requests/:uuid/approve')
  @Permissions('employees.transfer_approve')
  @ApiOperation({
    summary: 'Approve a pending employee transfer request',
    description:
      'Approves a transfer request and moves the employee to the target branch ' +
      'and department. Only Super Admins or Branch Manager of the destination ' +
      "branch can approve. Once approved the employee's working location and " +
      'department are updated immediately and an audit entry is recorded.',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    description: 'The UUID of the transfer request to approve.',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfer request approved. Employee location updated.',
    type: TransferRequestEntity,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token.' })
  @ApiResponse({ status: 403, description: 'Restricted role or permission.' })
  @ApiResponse({
    status: 404,
    description: 'Transfer request not found or already processed.',
  })
  approveTransfer(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.approveTransfer(uuid, actor);
  }

  // PATCH /employees/transfer-requests/:uuid/reject
  @Patch('transfer-requests/:uuid/reject')
  @Permissions('employees.transfer_approve')
  @ApiOperation({
    summary: 'Reject a pending employee transfer request',
    description:
      'Reject a transfer request and keeps the employee in their current location. ' +
      'A rejection reason is required and will be stored in transfer request ' +
      'record for audit purposes.',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    description: 'The UUID of the transfer request to reject.',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @ApiResponse({
    status: 200,
    description:
      'Transfer request rejected, Employee remains in current location.',
    type: TransferRequestEntity,
  })
  @ApiResponse({
    status: 400,
    description: 'Rejection reason is required.',
  })
  @ApiResponse({ status: 402, description: 'Missing or invalid Bearer token.' })
  @ApiResponse({ status: 403, description: 'Restricted role or permission.' })
  @ApiResponse({
    status: 404,
    description: 'Transfer request not found or already processed.',
  })
  rejectTransfer(
    @Param('uuid') uuid: string,
    @Body() dto: RejectTransferDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.rejectTransfer(uuid, dto, actor);
  }

  // PATCH /employees/:uuid/suspend
  @Patch(':uuid/suspend')
  @Permissions('employees.suspend')
  @ApiOperation({
    summary: 'Suspend an employee',
    description:
      'Sets the employee status to `SUSPEND`, preventing them from appearing ' +
      'in active payroll cycles and attendance records. An optional reason should ' +
      'be provided for HR records. The employee can be activated at any time ' +
      'using the `/reactivate` endpoint.',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    description: 'The UUID of the employee to suspend.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee suspended successfully. Status set to `SUSPENDED`.',
    type: EmployeeEntity,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token.' })
  @ApiResponse({ status: 403, description: 'Restricted role or permissions.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  @ApiResponse({ status: 409, description: 'Employee is already suspended.' })
  suspend(
    @Param('uuid') uuid: string,
    @Body() dto: SuspendEmployeeDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.suspend(uuid, dto, actor);
  }

  // PATCH /employees/:uuid/reactivate
  @Patch(':uuid/reactivate')
  @Permissions('employees.update')
  @ApiOperation({
    summary: 'Reactivate a suspended employee',
    description:
      'Sets the employee status back to `ACTIVE` after a suspension.' +
      'Reactivated employees are immediately eligible for payroll processing' +
      'and attendance tracking in the next cycle.',
  })
  @ApiParam({
    name: 'uuid',
    type: String,
    description: 'The UUID of the employee to reactivate.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Employee reactivated successfully. Status set to `ACTIVE`.',
    type: EmployeeEntity,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token.' })
  @ApiResponse({ status: 403, description: 'Restricted role or permissions.' })
  @ApiResponse({ status: 404, description: 'Employee not found.' })
  @ApiResponse({ status: 409, description: 'Employee is already active.' })
  reactivate(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.employeesService.reactivate(uuid, actor);
  }
}
