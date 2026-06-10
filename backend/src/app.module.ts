import { Module } from '@nestjs/common';
import { ModelController } from './model/model.controller';
import { ModelService } from './model/model.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [ModelController],
  providers: [ModelService],
})
export class AppModule {}
