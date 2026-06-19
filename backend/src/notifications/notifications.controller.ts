import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  Sse,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserType } from 'src/auth/types/current-user.type';
import { StreamQueryDto } from './dto/stream-query.dto';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = Request & {
  user: CurrentUserType;
};

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Sse('stream')
  @UseGuards(JwtAuthGuard)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  stream(
    @Query() _query: StreamQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Observable<MessageEvent> {
    const userId = req.user.userId;
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
