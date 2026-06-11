import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/guards';
import type { RequestUser } from '../auth/guards';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Post(':listingId')
  @HttpCode(HttpStatus.CREATED)
  add(@CurrentUser() user: RequestUser, @Param('listingId') listingId: string) {
    return this.favorites.add(user.id, listingId);
  }

  @Delete(':listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('listingId') listingId: string,
  ) {
    return this.favorites.remove(user.id, listingId);
  }

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.favorites.list(user.id);
  }
}
