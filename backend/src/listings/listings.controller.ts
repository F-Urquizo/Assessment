import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, JwtAuthGuard, Public } from '../auth/guards';
import type { RequestUser } from '../auth/guards';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { BrowseListingsDto } from './dto/browse-listings.dto';
import { ListingsService } from './listings.service';
import { SearchHistoryService } from './search-history.service';

/**
 * Marketplace listing routes. Browsing is public; every mutation requires a
 * valid access token (JwtAuthGuard). Ownership and verified-to-publish rules
 * live in the service so they apply no matter who calls it (incl. Fran's
 * recommendation flow, which uses the service directly).
 */
@Controller('listings')
@UseGuards(JwtAuthGuard)
export class ListingsController {
  constructor(
    private readonly listings: ListingsService,
    private readonly searchHistory: SearchHistoryService,
  ) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateListingDto) {
    return this.listings.create(user, dto);
  }

  @Public()
  @Get()
  findAll(
    @Query() query: BrowseListingsDto,
    @Req() req: Request & { user?: RequestUser },
  ) {
    if (req.user) {
      void this.searchHistory.record(req.user.id, query).catch(() => undefined);
    }
    return this.listings.browse(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.listings.findOne(id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.listings.remove(user, id);
  }
}
