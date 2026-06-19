import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  Sse,
  Req,
  UsePipes,
  ValidationPipe,
  Query,
} from '@nestjs/common';
import { StreamQueryDto } from './dto/stream-query.dto';
import { Observable, Subject, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';
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
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  stream(@Req() req): Observable<MessageEvent> {
    const userId = req.user.uuid;
    const subject = this.notificationsService.addClient(userId);

    req.on('close', () =>
      this.notificationsService.removeClient(userId, subject),
    );

    const heartbeat$ = interval(30000).pipe(
      map(
        () => ({ data: JSON.stringify({ type: 'heartbeat' }) }) as MessageEvent,
      ),
    );

    return merge(subject.asObservable(), heartbeat$);
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
