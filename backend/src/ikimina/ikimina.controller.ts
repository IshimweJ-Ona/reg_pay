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
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { IkiminaService } from './ikimina.service';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('ikimina')
export class IkiminaController {
  constructor(private readonly ikiminaService: IkiminaService) {}

  @Permissions('ikimina.manage')
  @Post('memberships')
  createMembership(
    @Body() dto: CreateMembershipDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.ikiminaService.createMembership(dto, actor);
  }

  @Permissions('ikimina.read')
  @Get('memberships')
  findMemberships(@CurrentUser() actor: CurrentUserType) {
    return this.ikiminaService.findMemberships(actor);
  }

  @Permissions('ikimina.read')
  @Get('memberships/employee/:employeeId')
  findMembershipByEmployee(@Param('employeeId') employeeId: string) {
    return this.ikiminaService.findMembershipByEmployee(employeeId);
  }

  @Permissions('ikimina.manage')
  @Patch('memberships/:uuid')
  updateMembership(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateMembershipDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.ikiminaService.updateMembership(uuid, dto, actor);
  }
}