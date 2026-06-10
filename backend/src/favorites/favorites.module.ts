import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

/**
 * Favourites. PrismaService comes from the @Global PrismaModule; deal badge
 * mapping is reused from the listings module's pure helper. (Fran's slice,
 * implemented here so the marketplace's ♥ has a real backend.)
 */
@Module({
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
