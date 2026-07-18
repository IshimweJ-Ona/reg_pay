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
        users: {
          select: {
            id: true,
            uuid: true,
            first_name: true,
            last_name: true,
            email: true,
            working_locations_users_working_location_idToworking_locations: { select: { id: true, name: true } },
            departments: { select: { id: true, name: true } },
            user_roles: {
              include: {
                roles: { select: { name: true } },
              },
            },
          },
        },
        employees: {
          select: {
            id: true,
            uuid: true,
            first_name: true,
            last_name: true,
            national_id: true,
            working_locations: { select: { id: true, name: true } },
            departments: { select: { id: true, name: true } },
          },
        },
      },
    });

    return logs.map((log) => {
      const userRoles = (log as any).users?.user_roles?.map((ur: any) => ur.roles?.name) ?? [];
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
        user: (log as any).users
          ? {
              ...(log as any).users,
              id: (log as any).users.id.toString(),
              name: `${(log as any).users.first_name} ${(log as any).users.last_name}`.trim(),
              working_location: (log as any).users.working_locations_users_working_location_idToworking_locations
                ? { id: (log as any).users.working_locations_users_working_location_idToworking_locations.id.toString(), name: (log as any).users.working_locations_users_working_location_idToworking_locations.name }
                : null,
              department: (log as any).users.departments
                ? { id: (log as any).users.departments.id.toString(), name: (log as any).users.departments.name }
                : null,
              roles: userRoles,
            }
          : null,
        employee: (log as any).employees
          ? {
              ...(log as any).employees,
              id: (log as any).employees.id.toString(),
              name: `${(log as any).employees.first_name} ${(log as any).employees.last_name}`.trim(),
              working_location: (log as any).employees.working_locations
                ? { id: (log as any).employees.working_locations.id.toString(), name: (log as any).employees.working_locations.name }
                : null,
              department: (log as any).employees.departments
                ? { id: (log as any).employees.departments.id.toString(), name: (log as any).employees.departments.name }
                : null,
            }
          : null,
      };
    });
  }
}