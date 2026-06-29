import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignUserPermissionDto } from './dto/assign-user-permission.dto';
import { PermissionsService } from './permissions.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('SUPER_ADMIN', 'BRANCH_MANAGER')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}


  @Permissions('permissions.read')
  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }

  @Permissions('permissions.assign')
  @Roles('SUPER_ADMIN')
  @Post('assign-role')
  assignToRole(
    @Body() dto: AssignPermissionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.permissionsService.assignToRole(dto, actor);
  }

  @Permissions('permissions.assign')
  @Roles('SUPER_ADMIN')
  @Delete('assign-role')
  removeFromRole(
    @Query() dto: AssignPermissionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.permissionsService.removeFromRole(dto, actor);
  }

  @Permissions('permissions.assign')
  @Post('assign-user')
  assignToUser(
    @Body() dto: AssignUserPermissionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.permissionsService.assignToUser(dto, actor);
  }

  @Permissions('permissions.assign')
  @Delete('assign-user')
  removeFromUser(
    @Query() dto: AssignUserPermissionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.permissionsService.removeFromUser(dto, actor);
  }
}
