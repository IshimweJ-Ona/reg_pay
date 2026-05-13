import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentStructuresController } from './payment-structures.controller';
import { PaymentStructuresService } from './payment-structures.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PaymentStructuresController],
  providers: [PaymentStructuresService],
  exports: [PaymentStructuresService],
})
export class PaymentStructuresModule {}
