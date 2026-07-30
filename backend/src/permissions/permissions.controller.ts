import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { CurrentUserType } from '../auth/types/current-user.type';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignUserPermissionDto } from './dto/assign-user-permission.dto';
import { PermissionsService } from './permissions.service';

@ApiTags('RBAC')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Permissions('permissions.read')
  @Get()
  @ApiOperation({
    summary: 'List every permission module and key in the system',
    description:
      'Returns the full permission registry grouped by module (USER_MANAGEMENT, RBAC, ORGANIZATION, EMPLOYEES, ATTENDANCE, PAYMENT_STRUCTURES, PAYROLL, NOTIFICATIONS, AUDIT, IKIMINA, SYSTEM_CONFIG), each with its key, display name, and description. This is the source list used to build role/user permission checklists. Requires `permissions.read`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Permission modules with their permission definitions.',
  })
  findAll() {
    return this.permissionsService.findAll();
  }

  @Permissions('permissions.assign')
  @Post('assign-role')
  @ApiOperation({
    summary: 'Add a permission key to a role',
    description:
      'Grants a permission key to a role (added to its permission_keys array). Notifies every user currently holding that role. Requires `permissions.assign`.',
  })
  @ApiResponse({ status: 201, description: 'Permission assigned to role.' })
  @ApiResponse({
    status: 400,
    description: 'Role or permission key does not exist.',
  })
  assignToRole(
    @Body() dto: AssignPermissionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.permissionsService.assignToRole(dto, actor);
  }

  @Permissions('permissions.assign')
  @Delete('assign-role')
  @ApiOperation({
    summary: 'Remove a permission key from a role',
    description:
      'Revokes a permission key from a role. Notifies every user currently holding that role so their access refreshes immediately. Requires `permissions.assign`.',
  })
  @ApiResponse({ status: 200, description: 'Permission removed from role.' })
  @ApiResponse({ status: 404, description: 'Role not found.' })
  removeFromRole(
    @Query() dto: AssignPermissionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.permissionsService.removeFromRole(dto, actor);
  }

  @Permissions('permissions.assign')
  @Post('assign-user')
  @ApiOperation({
    summary: 'Grant a permission directly to one user',
    description:
      'Adds a direct per-user permission grant (on top of whatever their role already gives them). A BRANCH_MANAGER may only grant this to users in their own branch; SUPER_ADMIN can grant to anyone. Requires `permissions.assign`.',
  })
  @ApiResponse({ status: 201, description: 'Permission assigned to user.' })
  @ApiResponse({
    status: 400,
    description:
      'User/permission key invalid, or actor cannot grant outside their branch.',
  })
  assignToUser(
    @Body() dto: AssignUserPermissionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.permissionsService.assignToUser(dto, actor);
  }

  @Permissions('permissions.assign')
  @Delete('assign-user')
  @ApiOperation({
    summary: 'Remove a direct permission grant from a user',
    description:
      "Removes a previously granted direct user permission. Does not affect what the user's role grants them. Requires `permissions.assign`.",
  })
  @ApiResponse({ status: 200, description: 'Permission removed from user.' })
  @ApiResponse({ status: 404, description: 'Assignment not found.' })
  removeFromUser(
    @Query() dto: AssignUserPermissionDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.permissionsService.removeFromUser(dto, actor);
  }
}
