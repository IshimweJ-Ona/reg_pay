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
}
