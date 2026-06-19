import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PaymentStructuresModule } from '../payment-structures/payment-structures.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    NotificationsModule,
    PaymentStructuresModule,
  ],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
