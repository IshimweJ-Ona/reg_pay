import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
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
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserPermissionOverrideDto } from './dto/update-user-permission-override.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('jwt')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.create')
  @Post()
  @ApiOperation({
    summary: 'Create a new user manually',
    description:
      'Allows administrators to manually create a user account. The user will be created with ACTIVE status if approved immediately, or PENDING if status is not specified.',
  })
  @ApiResponse({ status: 201, description: 'User created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. User lacks necessary permissions.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict. Email or phone number already exists.',
  })
  create(@Body() dto: RegisterDto, @CurrentUser() actor: CurrentUserType) {
    return this.usersService.createUser(dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.read')
  @Get()
  @ApiOperation({
    summary: 'List all users',
    description:
      'Returns a list of all users in the system, with optional filtering by name or status.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users returned successfully.',
  })
  findAll(
    @CurrentUser() actor: CurrentUserType,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('working_location_id') workingLocationId?: string,
    @Query('department_id') departmentId?: string,
  ) {
    return this.usersService.findAll(actor, {
      q,
      status,
      working_location_id: workingLocationId,
      department_id: departmentId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.read')
  @Get('pending')
  @ApiOperation({
    summary: 'List users pending approval',
    description:
      'Returns a list of users who have registered but have not yet been approved by an administrator.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending users returned successfully.',
  })
  findPending(@CurrentUser() actor: CurrentUserType, @Query('q') q?: string) {
    return this.usersService.findPendingApproval(actor, q);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.update')
  @Patch(':uuid')
  @ApiOperation({
    summary: 'Update user assignment',
    description:
      "Updates an active user's working location and department assignment.",
  })
  @ApiResponse({ status: 200, description: 'User assignment updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  updateUser(
    @Param('uuid') uuid: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.updateUser(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.approve')
  @Patch(':uuid/approve')
  @ApiOperation({
    summary: 'Approve a pending user',
    description:
      'Approves a pending registration, activates the account, and optionally assigns roles and permissions.',
  })
  @ApiResponse({ status: 200, description: 'User approved and activated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  approve(
    @Param('uuid') uuid: string,
    @Body() dto: ApproveUserDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.approveUser(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.approve')
  @Patch(':uuid/reject')
  @ApiOperation({
    summary: 'Reject a pending user',
    description:
      'Rejects a pending registration. The account status is set to REJECTED and the user will not be able to log in.',
  })
  @ApiResponse({ status: 200, description: 'User registration rejected.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  reject(
    @Param('uuid') uuid: string,
    @Body() dto: RejectUserDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.rejectUser(uuid, dto.reason, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.suspend')
  @Patch(':uuid/suspend')
  @ApiOperation({
    summary: 'Suspend a user account',
    description:
      'Suspends an active user account. The user will be immediately logged out and blocked from further access.',
  })
  @ApiResponse({ status: 200, description: 'User account suspended.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  suspend(@Param('uuid') uuid: string, @CurrentUser() actor: CurrentUserType) {
    return this.usersService.suspendUser(uuid, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.suspend')
  @Patch(':uuid/reactivate')
  @ApiOperation({
    summary: 'Reactivate a user account',
    description: 'Restores access to a previously suspended user account.',
  })
  @ApiResponse({ status: 200, description: 'User account reactivated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  reactivate(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.reactivateUser(uuid, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.update')
  @Patch(':uuid/roles')
  @ApiOperation({
    summary: 'Assign roles to a user',
    description: 'Updates the list of roles assigned to a specific user.',
  })
  @ApiResponse({ status: 200, description: 'Roles updated successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  assignRoles(
    @Param('uuid') uuid: string,
    @Body() dto: AssignUserRolesDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.assignRoles(uuid, dto.role_ids, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.update')
  @Patch(':uuid/permissions/:permission/override')
  @ApiOperation({
    summary: 'Override user permission',
    description:
      'Manually allows or denies a specific permission for a user, bypassing their role-based permissions.',
  })
  @ApiResponse({ status: 200, description: 'Permission override applied.' })
  @ApiResponse({ status: 404, description: 'User or permission not found.' })
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
  @Permissions('users.update')
  @Post('bulk-profile-images')
  @UseInterceptors(FilesInterceptor('images', 50, { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Bulk upload profile images',
    description:
      'Uploads multiple profile images to Cloudinary and maps them to users/employees based on a provided JSON mapping (filename to email/uuid/national ID).',
  })
  @ApiResponse({
    status: 200,
    description: 'Images uploaded and mapped successfully.',
  })
  async bulkUploadImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('mappings') mappings: string,
  ) {
    const parsedMappings = mappings ? JSON.parse(mappings) : {};
    return this.usersService.bulkUpdateAvatars(files, parsedMappings);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.update')
  @Patch(':uuid/avatar')
  @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { image: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({
    summary: 'Upload/replace a user profile picture',
    description:
      'Uploads a single image to Cloudinary, replacing any previous avatar for this user. Requires `users.update`.',
  })
  @ApiResponse({ status: 200, description: 'Avatar updated.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async uploadAvatar(
    @Param('uuid') uuid: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('An image file is required.');
    }
    return this.usersService.uploadUserAvatar(uuid, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.transfer')
  @Post(':uuid/transfer-requests')
  @ApiOperation({
    summary: 'Request user transfer',
    description:
      'Initiates a request to transfer a user from their current working location or department to a new one.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transfer request created successfully.',
  })
  @ApiResponse({ status: 404, description: 'User or destination not found.' })
  requestTransfer(
    @Param('uuid') uuid: string,
    @Body() dto: RequestTransferDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.requestTransfer(uuid, dto, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Permissions('users.transfer')
  @Patch('transfer-requests/:uuid/approve')
  @ApiOperation({
    summary: 'Approve user transfer',
    description:
      "Approves an ongoing user transfer request and updates the user's location/department records.",
  })
  @ApiResponse({ status: 200, description: 'Transfer approved and executed.' })
  @ApiResponse({ status: 404, description: 'Transfer request not found.' })
  approveTransfer(
    @Param('uuid') uuid: string,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.approveTransfer(uuid, actor);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Patch('transfer-requests/:uuid/reject')
  @ApiOperation({
    summary: 'Reject user transfer',
    description: 'Rejects a user transfer request with a provided reason.',
  })
  @ApiResponse({ status: 200, description: 'Transfer request rejected.' })
  @ApiResponse({ status: 404, description: 'Transfer request not found.' })
  rejectTransfer(
    @Param('uuid') uuid: string,
    @Body() dto: RejectTransferDto,
    @CurrentUser() actor: CurrentUserType,
  ) {
    return this.usersService.rejectTransfer(uuid, dto, actor);
  }

  @Get(':uuid/avatar')
  @ApiOperation({
    summary: 'Get user avatar URL',
    description: "Returns the public URL for a user's profile image.",
  })
  @ApiResponse({ status: 200, description: 'Avatar URL returned.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async getAvatar(@Param('uuid') uuid: string) {
    const avatarUrl = await this.usersService.getAvatarUrl(uuid);
    return { avatar_url: avatarUrl };
  }
}
