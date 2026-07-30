import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuditLogsService } from './audit-logs.service';

@ApiTags('Audit Logs')
@ApiBearerAuth('jwt')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Permissions('audit.view')
  @Get()
  @ApiOperation({
    summary: 'List the latest audit log entries',
    description:
      'Returns a reverse-chronological feed of system audit events (who did what, when). Requires `audit.view` (or `audit.read_all` for cross-location visibility, enforced in the service).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description:
      'Max number of entries to return (default applied in service).',
  })
  @ApiResponse({ status: 200, description: 'List of audit log entries.' })
  findLatest(@Query('limit') limit?: string) {
    return this.auditLogsService.findLatest(limit);
  }
}
