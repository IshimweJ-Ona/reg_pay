import { Injectable } from '@nestjs/common';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNotificationDto) {
    const userId = dto.userId ? BigInt(dto.userId.toString()) : null;
    const senderId = dto.senderId ? BigInt(dto.senderId.toString()) : null;

    return this.prisma.notifications.create({
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
    });
  }

  async notifyAdmins(dto: Omit<CreateNotificationDto, 'userId'>) {
    // In a real app, you might want to find all admins and create multiple records,
    // or just leave user_id as null to mean "for all admins".
    // Let's use null for "Global/Admin" notifications.
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
      // Fallback to admin if no manager
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
      const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');

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

    return Promise.all(
      notifications.map(async (n) => {
        const referenceUser =
          n.type === 'REGISTRATION_REQUEST' && n.reference_id
            ? await this.prisma.users.findUnique({
                where: { uuid: n.reference_id },
                select: {
                  uuid: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                  phone_number: true,
                  working_location: { select: { name: true } },
                  department: { select: { name: true } },
                },
              })
            : null;

        return {
          ...n,
          id: n.id.toString(),
          user_id: n.user_id?.toString(),
          sender_id: n.sender_id?.toString(),
          user: referenceUser ?? n.user,
        };
      }),
    );
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
