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
            working_location: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            roles: {
              include: {
                role: { select: { name: true } },
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            uuid: true,
            first_name: true,
            last_name: true,
            national_id: true,
            working_location: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    return logs.map((log) => {
      const userRoles = log.user.roles?.map((ur) => ur.role.name) ?? [];
      return {
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
          working_location: log.user.working_location
            ? { id: log.user.working_location.id.toString(), name: log.user.working_location.name }
            : null,
          department: log.user.department
            ? { id: log.user.department.id.toString(), name: log.user.department.name }
            : null,
          roles: userRoles,
        },
        employee: log.employee
          ? {
              ...log.employee,
              id: log.employee.id.toString(),
              name: `${log.employee.first_name} ${log.employee.last_name}`.trim(),
              working_location: log.employee.working_location
                ? { id: log.employee.working_location.id.toString(), name: log.employee.working_location.name }
                : null,
              department: log.employee.department
                ? { id: log.employee.department.id.toString(), name: log.employee.department.name }
                : null,
            }
          : null,
      };
    });
  }
}