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

  async notifyBranchManager(locationId: bigint, dto: Omit<CreateNotificationDto, 'userId'>) {
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

  async findAll(userId?: string) {
    const where: any = {};
    if (userId) {
      // Show user-specific notifications OR global admin notifications if user is admin
      const user = await this.prisma.users.findUnique({
        where: { uuid: userId },
        include: { roles: { include: { role: true } } },
      });
      
      const roles = user?.roles.map(r => r.role.name) || [];
      const isAdmin = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');

      if (isAdmin) {
        where.OR = [
          { user_id: user?.id },
          { user_id: null }
        ];
      } else {
        where.user_id = user?.id;
      }
    }

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

    return notifications.map((n) => ({
      ...n,
      id: n.id.toString(),
      user_id: n.user_id?.toString(),
      sender_id: n.sender_id?.toString(),
    }));
  }

  async findUnreadCount() {
    return this.prisma.notifications.count({
      where: { is_read: false },
    });
  }

  async markAsRead(uuid: string) {
    await this.prisma.notifications.update({
      where: { uuid },
      data: { is_read: true },
    });
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead() {
    await this.prisma.notifications.updateMany({
      where: { is_read: false },
      data: { is_read: true },
    });
    return { message: 'All notifications marked as read' };
  }
}
