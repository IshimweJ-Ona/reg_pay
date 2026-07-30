import { Injectable, NotFoundException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { generateUUID } from '../common/utils/uuid.util';

export interface CreateNotificationDto {
  userId?: string | bigint;
  senderId?: string | bigint;
  title: string;
  message: string;
  type: string;
  referenceId?: string;
  metadata?: any;
  /**
   * When `userId` is not set, the live SSE push normally goes to every
   * connected client (see `broadcast()`). Pass specific user ids here to
   * scope the live push to exactly those users instead - the stored
   * notification row is still saved with `user_id: null` so it continues to
   * show up for anyone whose role/department matches it on next fetch.
   */
  pushToUserIds?: Array<string | bigint>;
}

@Injectable()
export class NotificationsService {
  private clients = new Map<string, Set<Subject<MessageEvent>>>();

  constructor(private readonly prisma: PrismaService) {}

  addClient(userId: string): Subject<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    let userClients = this.clients.get(userId);
    if (!userClients) {
      userClients = new Set();
      this.clients.set(userId, userClients);
    }

    userClients.add(subject);
    return subject;
  }

  removeClient(userId: string, subject: Subject<MessageEvent>) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.delete(subject);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  private pushToUser(userId: string, payload: object) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach((subject) => {
        subject.next({ data: JSON.stringify(payload) } as MessageEvent);
      });
    }
  }

  broadcast(payload: object) {
    this.clients.forEach((userClients) => {
      userClients.forEach((subject) => {
        subject.next({ data: JSON.stringify(payload) } as MessageEvent);
      });
    });
  }

  notifyUsers(userIds: Array<string | bigint>, payload: object) {
    for (const userId of userIds) {
      this.pushToUser(userId.toString(), payload);
    }
  }

  async create(dto: CreateNotificationDto) {
    const userId = dto.userId ? BigInt(dto.userId.toString()) : null;
    const senderId = dto.senderId ? BigInt(dto.senderId.toString()) : null;

    const notification = await this.prisma.notifications.create({
      data: {
        uuid: generateUUID(),
        user_id: userId,
        sender_id: senderId,
        title: dto.title,
        message: dto.message,
        type: dto.type,
        reference_id: dto.referenceId,
        metadata: dto.metadata,
        updated_at: new Date(),
      },
      include: {
        users_notifications_sender_idTousers: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        users_notifications_user_idTousers: {
          select: {
            uuid: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            working_locations_users_working_location_idToworking_locations: {
              select: { name: true },
            },
            departments: { select: { name: true } },
          },
        },
      },
    });

    let referenceUser: any = null;
    if (dto.type === 'REGISTRATION_REQUEST' && dto.referenceId) {
      referenceUser = await this.prisma.users.findUnique({
        where: { uuid: dto.referenceId },
        select: {
          uuid: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
          working_locations_users_working_location_idToworking_locations: {
            select: { name: true },
          },
          departments: { select: { name: true } },
        },
      });
    }

    const serialized = {
      ...notification,
      id: notification.id.toString(),
      user_id: notification.user_id?.toString(),
      sender_id: notification.sender_id?.toString(),
      user:
        referenceUser ??
        (notification as any).users_notifications_user_idTousers,
    };

    if (dto.userId) {
      this.pushToUser(dto.userId.toString(), serialized);
    } else if (dto.pushToUserIds?.length) {
      for (const userId of dto.pushToUserIds) {
        this.pushToUser(userId.toString(), serialized);
      }
    } else {
      this.broadcast(serialized);
    }

    return notification;
  }

  /**
   * Notifies SUPER_ADMIN users only. Previously this broadcast the live SSE
   * event to *every* connected client (the stored row was admin-scoped, but
   * the live push wasn't) - meaning attendants, accountants, etc. briefly
   * received payroll/approval/admin-only notification payloads over SSE even
   * though they'd never see them on a normal fetch. Now the live push only
   * reaches users who actually hold the SUPER_ADMIN role.
   */
  async notifyAdmins(dto: Omit<CreateNotificationDto, 'userId'>) {
    const superAdmins = await this.prisma.user_roles.findMany({
      where: { roles: { name: 'SUPER_ADMIN' } },
      select: { user_id: true },
    });

    return this.create({
      ...dto,
      userId: undefined,
      pushToUserIds: superAdmins.map((r) => r.user_id),
    });
  }

  async notifyBranchManager(
    locationId: bigint,
    dto: Omit<CreateNotificationDto, 'userId'>,
  ) {
    const manager = await this.prisma.branch_managers.findFirst({
      where: { working_location_id: locationId, is_active: true },
      select: { user_id: true },
    });

    if (manager) {
      return this.create({ ...dto, userId: manager.user_id });
    } else {
      return this.notifyAdmins(dto);
    }
  }

  /**
   * Routes a "final approval needed" notice through the same hierarchy the
   * payroll final-approval permission check enforces: HR at the batch's own
   * working location first, then HR at headquarters, and only then
   * SUPER_ADMIN. Keeps notifications aligned with who is actually allowed to
   * act, instead of always pinging every super admin.
   */
  /**
   * Final payroll approval always belongs to HR at headquarters, regardless
   * of which branch the batch belongs to - falls back to admins if HQ has
   * no active HR. Mirrors PayrollService.resolveFinalApprovalAuthority().
   */
  async notifyFinalApprovers(dto: Omit<CreateNotificationDto, 'userId'>) {
    const hq = await this.prisma.working_locations.findFirst({
      where: { type: 'HQ' as any, deleted_at: null },
      select: { id: true },
    });

    if (hq) {
      const hqHr = await this.prisma.user_roles.findMany({
        where: {
          roles: { name: 'HR' },
          users: { working_location_id: hq.id, status: 'ACTIVE' },
        },
        select: { user_id: true },
      });

      if (hqHr.length > 0) {
        return this.create({
          ...dto,
          userId: undefined,
          pushToUserIds: hqHr.map((r) => r.user_id),
        });
      }
    }

    return this.notifyAdmins(dto);
  }

  private async getNotificationWhere(userId?: string) {
    const where: any = {};
    let resolvedUserId: bigint | undefined;
    if (userId) {
      const user = await this.prisma.users.findUnique({
        where: { uuid: userId },
        include: { user_roles: { include: { roles: true } } },
      });

      resolvedUserId = user?.id;
      const roles = user?.user_roles.map((r) => r.roles.name) || [];
      const isAdmin = roles.includes('SUPER_ADMIN');

      const orConditions: any[] = [{ user_id: user?.id }];

      if (isAdmin) {
        orConditions.push({ user_id: null });
      }

      if (roles.length > 0) {
        orConditions.push({ target_role: { in: roles } });
      }

      if (user?.department_id) {
        orConditions.push({ target_department_id: user.department_id });
      }

      where.OR = orConditions;
    }
    return { where, resolvedUserId };
  }

  // Notification rows can be shared across many recipients (broadcasts,
  // target_role, target_department_id), so "clearing" one is recorded as a
  // per-user dismissal instead of a flag on the row - otherwise clearing it
  // would hide it for every other recipient too, and it excludes the
  // underlying row from ever being deleted.
  private async getDismissedNotificationIds(userId?: bigint) {
    if (!userId) return [];
    const dismissals = await this.prisma.notification_dismissals.findMany({
      where: { user_id: userId },
      select: { notification_id: true },
    });
    return dismissals.map((d) => d.notification_id);
  }

  async findAll(userId?: string) {
    const { where, resolvedUserId } = await this.getNotificationWhere(userId);
    const dismissedIds = await this.getDismissedNotificationIds(resolvedUserId);
    if (dismissedIds.length) {
      where.id = { notIn: dismissedIds };
    }

    const notifications = await this.prisma.notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        users_notifications_sender_idTousers: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        users_notifications_user_idTousers: {
          select: {
            uuid: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            working_locations_users_working_location_idToworking_locations: {
              select: { name: true },
            },
            departments: { select: { name: true } },
          },
        },
      },
    });

    const registrationUuids = notifications
      .filter((n) => n.type === 'REGISTRATION_REQUEST' && n.reference_id)
      .map((n) => n.reference_id as string);

    let referenceUsers: any[] = [];
    if (registrationUuids.length > 0) {
      referenceUsers = await this.prisma.users.findMany({
        where: { uuid: { in: registrationUuids } },
        select: {
          uuid: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
          working_locations_users_working_location_idToworking_locations: {
            select: { name: true },
          },
          departments: { select: { name: true } },
        },
      });
    }

    const userMap = new Map<string, any>(
      referenceUsers.map((u) => [u.uuid, u]),
    );

    return notifications.map((n) => {
      const referenceUser =
        n.type === 'REGISTRATION_REQUEST' && n.reference_id
          ? (userMap.get(n.reference_id) ?? null)
          : null;

      return {
        ...n,
        id: n.id.toString(),
        user_id: n.user_id?.toString(),
        sender_id: n.sender_id?.toString(),
        user: referenceUser ?? (n as any).users_notifications_user_idTousers,
      };
    });
  }

  async findUnreadCount(userUuid?: string) {
    const { where: baseWhere, resolvedUserId } =
      await this.getNotificationWhere(userUuid);
    const dismissedIds = await this.getDismissedNotificationIds(resolvedUserId);
    const where = {
      ...baseWhere,
      is_read: false,
      ...(dismissedIds.length ? { id: { notIn: dismissedIds } } : {}),
    };

    return this.prisma.notifications.count({
      where,
    });
  }

  async markAsRead(uuid: string, userUuid?: string) {
    const { where: baseWhere } = await this.getNotificationWhere(userUuid);
    const where = { ...baseWhere, uuid };

    await this.prisma.notifications.updateMany({
      where,
      data: { is_read: true },
    });
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userUuid?: string) {
    const { where: baseWhere } = await this.getNotificationWhere(userUuid);
    const where = { ...baseWhere, is_read: false };

    await this.prisma.notifications.updateMany({
      where,
      data: { is_read: true },
    });
    return { message: 'All notifications marked as read' };
  }

  // Removes the notification from this user's history without touching the
  // row - other recipients of the same broadcast/role/department-targeted
  // notification keep seeing it, and it stays in the database for audit
  // purposes.
  async clear(uuid: string, userUuid: string) {
    const { where: baseWhere, resolvedUserId } =
      await this.getNotificationWhere(userUuid);
    if (!resolvedUserId) {
      throw new NotFoundException('User not found.');
    }

    const notification = await this.prisma.notifications.findFirst({
      where: { ...baseWhere, uuid },
      select: { id: true },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    await this.prisma.notification_dismissals.upsert({
      where: {
        notification_id_user_id: {
          notification_id: notification.id,
          user_id: resolvedUserId,
        },
      },
      create: { notification_id: notification.id, user_id: resolvedUserId },
      update: {},
    });

    return { message: 'Notification cleared' };
  }

  async clearAll(userUuid: string) {
    const { where, resolvedUserId } = await this.getNotificationWhere(userUuid);
    if (!resolvedUserId) {
      throw new NotFoundException('User not found.');
    }

    const dismissedIds = await this.getDismissedNotificationIds(resolvedUserId);
    const visible = await this.prisma.notifications.findMany({
      where: dismissedIds.length
        ? { ...where, id: { notIn: dismissedIds } }
        : where,
      select: { id: true },
    });

    if (visible.length) {
      await this.prisma.notification_dismissals.createMany({
        data: visible.map((n) => ({
          notification_id: n.id,
          user_id: resolvedUserId,
        })),
        skipDuplicates: true,
      });
    }

    return { message: 'Notification history cleared' };
  }
}
