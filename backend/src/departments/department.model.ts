import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DepartmentsController } from './department.controller';
import { DepartmentsService } from './department.service';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [DepartmentsController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}

export interface SerializedDepartment {
  id: string;
  uuid: string;
  working_location_id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  working_location?: Record<string, any>;
  user_count: number;
  employee_count: number;
  pending_deactivation: {
    uuid: string;
    requested_employee_count: number;
    remaining_employee_count: number;
    requested_at: Date;
  } | null;
}

export function serializeDepartment(
  department: Record<string, any>,
): SerializedDepartment {
  // Prisma names the singular relation on `departments` after the related
  // table (`working_locations`), not `working_location`. Reading the wrong
  // key here silently dropped the branch name/subtitle everywhere this
  // serializer is used. Same story for `_count`: it was never read at all,
  // so every "Personnel" / users-in-department total rendered as 0.
  const workingLocation =
    department.working_locations ?? department.working_location;
  const counts = department._count ?? {};
  const pendingRequest = Array.isArray(
    department.department_deactivation_requests,
  )
    ? department.department_deactivation_requests[0]
    : (department.pending_deactivation ?? null);

  return {
    id: department.id.toString(),
    uuid: department.uuid,
    working_location_id: department.working_location_id.toString(),
    code: department.code,
    name: department.name,
    description: department.description ?? null,
    status: department.status,
    created_at: department.created_at,
    updated_at: department.updated_at,
    working_location: workingLocation
      ? {
          ...workingLocation,
          id: workingLocation.id.toString(),
        }
      : undefined,
    user_count: counts.users ?? 0,
    employee_count: counts.employees ?? 0,
    pending_deactivation: pendingRequest
      ? {
          uuid: pendingRequest.uuid,
          requested_employee_count:
            pendingRequest.requested_employee_count ?? 0,
          remaining_employee_count:
            pendingRequest.remaining_employee_count ?? 0,
          requested_at: pendingRequest.created_at,
        }
      : null,
  };
}
