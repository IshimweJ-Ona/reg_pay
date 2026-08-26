import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { OrganizationModule } from './organization/organization.module';
import { DepartmentsModule } from './departments/department.model';
import { EmployeesModule } from './employees/employees.module';
import { TimeRecordsModule } from './time-records/time-records.module';
import { PaymentStructuresModule } from './payment-structures/payment-structures.module';
import { PositionsModule } from './positions/position.model';
import { PayrollModule } from './payroll/payroll.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { IkiminaModule } from './ikimina/ikimina.module';
import { DashboardAnalyticsModule } from './dashboard/dashboard-analytics.module';

import { SecurityMiddleware } from './common/security/security.middleware';
import { WorkingLocationScopeInterceptor } from './common/interceptors/working-location-scope.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ScheduleModule.forRoot(),

    CacheModule.register({
      isGlobal: true,
      ttl: 60000,
      max: 100,
    }),

    PrismaModule,

    AuthModule,

    UsersModule,

    OrganizationModule,

    DepartmentsModule,

    EmployeesModule,

    TimeRecordsModule,

    PaymentStructuresModule,

    PositionsModule,

    PayrollModule,

    RolesModule,

    PermissionsModule,

    NotificationsModule,

    SystemConfigModule,

    AuditLogsModule,
    IkiminaModule,
    DashboardAnalyticsModule,
  ],

  controllers: [AppController],

  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: WorkingLocationScopeInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
