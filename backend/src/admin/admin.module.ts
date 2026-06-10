import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';

// PrismaModule is @Global — PrismaService is injected without listing it here.
@Module({
  controllers: [AdminController],
})
export class AdminModule {}
