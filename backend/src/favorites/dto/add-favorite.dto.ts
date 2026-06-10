import { IsString, Length } from 'class-validator';

/** Body for POST /favorites. */
export class AddFavoriteDto {
  @IsString()
  @Length(1, 60)
  listingId: string;
}
