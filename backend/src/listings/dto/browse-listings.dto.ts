import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STATES, TYPES } from './spec-options';

/** Sort modes the marketplace exposes. `bestDeal` surfaces the most
 *  underpriced cars first (lowest dealDeltaPct), nulls last. */
export const SORTS = ['newest', 'priceAsc', 'priceDesc', 'bestDeal'] as const;
export type Sort = (typeof SORTS)[number];

/**
 * Query for GET /listings. Every param is optional. Numerics arrive as strings
 * on the query string, so `@Type(() => Number)` coerces them before validation
 * (the global ValidationPipe does not have implicit conversion enabled).
 */
export class BrowseListingsDto {
  // Free-text keyword — matched case-insensitively against manufacturer + model
  // so a buyer can find "tacoma" or "f-150" without knowing the exact make.
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsString()
  make?: string; // filters `manufacturer`

  @IsOptional()
  @IsIn(TYPES)
  type?: string;

  @IsOptional()
  @IsIn(STATES)
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  minYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  maxYear?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMiles?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMiles?: number;

  @IsOptional()
  @IsIn(SORTS)
  sort?: Sort = 'newest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
