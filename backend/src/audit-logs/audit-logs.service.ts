import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findLatest(limitInput?: string) {
    const parsedLimit = Number(limitInput ?? 100);
    const take = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 200)
      : 100;

    const logs = await this.prisma.audit_logs.findMany({
      take,
      orderBy: { created_at: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            uuid: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        employee: {
          select: {
            id: true,
            uuid: true,
            first_name: true,
            last_name: true,
            national_id: true,
          },
        },
      },
    });

    return logs.map((log) => ({
      id: log.id.toString(),
      user_id: log.user_id.toString(),
      employee_id: log.employee_id?.toString() ?? null,
      entity_table: log.entity_table,
      entity_id: log.entity_id.toString(),
      module_name: log.module_name,
      activity_type: log.activity_type,
      activity_description: log.activity_description,
      action: log.action,
      old_values: log.old_values,
      new_values: log.new_values,
      changed_fields: log.changed_fields,
      ip_address: log.ip_address,
      created_at: log.created_at,
      user: {
        ...log.user,
        id: log.user.id.toString(),
        name: `${log.user.first_name} ${log.user.last_name}`.trim(),
      },
      employee: log.employee
        ? {
            ...log.employee,
            id: log.employee.id.toString(),
            name: `${log.employee.first_name} ${log.employee.last_name}`.trim(),
          }
        : null,
    }));
  }
}
