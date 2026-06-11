import { Module } from '@nestjs/common';
import { ModelService } from '../model/model.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { SearchHistoryService } from './search-history.service';

/**
 * Owns marketplace listings. Exports ListingsService and SearchHistoryService
 * so RecommendationsModule can read active listings and search signals without
 * duplicating queries. PrismaService comes from the @Global() PrismaModule.
 */
@Module({
  controllers: [ListingsController],
  providers: [ListingsService, ModelService, SearchHistoryService],
  exports: [ListingsService, SearchHistoryService],
})
export class ListingsModule {}
