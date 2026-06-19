import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: CurrentUserType) {
    return this.rolesService.create(dto, actor);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.rolesService.update(id, dto, actor);
  }
}
