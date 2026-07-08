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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { ApproveTimeRecordDto } from './dto/approve-time-record.dto';
import { CreateTimeRecordDto } from './dto/create-time-record.dto';
import { UpdateTimeRecordDto } from './dto/update-time-record.dto';
import { BulkImportDto } from './dto/bulk-import.dto';
import { TimeRecordsService } from './time-records.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
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

  @Permissions('attendance.create')
  @Post('batch-sync')
  batchSync(
    @Body() dto: { records: CreateTimeRecordDto[] },
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.batchSync(dto, actor);
  }

  @Permissions('attendance.create')
  @Post('bulk')
  bulkCreate(
    @Body() dto: BulkImportDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.bulkCreate(dto, actor);
  }

  @Permissions('attendance.update')
  @Patch(':uuid')
  update(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateTimeRecordDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.update(uuid, dto, actor);
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
  @Get('today')
  findToday(
    @Query('working_location_id') workingLocationId?: string,
    @Query('category') category?: string,
    @CurrentUser() actor?: CurrentUserType,
  ) {
    return this.timeRecordsService.findToday(workingLocationId, category, actor);
  }

  @Permissions('attendance.read')
  @Get()
  findAll(@CurrentUser() actor: CurrentUserType) {
    return this.timeRecordsService.findAll(actor);
  }

  @Permissions('attendance.read')
  @Get('employee/:employeeId')
  findByEmplloyee(
    @Param('employeeId') employeeId: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.timeRecordsService.findByEmployee(employeeId, actor);
  }
}