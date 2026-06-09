import { Module } from '@nestjs/common';
import { ModelController } from './model/model.controller';
import { ModelService } from './model/model.service';

@Module({
  imports: [],
  controllers: [ModelController],
  providers: [ModelService],
})
export class AppModule {}
