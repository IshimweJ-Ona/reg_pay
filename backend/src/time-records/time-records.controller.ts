import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { ApproveTimeRecordDto } from './dto/approve-time-record.dto';
import { CreateTimeRecordDto } from './dto/create-time-record.dto';
import { UpdateTimeRecordDto } from './dto/update-time-record.dto';
import { TimeRecordsService } from './time-records.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'HR_MANAGER', 'DEPARTMENT_MANAGER')
@Controller('time-records')
export class TimeRecordsController {
  constructor(private readonly timeRecordsService: TimeRecordsService) {}

  @Permissions('attendance.create')
  @Post()
  create(
    @Body() dto: CreateTimeRecordDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.create(dto, actor);
  }

  @Permissions('attendance.update')
  @Patch(':uuid/clock-out')
  clockOut(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateTimeRecordDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.clockOut(uuid, dto, actor);
  }

  @Permissions('attendance.approve')
  @Patch(':uuid/approve')
  approve(
    @Param('uuid') uuid: string,
    @Body() dto: ApproveTimeRecordDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.approve(uuid, dto, actor);
  }

  @Permissions('attendance.read')
  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.timeRecordsService.findByEmployee(employeeId);
  }
}
