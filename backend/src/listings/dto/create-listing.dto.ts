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
 * Body for POST /listings. Carries the 13 spec fields plus the marketplace
 * fields. Derived fields (predictedValue/low/high, dealDeltaPct) are NEVER
 * accepted from the client — the ValidationPipe `whitelist` strips anything
 * not declared here, and the service overwrites them regardless.
 */
export class CreateListingDto {
  // ── Spec fields ──
  @IsString()
  @Length(1, 60)
  manufacturer: string;

  @IsString()
  @Length(1, 60)
  model: string;

  @IsInt()
  @Min(YEAR_MIN)
  @Max(YEAR_MAX)
  year: number;

  @IsInt()
  @Min(0)
  @Max(1_000_000)
  odometer: number;

  @IsOptional()
  @IsIn(CYLINDERS)
  cylinders?: number;

  @IsIn(CONDITIONS)
  condition: string;

  @IsIn(FUELS)
  fuel: string;

  @IsIn(TITLE_STATUSES)
  titleStatus: string;

  @IsIn(TRANSMISSIONS)
  transmission: string;

  @IsIn(DRIVES)
  drive: string;

  @IsIn(TYPES)
  type: string;

  @IsIn(PAINT_COLORS)
  paintColor: string;

  @IsIn(STATES)
  state: string;

  // ── Marketplace fields ──
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  askingPrice: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEmail()
  contactEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  // A listing can be saved as a draft or published live on creation. It cannot
  // be created as `sold`. Publishing live additionally requires a verified
  // email — enforced in the service, not here.
  @IsOptional()
  @IsIn([ListingStatus.draft, ListingStatus.active])
  status?: ListingStatus;
}
