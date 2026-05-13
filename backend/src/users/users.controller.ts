import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { RejectTransferDto } from '../common/dto/reject-transfer.dto';
import { RequestTransferDto } from '../common/dto/request-transfer.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { RejectUserDto } from './dto/reject-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: RegisterDto) {
    return this.usersService.createUser(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Get('pending')
  findPending() {
    return this.usersService.findPendingApproval();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch(':uuid/approve')
  approve(
    @Param('uuid') uuid: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.approveUser(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch(':uuid/reject')
  reject(
    @Param('uuid') uuid: string,
    @Body() dto: RejectUserDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.rejectUser(uuid, dto.reason, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch(':uuid/suspend')
  suspend(@Param('uuid') uuid: string, @CurrentUser() actor: CurrentUserType) {
    return this.usersService.suspendUser(uuid, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  @Patch(':uuid/roles')
  assignRoles(
    @Param('uuid') uuid: string,
    @Body() dto: AssignUserRolesDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.assignRoles(uuid, dto.role_ids, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  @Post(':uuid/transfer-requests')
  requestTransfer(
    @Param('uuid') uuid: string,
    @Body() dto: RequestTransferDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.requestTransfer(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HQ_MANAGER')
  @Patch('transfer-requests/:uuid/approve')
  approveTransfer(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.approveTransfer(uuid, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'HQ_MANAGER')
  @Patch('transfer-requests/:uuid/reject')
  rejectTransfer(
    @Param('uuid') uuid: string,
    @Body() dto: RejectTransferDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.rejectTransfer(uuid, dto, actor);
  }
}
