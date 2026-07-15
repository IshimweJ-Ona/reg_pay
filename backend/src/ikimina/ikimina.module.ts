import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { IkiminaController } from './ikimina.controller';
import { IkiminaService } from './ikimina.service';

@Module({
    imports: [AuthModule, PrismaModule, NotificationsModule],
    controllers: [IkiminaController],
    providers: [IkiminaService],
    exports: [IkiminaService],
})
export class IkiminaModule {}