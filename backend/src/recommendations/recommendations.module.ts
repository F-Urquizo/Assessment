import { Module } from '@nestjs/common';
import { FavoritesModule } from '../favorites/favorites.module';
import { ListingsModule } from '../listings/listings.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [ListingsModule, FavoritesModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
