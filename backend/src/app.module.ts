import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { OrganizationModule } from './organization/organization.module';
import { EmployeesModule } from './employees/employees.module';
import { TimeRecordsModule } from './time-records/time-records.module';
import { PaymentStructuresModule } from './payment-structures/payment-structures.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,

    AuthModule,

    UsersModule,

    OrganizationModule,

    EmployeesModule,

    TimeRecordsModule,

    PaymentStructuresModule,

    PayrollModule,

    RolesModule,

    PermissionsModule,
  ],

  controllers: [AppController],

  providers: [AppService],
})
export class AppModule {}
