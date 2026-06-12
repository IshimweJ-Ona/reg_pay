import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Sse,
  Req,
} from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserType } from 'src/auth/types/current-user.type';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse('stream')
  stream(@Req() req): Observable<MessageEvent> {
    const userId = req.user.uuid;
    const subject = this.notificationsService.addClient(userId);

    req.on('close', () => this.notificationsService.removeClient(userId));

    return subject.asObservable();
  }

  @Get()
  findAll(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.findAll(user.uuid);
  }

  @Get('unread-count')
  findUnreadCount(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.findUnreadCount(user.uuid);
  }

  @Patch(':uuid/read')
  markAsRead(
    @Param('uuid') uuid: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.notificationsService.markAsRead(uuid, user.uuid);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.markAllAsRead(user.uuid);
  }
}
