import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TimeRecordsController } from './time-records.controller';
import { TimeRecordsService } from './time-records.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, PrismaModule, NotificationsModule],
  controllers: [TimeRecordsController],
  providers: [TimeRecordsService],
  exports: [TimeRecordsService],
})
export class TimeRecordsModule {}
