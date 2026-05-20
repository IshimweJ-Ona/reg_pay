import { Controller, Get, Patch, Param, UseGuards, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserType } from 'src/auth/types/current-user.type';
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.findAll(user.uuid);
  }

  @Get('unread-count')
  @Roles('ADMIN', 'SUPER_ADMIN')
  findUnreadCount() {
    return this.notificationsService.findUnreadCount();
  }

  @Patch(':uuid/read')
  @Roles('ADMIN', 'SUPER_ADMIN')
  markAsRead(@Param('uuid') uuid: string) {
    return this.notificationsService.markAsRead(uuid);
  }

  @Patch('read-all')
  @Roles('ADMIN', 'SUPER_ADMIN')
  markAllAsRead() {
    return this.notificationsService.markAllAsRead();
  }
}
