import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IkiminaController } from './ikimina.controller';
import { IkiminaService } from './ikimina.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [IkiminaController],
  providers: [IkiminaService],
  exports: [IkiminaService],
})
export class IkiminaModule {}
