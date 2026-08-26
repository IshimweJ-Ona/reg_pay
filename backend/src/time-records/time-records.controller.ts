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
import { ApproveTimeRecordDto } from './dto/approve-time-record.dto';
import { CreateTimeRecordDto } from './dto/create-time-record.dto';
import { UpdateTimeRecordDto } from './dto/update-time-record.dto';
import { BulkImportDto } from './dto/bulk-import.dto';
import { TimeRecordsService } from './time-records.service';

@ApiTags('Attendance')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('time-records')
export class TimeRecordsController {
  constructor(private readonly timeRecordsService: TimeRecordsService) {}

  @Permissions('attendance.create')
  @Post()
  @ApiOperation({
    summary: 'Record a single attendance/time entry',
    description:
      'Creates one time record (clock-in/out or a manual entry) for an employee. Requires `attendance.create`.',
  })
  @ApiResponse({ status: 201, description: 'Time record created.' })
  create(
    @Body() dto: CreateTimeRecordDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.create(dto, actor);
  }

  @Permissions('attendance.create')
  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk import time records',
    description:
      'Creates many time records at once, e.g. from a spreadsheet import. Requires `attendance.create`.',
  })
  @ApiResponse({ status: 201, description: 'Records imported.' })
  bulkCreate(
    @Body() dto: BulkImportDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.bulkCreate(dto, actor);
  }

  @Permissions('attendance.update')
  @Patch(':uuid')
  @ApiOperation({
    summary: 'Update a time record',
    description:
      'Corrects clock-in/out times or attendance status on an existing record. Requires `attendance.update`.',
  })
  @ApiParam({ name: 'uuid', description: 'Time record UUID.' })
  @ApiResponse({ status: 200, description: 'Time record updated.' })
  @ApiResponse({ status: 404, description: 'Time record not found.' })
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateTimeRecordDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.update(uuid, dto, actor);
  }

  @Permissions('attendance.approve')
  @Patch(':uuid/approve')
  @ApiOperation({
    summary: 'Approve a time record',
    description:
      'Marks a pending time record as approved so it becomes eligible for payroll calculation. Requires `attendance.approve`.',
  })
  @ApiParam({ name: 'uuid', description: 'Time record UUID.' })
  @ApiResponse({ status: 200, description: 'Time record approved.' })
  approve(
    @Param('uuid') uuid: string,
    @Body() dto: ApproveTimeRecordDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.approve(uuid, dto, actor);
  }

  @Permissions('attendance.read')
  @Get('pending')
  @ApiOperation({
    summary: 'List time records pending approval',
    description:
      "Returns time records awaiting approval, scoped to the caller's working location unless they hold read_all/SUPER_ADMIN. Requires `attendance.read`.",
  })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiQuery({ name: 'working_location_id', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiResponse({ status: 200, description: 'Pending time records.' })
  findPending(
    @CurrentUser() actor: CurrentUserType,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('working_location_id') workingLocationId?: string,
    @Query('category') category?: string,
  ) {
    return this.timeRecordsService.findPending(actor, {
      start_date: startDate,
      end_date: endDate,
      working_location_id: workingLocationId,
      category,
    });
  }

  @Permissions('attendance.read')
  @Get()
  @ApiOperation({
    summary: 'List time records',
    description:
      "Returns time records filtered by date range, working location, or employee, scoped to the caller's access. Requires `attendance.read`.",
  })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiQuery({ name: 'working_location_id', required: false })
  @ApiQuery({ name: 'employee_id', required: false })
  @ApiResponse({ status: 200, description: 'List of time records.' })
  findAll(
    @CurrentUser() actor: CurrentUserType,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('working_location_id') workingLocationId?: string,
    @Query('employee_id') employeeId?: string,
  ) {
    return this.timeRecordsService.findAll(actor, {
      start_date: startDate,
      end_date: endDate,
      working_location_id: workingLocationId,
      employee_id: employeeId,
    });
  }

  @Permissions('attendance.read')
  @Get('employee/:employeeId')
  @ApiOperation({
    summary: "Get one employee's attendance history",
    description:
      'Returns time records for a single employee over an optional date range. Requires `attendance.read`.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee id or uuid.' })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiResponse({ status: 200, description: "Employee's time records." })
  findByEmplloyee(
    @Param('employeeId') employeeId: string,
    @CurrentUser() actor: CurrentUserType,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.timeRecordsService.findByEmployee(employeeId, actor, {
      start_date: startDate,
      end_date: endDate,
    });
  }
}
