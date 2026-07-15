import { Injectable } from '@nestjs/common';
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
      },
      include: {
        sender: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        user: {
          select: {
            uuid: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            working_location: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });

    let referenceUser: {
      uuid: string;
      first_name: string;
      last_name: string;
      email: string;
      phone_number: string;
      working_location: { name: string } | null;
      department: { name: string } | null;
    } | null = null;
    if (dto.type === 'REGISTRATION_REQUEST' && dto.referenceId) {
      referenceUser = await this.prisma.users.findUnique({
        where: { uuid: dto.referenceId },
        select: {
          uuid: true,
          first_name: true,
          last_name: true,
          email: true,
          phone_number: true,
          working_location: { select: { name: true } },
          department: { select: { name: true } },
        },
      });
    }

    const serialized = {
      ...notification,
      id: notification.id.toString(),
      user_id: notification.user_id?.toString(),
      sender_id: notification.sender_id?.toString(),
      user: referenceUser ?? notification.user,
    };

    if (dto.userId) {
      this.pushToUser(dto.userId.toString(), serialized);
    } else {
      this.broadcast(serialized);
    }

    return notification;
  }

  async notifyAdmins(dto: Omit<CreateNotificationDto, 'userId'>) {
    return this.create({ ...dto, userId: undefined });
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

  private async getNotificationWhere(userId?: string) {
    const where: any = {};
    if (userId) {
      const user = await this.prisma.users.findUnique({
        where: { uuid: userId },
        include: { roles: { include: { role: true } } },
      });

      const roles = user?.roles.map((r) => r.role.name) || [];
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
    return where;
  }

  async findAll(userId?: string) {
    const where = await this.getNotificationWhere(userId);

    const notifications = await this.prisma.notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        sender: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
        user: {
          select: {
            uuid: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            working_location: { select: { name: true } },
            department: { select: { name: true } },
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
          working_location: { select: { name: true } },
          department: { select: { name: true } },
        },
      });
    }

    const userMap = new Map<string, any>(
      referenceUsers.map((u) => [u.uuid, u]),
    );

    return notifications.map((n) => {
      const referenceUser =
        n.type === 'REGISTRATION_REQUEST' && n.reference_id
          ? userMap.get(n.reference_id) ?? null
          : null;

      return {
        ...n,
        id: n.id.toString(),
        user_id: n.user_id?.toString(),
        sender_id: n.sender_id?.toString(),
        user: referenceUser ?? n.user,
      };
    });
  }

  async findUnreadCount(userUuid?: string) {
    const baseWhere = await this.getNotificationWhere(userUuid);
    const where = { ...baseWhere, is_read: false };

    return this.prisma.notifications.count({
      where,
    });
  }

  async markAsRead(uuid: string, userUuid?: string) {
    const baseWhere = await this.getNotificationWhere(userUuid);
    const where = { ...baseWhere, uuid };

    await this.prisma.notifications.updateMany({
      where,
      data: { is_read: true },
    });
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userUuid?: string) {
    const baseWhere = await this.getNotificationWhere(userUuid);
    const where = { ...baseWhere, is_read: false };

    await this.prisma.notifications.updateMany({
      where,
      data: { is_read: true },
    });
    return { message: 'All notifications marked as read' };
  }
}