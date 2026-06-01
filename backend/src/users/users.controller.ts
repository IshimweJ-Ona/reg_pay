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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import { RequestTransferDto } from '../common/dto/request-transfer.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { RejectUserDto } from './dto/reject-user.dto';
import { UpdateUserPermissionOverrideDto } from './dto/update-user-permission-override.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  @Permissions('users.create')
  @Post()
  create(@Body() dto: RegisterDto, @CurrentUser() actor: CurrentUserType) {
    return this.usersService.createUser(dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  @Permissions('users.read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserType,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.findAll(actor, { q, status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  @Permissions('users.read')
  @Get('pending')
  findPending(@Query('q') q?: string) {
    return this.usersService.findPendingApproval(q);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  @Permissions('users.approve')
  @Patch(':uuid/approve')
  approve(
    @Param('uuid') uuid: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.approveUser(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  @Permissions('users.approve')
  @Patch(':uuid/reject')
  reject(
    @Param('uuid') uuid: string,
    @Body() dto: RejectUserDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.rejectUser(uuid, dto.reason, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  @Permissions('users.suspend')
  @Patch(':uuid/suspend')
  suspend(@Param('uuid') uuid: string, @CurrentUser() actor: CurrentUserType) {
    return this.usersService.suspendUser(uuid, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Permissions('users.update')
  @Patch(':uuid/roles')
  assignRoles(
    @Param('uuid') uuid: string,
    @Body() dto: AssignUserRolesDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.assignRoles(uuid, dto.role_ids, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN')
  @Permissions('users.update')
  @Patch(':uuid/permissions/:permission/override')
  updatePermissionOverride(
    @Param('uuid') uuid: string,
    @Param('permission') permission: string,
    @Body() dto: UpdateUserPermissionOverrideDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.updatePermissionOverride(
      uuid,
      permission,
      dto,
      actor,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  @Permissions('users.transfer')
  @Post(':uuid/transfer-requests')
  requestTransfer(
    @Param('uuid') uuid: string,
    @Body() dto: RequestTransferDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.requestTransfer(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HQ_MANAGER')
  @Permissions('users.transfer')
  @Patch('transfer-requests/:uuid/approve')
  approveTransfer(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.approveTransfer(uuid, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HQ_MANAGER')
  @Permissions('users.transfer')
  @Patch('transfer-requests/:uuid/reject')
  rejectTransfer(
    @Param('uuid') uuid: string,
    @Body() dto: RejectTransferDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.rejectTransfer(uuid, dto, actor);
  }
}
