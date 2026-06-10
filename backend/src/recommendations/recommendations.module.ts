import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

/**
 * Recommendations. Imports ListingsModule to reuse the exported ListingsService
 * (active listings + deal scoring) instead of re-querying. Cold-start today
 * (deal-only); favourites/search-history preference signals slot in later.
 */
@Module({
  imports: [ListingsModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
