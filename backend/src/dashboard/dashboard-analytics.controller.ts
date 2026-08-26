import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
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
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import {
  EmployeeAnalyticsQueryDto,
  PayrollAnalyticsQueryDto,
} from './dto/dashboard-analytics-query.dto';

@ApiTags('Dashboard analytics')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('dashboard/analytics')
export class DashboardAnalyticsController {
  constructor(
    private readonly dashboardAnalyticsService: DashboardAnalyticsService,
  ) {}

  @Permissions('employees.read')
  @Get('employees')
  @ApiOperation({
    summary: 'Employee dashboard analytics',
    description:
      "Returns scoped employee headcount analytics. SUPER_ADMIN or employees.read_all can view all locations; every other user is silently scoped to their own working location.",
  })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'working_location_id', required: false, type: String })
  @ApiQuery({ name: 'department_id', required: false, type: String })
  @ApiQuery({ name: 'position_id', required: false, type: String })
  @ApiQuery({ name: 'employment_category_id', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Employee analytics returned.' })
  employeeAnalytics(
    @CurrentUser() actor: CurrentUserType,
    @Query() query: EmployeeAnalyticsQueryDto,
  ) {
    return this.dashboardAnalyticsService.employeeAnalytics(actor, query);
  }

  @Permissions('payroll.reports')
  @Get('payroll')
  @ApiOperation({
    summary: 'Payroll dashboard analytics',
    description:
      "Returns scoped payroll batch analytics. SUPER_ADMIN or payroll.read_all can view all locations; every other user is silently scoped to their own working location.",
  })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'working_location_id', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Payroll analytics returned.' })
  payrollAnalytics(
    @CurrentUser() actor: CurrentUserType,
    @Query() query: PayrollAnalyticsQueryDto,
  ) {
    return this.dashboardAnalyticsService.payrollAnalytics(actor, query);
  }
}
