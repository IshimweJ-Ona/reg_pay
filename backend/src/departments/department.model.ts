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
}

export function serializeDepartment(
    department: Record<string, any>,
): SerializedDepartment {
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
        working_location: department.working_location
            ? {
                ...department.working_location,
                id: department.working_location.id.toString(),
            }
        : undefined,
    };
}