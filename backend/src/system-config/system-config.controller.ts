import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { SystemConfigService } from './system-config.service';
import { BatchUpdateConfigDto, UpdateConfigDto } from './dto/update-config.dto';

@Controller('system-config')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Permissions('system-config.manage')
  @Get()
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Permissions('system-config.manage')
  @Get(':key')
  findByKey(@Param('key') key: string) {
    return this.systemConfigService.findByKey(key);
  }

  @Permissions('system-config.manage')
  @Post()
  update(@Body() dto: UpdateConfigDto) {
    return this.systemConfigService.update(dto);
  }

  @Permissions('system-config.manage')
  @Patch('batch')
  updateBatch(@Body() dto: BatchUpdateConfigDto) {
    return this.systemConfigService.updateBatch(dto.configs);
  }

  @Permissions('system-config.manage')
  @Get('monthly-taxes/all')
  getAllMonthlyTaxes() {
    return this.systemConfigService.getAllMonthlyTaxes();
  }

  @Permissions('system-config.manage')
  @Post('monthly-taxes')
  updateMonthlyTax(@Body() dto: { name: string; rate: number }) {
    return this.systemConfigService.updateMonthlyTax(dto.name, dto.rate);
  }

  @Permissions('system-config.manage')
  @Patch('monthly-taxes/:uuid/deactivate')
  deactivateMonthlyTax(@Param('uuid') uuid: string) {
    return this.systemConfigService.deactivateMonthlyTax(uuid);
  }
}
