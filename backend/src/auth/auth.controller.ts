import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { CurrentUserType } from './types/current-user.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: CurrentUserType) {
    return this.authService.me(user.userId);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, {
      deviceInfo: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto, @Req() request: Request) {
    return this.authService.refresh(dto.refresh_token, {
      deviceInfo: request.headers['user-agent'],
      ipAddress: request.ip,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: CurrentUserType, @Body() dto: RefreshTokenDto) {
    return this.authService.logout(user.userId, dto.refresh_token);
  }

  @Post('logout-all')
  logoutAll(@CurrentUser() user: CurrentUserType) {
    return this.authService.logoutAll(user.userId);
  }

  @Post('forgot-password')
  forgotPassword(@Body('identifier') identifier: string) {
    return this.authService.forgotPassword(identifier);
  }

  @Post('reset-password/:token')
  resetPassword(@Param('token') token: string, @Body() dto: any) {
    return this.authService.resetPassword(token, dto);
  }
}
