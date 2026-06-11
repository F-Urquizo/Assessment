import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CurrentUser } from '../auth/guards';
import type { RequestUser } from '../auth/guards';
import { RecommendationsService } from './recommendations.service';

class RecommendationsQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  @Get()
  recommend(
    @CurrentUser() user: RequestUser,
    @Query() query: RecommendationsQuery,
  ) {
    return this.recommendations.recommend(user.id, query.limit ?? 10);
  }
}
