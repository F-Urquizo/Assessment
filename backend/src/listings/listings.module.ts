import { Module } from '@nestjs/common';
import { ModelService } from '../model/model.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

/**
 * Owns marketplace listings. Exports ListingsService so other modules —
 * notably Fran's RecommendationsModule — can read active listings and reuse
 * the deal scoring without duplicating queries. PrismaService comes from the
 * @Global() PrismaModule.
 */
@Module({
  controllers: [ListingsController],
  providers: [ListingsService, ModelService],
  exports: [ListingsService],
})
export class ListingsModule {}
