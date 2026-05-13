import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TimeRecordsController } from './time-records.controller';
import { TimeRecordsService } from './time-records.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TimeRecordsController],
  providers: [TimeRecordsService],
  exports: [TimeRecordsService],
})
export class TimeRecordsModule {}
