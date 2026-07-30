import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { SystemConfigService } from './system-config.service';
import { BatchUpdateConfigDto, UpdateConfigDto } from './dto/update-config.dto';

@ApiTags('System Config')
@ApiBearerAuth('jwt')
@Controller('system-config')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Permissions('system-config.manage')
  @Get()
  @ApiOperation({
    summary: 'List all system configuration key/value entries',
    description:
      'Returns every system-wide setting (e.g. overtime multiplier, work hours, currency). Requires `system-config.manage`.',
  })
  @ApiResponse({ status: 200, description: 'List of config entries.' })
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Permissions('system-config.manage')
  @Get(':key')
  @ApiOperation({
    summary: 'Get one system configuration entry',
    description: 'Requires `system-config.manage`.',
  })
  @ApiParam({ name: 'key', description: 'Configuration key.' })
  @ApiResponse({ status: 200, description: 'Config entry.' })
  @ApiResponse({ status: 404, description: 'Key not found.' })
  findByKey(@Param('key') key: string) {
    return this.systemConfigService.findByKey(key);
  }

  @Permissions('system-config.manage')
  @Post()
  @ApiOperation({
    summary: 'Create or update one configuration entry',
    description:
      'Upserts a single key/value system setting. Requires `system-config.manage`.',
  })
  @ApiResponse({ status: 201, description: 'Config entry saved.' })
  update(@Body() dto: UpdateConfigDto) {
    return this.systemConfigService.update(dto);
  }

  @Permissions('system-config.manage')
  @Patch('batch')
  @ApiOperation({
    summary: 'Update multiple configuration entries at once',
    description:
      'Upserts a list of key/value settings in one call. Requires `system-config.manage`.',
  })
  @ApiResponse({ status: 200, description: 'Config entries saved.' })
  updateBatch(@Body() dto: BatchUpdateConfigDto) {
    return this.systemConfigService.updateBatch(dto.configs);
  }

  @Permissions(
    'system-config.manage',
    'deductions.manage',
    'payment-structures.read',
  )
  @Get('monthly-taxes/all')
  @ApiOperation({
    summary: 'List all PAYE monthly tax brackets',
    description:
      'Returns the progressive income-tax bracket table used for payroll tax calculation. Requires `system-config.manage`, `deductions.manage`, or `payment-structures.read`.',
  })
  @ApiResponse({ status: 200, description: 'List of tax brackets.' })
  getAllMonthlyTaxes() {
    return this.systemConfigService.getAllMonthlyTaxes();
  }

  @Permissions('system-config.manage')
  @Post('monthly-taxes')
  @ApiOperation({
    summary: 'Create or update a PAYE tax bracket',
    description:
      'Upserts a named tax bracket with its rate. Requires `system-config.manage`.',
  })
  @ApiResponse({ status: 201, description: 'Tax bracket saved.' })
  updateMonthlyTax(@Body() dto: { name: string; rate: number }) {
    return this.systemConfigService.updateMonthlyTax(dto.name, dto.rate);
  }

  @Permissions('system-config.manage')
  @Patch('monthly-taxes/:uuid/deactivate')
  @ApiOperation({
    summary: 'Deactivate a PAYE tax bracket',
    description:
      'Marks a tax bracket inactive so it is no longer applied in payroll calculations. Requires `system-config.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Tax bracket UUID.' })
  @ApiResponse({ status: 200, description: 'Tax bracket deactivated.' })
  deactivateMonthlyTax(@Param('uuid') uuid: string) {
    return this.systemConfigService.deactivateMonthlyTax(uuid);
  }
}
