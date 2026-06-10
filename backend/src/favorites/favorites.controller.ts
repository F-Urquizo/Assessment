import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/guards';
import type { RequestUser } from '../auth/guards';
import { AddFavoriteDto } from './dto/add-favorite.dto';
import { FavoritesService } from './favorites.service';

/**
 * Per-user favourites. Every route requires a valid access token (the global
 * JwtAuthGuard applies — these are not @Public) and acts on the current user.
 */
@ApiTags('favorites')
@ApiBearerAuth('access-token')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.favorites.list(user.id);
  }

  @Get('ids')
  ids(@CurrentUser() user: RequestUser) {
    return this.favorites.ids(user.id);
  }

  @Post()
  add(@CurrentUser() user: RequestUser, @Body() dto: AddFavoriteDto) {
    return this.favorites.add(user.id, dto.listingId);
  }

  @Delete(':listingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('listingId') listingId: string,
  ) {
    return this.favorites.remove(user.id, listingId);
  }
}
