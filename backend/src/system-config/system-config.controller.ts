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
import { Roles } from '../auth/decorators/roles.decorator';
import { SystemConfigService } from './system-config.service';
import { BatchUpdateConfigDto, UpdateConfigDto } from './dto/update-config.dto';

@Controller('system-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  findAll() {
    return this.systemConfigService.findAll();
  }

  @Get(':key')
  findByKey(@Param('key') key: string) {
    return this.systemConfigService.findByKey(key);
  }

  @Post()
  update(@Body() dto: UpdateConfigDto) {
    return this.systemConfigService.update(dto);
  }

  @Patch('batch')
  updateBatch(@Body() dto: BatchUpdateConfigDto) {
    return this.systemConfigService.updateBatch(dto.configs);
  }

  @Get('monthly-taxes/all')
  getAllMonthlyTaxes() {
    return this.systemConfigService.getAllMonthlyTaxes();
  }

  @Post('monthly-taxes')
  @Roles('SUPER_ADMIN')
  updateMonthlyTax(@Body() dto: { name: string; rate: number }) {
    return this.systemConfigService.updateMonthlyTax(dto.name, dto.rate);
  }

  @Patch('monthly-taxes/:uuid/deactivate')
  @Roles('SUPER_ADMIN')
  deactivateMonthlyTax(@Param('uuid') uuid: string) {
    return this.systemConfigService.deactivateMonthlyTax(uuid);
  }
}
