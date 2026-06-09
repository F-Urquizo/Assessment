import { Module } from '@nestjs/common';
import { ModelController } from './model/model.controller';
import { ModelService } from './model/model.service';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModelController],
  providers: [ModelService],
})
export class AppModule {}
