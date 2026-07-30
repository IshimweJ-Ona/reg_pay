import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { IkiminaService } from './ikimina.service';

@ApiTags('Ikimina')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('ikimina')
export class IkiminaController {
  constructor(private readonly ikiminaService: IkiminaService) {}

  @Permissions('ikimina.manage')
  @Post('memberships')
  @ApiOperation({
    summary: 'Enroll an employee in an Ikimina savings group',
    description:
      'Creates a membership with a contribution amount that will be deducted each payroll cycle. Requires `ikimina.manage`.',
  })
  @ApiResponse({ status: 201, description: 'Membership created.' })
  createMembership(
    @Body() dto: CreateMembershipDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.ikiminaService.createMembership(dto, actor);
  }

  @Permissions('ikimina.read')
  @Get('memberships')
  @ApiOperation({
    summary: 'List Ikimina memberships',
    description:
      "Returns memberships scoped to the caller's access. Requires `ikimina.read`.",
  })
  @ApiResponse({ status: 200, description: 'List of memberships.' })
  findMemberships(@CurrentUser() actor: CurrentUserType) {
    return this.ikiminaService.findMemberships(actor);
  }

  @Permissions('ikimina.read')
  @Get('memberships/employee/:employeeId')
  @ApiOperation({
    summary: "Get one employee's Ikimina membership",
    description: 'Requires `ikimina.read`.',
  })
  @ApiParam({ name: 'employeeId', description: 'Employee id or uuid.' })
  @ApiResponse({ status: 200, description: 'Membership detail.' })
  @ApiResponse({
    status: 404,
    description: 'No membership found for this employee.',
  })
  findMembershipByEmployee(@Param('employeeId') employeeId: string) {
    return this.ikiminaService.findMembershipByEmployee(employeeId);
  }

  @Permissions('ikimina.manage')
  @Patch('memberships/:uuid')
  @ApiOperation({
    summary: 'Update an Ikimina membership',
    description:
      'Changes the contribution amount or active status of a membership. Requires `ikimina.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Membership UUID.' })
  @ApiResponse({ status: 200, description: 'Membership updated.' })
  @ApiResponse({ status: 404, description: 'Membership not found.' })
  updateMembership(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateMembershipDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.ikiminaService.updateMembership(uuid, dto, actor);
  }

  @Permissions('ikimina.manage')
  @Delete('memberships/:uuid')
  @ApiOperation({
    summary: 'Remove an employee from Ikimina savings',
    description:
      'Permanently removes the membership. Blocked if the member has contributions already processed through payroll — deactivate it instead in that case. Requires `ikimina.manage`.',
  })
  @ApiParam({ name: 'uuid', description: 'Membership UUID.' })
  @ApiResponse({ status: 200, description: 'Membership removed.' })
  @ApiResponse({ status: 404, description: 'Membership not found.' })
  @ApiResponse({
    status: 400,
    description:
      'Membership has processed payroll contributions and cannot be removed.',
  })
  removeMembership(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.ikiminaService.removeMembership(uuid, actor);
  }
}
