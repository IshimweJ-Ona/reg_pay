import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  ForgotPasswordResponseEntity,
  LoginResponseEntity,
  MeResponseEntity,
  MessageResponseEntity,
  RegisterResponseEntity,
  TokenPairEntity,
} from './entities/auth.entity';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { CurrentUserType } from './types/current-user.type';

type UpdateProfileDto = {
  first_name?: string;
  last_name?: string;
  email?: string;
  password?: string;
};

/**
 * Handles all authentication and session management for Reg Pay.
 * Registration flow:
 *   1. User registers -> status = PENDING
 *   2. Branch Maager or Super Admin approves -> status = ACTIVE
 *   3. User can login and receive tokens
 *
 * Role-based redirect (after login):
 *   SUPER_ADMIN -> /super_admin/<uuid>
 *   BRANCH_MANAGER -> /manager/<uuid>
 *   HR -> /hr/<uuid>
 *   ACCOUNTANT -> /finance/<uuid>
 *   FINANCE   -> /finance/<uuid>
 *   PENDING status -> /auth/pending/<uuid>
 */

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register
  // Public no guard required

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user account',
    description:
      'Creates a new user account with status `PENDING`. The account can not be ' +
      'used to log in untli a Branch Manager or Super Admin approve it. ' +
      'A notification is automatically sent to the relevant Branch Manager ' +
      '(or to all Supper Admins if no branch is specified). ' +
      'Duplicate email or phone number results in a 409 Conflict.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Registration submitted successfully. Account is PENDING approval.',
    type: RegisterResponseEntity,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error. e.g. email format invalid, phone number invalid, ' +
      'or password does not meet requirements. ',
  })
  @ApiResponse({
    status: 409,
    description: 'A user with this email or phone number already exists.',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /auth/login
  // Public no guard required
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with email or phone number',
    description:
      'Authenticates a user and returns a JWT access token + refresh token pair. ' +
      'The `redirectUrl` field tells the frontend where to navigate based on the ' +
      "user's role.\n\n" +
      '**Possible Redirect Paths:**\n' +
      '- `/super_admin/<uuid>`: For Super Administrators\n' +
      '- `/manager/<uuid>`: For Branch/Department Managers\n' +
      '- `/hr/<uuid>`: For HR Personnel\n' +
      '- `/finance/<uuid>`: For Accountants and Finance staff\n' +
      '- `/auth/pending/<uuid>`: For users awaiting approval\n\n' +
      'Every login attempt is recorded in the system audit logs for security monitoring.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful. Returns tokens and user metadata.',
    type: LoginResponseEntity,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request. Usually means the identifier or password was not provided or is in an invalid format.',
  })
  @ApiResponse({
    status: 401,
    description:
      'Unauthorized. The credentials provided are incorrect, or the account is suspended/rejected.',
  })
  @ApiResponse({
    status: 500,
    description:
      'Internal Server Error. Something went wrong on the server. Please contact support if this persists.',
  })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, {
      deviceInfo: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  }

  // GET /auth/login
  // Public no guard required
  @Get('login')
  @ApiOperation({
    summary: 'Get login page info',
    description:
      'Public endpoint that verifies the auth service is available and ready for login requests. ' +
      'Returns basic login form metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login service is available.',
  })
  getLogin() {
    return {
      status: 'ok',
      message: 'Login service is available',
    };
  }

  // GET /auth/me
  //Protected requires valid access token
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current autheticated user profile',
    description:
      'Returns the full profile of the currently authenticated user, including: ' +
      'personal details, working location, department, all assigned roles, ' +
      'admin contact liest (for PENDING users to know who to contact), ' +
      'and the last 100 audit log entries for their account.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile returned successfully.',
    type: MeResponseEntity,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid Bearer token.',
  })
  me(@CurrentUser() user: CurrentUserType) {
    return this.authService.me(user.userId);
  }

  // POST /auth/refresh
  //Public uses refresh toke in body, not access token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token using a refresh token',
    description:
      'Issues a new access token + refresh token pair.' +
      'The provided refresh token is immediately revoked (single-use rotation) ' +
      'and a new session entry is created. ' +
      'Call this endpoint when the access token expires (15 minutes) to maintain ' +
      'the session without requiring the user to log in again.',
  })
  @ApiResponse({
    status: 200,
    description: 'New toke pair issued, old refresh token invalid.',
    type: TokenPairEntity,
  })
  @ApiResponse({
    status: 401,
    description:
      'Refresh token is invalid, expired, or has already been revoked.',
  })
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto.refresh_token, {
      deviceInfo: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  }

  // POST /auth/logout
  // Protected revokes the specific session matching the refresh token
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout — revoke current session',
    description:
      'Revokes the session associated with the provided refresh token. ' +
      'The access token will still be valid until it expires naturally (15 minutes), ' +
      'so clients should also discard it locally. ' +
      'To invalidate all sessions across all devices use POST /auth/logout-all.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session revoked successfully.',
    type: MessageResponseEntity,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token.' })
  logout(@CurrentUser() user: CurrentUserType, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user.userId, dto.refresh_token);
  }

  // POST /auth/logout-all
  // Protected revokes ALL active sessions for the current user
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description:
      'Revokes all active sessions for the authenticated user across every device. ' +
      'Use this when a device is lost or after a suspected compromise. ' +
      'The user will need to log in again on every device.',
  })
  @ApiResponse({
    status: 200,
    description: 'All sessions revoked successfully.',
    type: MessageResponseEntity,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Bearer token.' })
  logoutAll(@CurrentUser() user: CurrentUserType) {
    return this.authService.logoutAll(user.userId);
  }

  // POST /auth/forgot-password
  // Public no guard required
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset token',
    description:
      'Generates a one-time password rest token valid for 1 hour. ' +
      'In production this token is deliverd via email. ' +
      'Development mode: the token is returned directly in the response body ' +
      'because email delivery is not yet configured. ' +
      'Teh response is identical whether or not yet configured. ' +
      'this prevents user enumeration attacks.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Token generated (if account exists). ' +
      'Response is the same even if no account was found.',
    type: ForgotPasswordResponseEntity,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error — identifier field is missing or empty.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.identifier);
  }

  // POST /auth/reset-password/:token
  //Public token in URL path acts as the credential
  @Post('reset-password/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using a reset token',
    description:
      'Sets a new password for the account associated with the reset token. ' +
      'The token is obtained from POST /auth/forgot-password and is valid for 1 hour. ' +
      'Password requirements: minimum 5 characters, at least one uppercase letter, ' +
      'one lowercase letter, two digits, and one special character (@$!%*?&). ' +
      'The token is invalidated after a successful reset.',
  })
  @ApiParam({
    name: 'token',
    type: String,
    description:
      'The password reset token received from POST /auth/forgot-password ' +
      '(UUID format). Tokens expire after 1 hour.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully.',
    type: MessageResponseEntity,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — password does not meet requirements, ' +
      'or password and confirmPassword do not match.',
  })
  @ApiResponse({
    status: 401,
    description:
      'Reset token is invalid or has expired (tokens expire after 1 hour).',
  })
  @ApiBody({ type: ResetPasswordDto })
  resetPassword(@Param('token') token: string, @Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(token, dto);
  }

  // PATCH /auth/profile
  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update current authenticated user name and/or password',
    description:
      'Allows users to update their first name, last name, and optionally reset/change their password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully.',
  })
  updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.userId, dto);
  }
}
