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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserType } from 'src/auth/types/current-user.type';
import { StreamQueryDto } from './dto/stream-query.dto';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = Request & {
  user: CurrentUserType;
};

@ApiTags('Notifications')
@ApiBearerAuth('jwt')
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
  @ApiOperation({
    summary: 'Live notification stream (Server-Sent Events)',
    description:
      'Opens a long-lived SSE connection that pushes real-time notification events to the caller (scoped to their own user id, or role for broadcast-style events like final-approval requests). Sends a heartbeat every 30 seconds. Note: this is a streaming endpoint, not a typical JSON response — most HTTP clients/Swagger "Try it out" will not render it usefully; connect with an EventSource client instead.',
  })
  @ApiResponse({
    status: 200,
    description: 'text/event-stream of notification and heartbeat events.',
  })
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
  @ApiOperation({
    summary: 'List my notifications',
    description:
      'Returns the notification history for the currently authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'List of notifications.' })
  findAll(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.findAll(user.uuid);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description:
      'Returns the number of unread notifications for the currently authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Unread count.' })
  findUnreadCount(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.findUnreadCount(user.uuid);
  }

  @Patch(':uuid/read')
  @ApiOperation({
    summary: 'Mark one notification as read',
  })
  @ApiParam({ name: 'uuid', description: 'Notification UUID.' })
  @ApiResponse({ status: 200, description: 'Notification marked read.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  markAsRead(
    @Param('uuid') uuid: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.notificationsService.markAsRead(uuid, user.uuid);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all my notifications as read',
  })
  @ApiResponse({ status: 200, description: 'All notifications marked read.' })
  markAllAsRead(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.markAllAsRead(user.uuid);
  }

  @Patch(':uuid/clear')
  @ApiOperation({
    summary: 'Clear one notification from my history',
    description:
      "Removes the notification from the caller's own notification list. The underlying row is not deleted, and other recipients of the same broadcast/role/department-targeted notification are unaffected.",
  })
  @ApiParam({ name: 'uuid', description: 'Notification UUID.' })
  @ApiResponse({ status: 200, description: 'Notification cleared.' })
  @ApiResponse({ status: 404, description: 'Notification not found.' })
  clear(@Param('uuid') uuid: string, @CurrentUser() user: CurrentUserType) {
    return this.notificationsService.clear(uuid, user.uuid);
  }

  @Patch('clear-all')
  @ApiOperation({
    summary: 'Clear all of my notification history',
    description:
      "Removes every currently visible notification from the caller's own list without deleting any rows from the database.",
  })
  @ApiResponse({ status: 200, description: 'Notification history cleared.' })
  clearAll(@CurrentUser() user: CurrentUserType) {
    return this.notificationsService.clearAll(user.uuid);
  }
}
