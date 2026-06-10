import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/guards';
import { RecommendationsService } from './recommendations.service';

/**
 * GET /recommendations — public for now (the marketplace rail shows picks to
 * everyone). `excludeUserId` lets the client drop the viewer's own listings
 * once auth is wired; until then it's optional.
 */
@ApiTags('recommendations')
@Public()
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get()
  getRecommendations(
    @Query('limit') limit?: string,
    @Query('excludeUserId') excludeUserId?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : NaN;
    return this.recommendations.topPicks({
      limit: Number.isFinite(parsed) ? parsed : undefined,
      excludeUserId,
    });
  }
}
