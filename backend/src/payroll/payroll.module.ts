import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SystemConfigModule } from '../system-config/system-config.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule, SystemConfigModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
