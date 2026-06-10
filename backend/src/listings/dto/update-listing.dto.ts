import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListingStatus } from '@prisma/client';
import {
  CONDITIONS,
  CYLINDERS,
  DRIVES,
  FUELS,
  PAINT_COLORS,
  STATES,
  TITLE_STATUSES,
  TRANSMISSIONS,
  TYPES,
  YEAR_MAX,
  YEAR_MIN,
} from './spec-options';

/**
 * Body for PATCH /listings/:id. Every field is optional — only supplied fields
 * are changed. (Written out explicitly rather than via PartialType to avoid
 * pulling in @nestjs/mapped-types.) Changing any spec field re-triggers
 * valuation; `status: active` requires a verified email.
 */
export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(YEAR_MIN)
  @Max(YEAR_MAX)
  year?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  odometer?: number;

  @IsOptional()
  @IsIn(CYLINDERS)
  cylinders?: number;

  @IsOptional()
  @IsIn(CONDITIONS)
  condition?: string;

  @IsOptional()
  @IsIn(FUELS)
  fuel?: string;

  @IsOptional()
  @IsIn(TITLE_STATUSES)
  titleStatus?: string;

  @IsOptional()
  @IsIn(TRANSMISSIONS)
  transmission?: string;

  @IsOptional()
  @IsIn(DRIVES)
  drive?: string;

  @IsOptional()
  @IsIn(TYPES)
  type?: string;

  @IsOptional()
  @IsIn(PAINT_COLORS)
  paintColor?: string;

  @IsOptional()
  @IsIn(STATES)
  state?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  askingPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  // Update may also mark a listing as sold.
  @IsOptional()
  @IsIn([ListingStatus.draft, ListingStatus.active, ListingStatus.sold])
  status?: ListingStatus;
}
