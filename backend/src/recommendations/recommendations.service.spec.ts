import { Test } from '@nestjs/testing';
import { ListingStatus, Role } from '@prisma/client';
import { RecommendationsService } from './recommendations.service';
import { ListingsService } from '../listings/listings.service';
import { FavoritesService } from '../favorites/favorites.service';
import { SearchHistoryService } from '../listings/search-history.service';
import { PrismaService } from '../prisma/prisma.service';

// Fixtures

const userId = 'user_1';

function makeListing(
  overrides: Partial<{
    id: string;
    manufacturer: string;
    type: string;
    fuel: string;
    drive: string;
    askingPrice: number;
    dealDeltaPct: number | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'listing_1',
    manufacturer: overrides.manufacturer ?? 'toyota',
    model: 'camry',
    year: 2018,
    odometer: 40000,
    cylinders: 4,
    condition: 'good',
    fuel: overrides.fuel ?? 'gas',
    titleStatus: 'clean',
    transmission: 'automatic',
    drive: overrides.drive ?? 'fwd',
    type: overrides.type ?? 'sedan',
    paintColor: 'white',
    state: 'ca',
    askingPrice: overrides.askingPrice ?? 18000,
    description: null,
    contactEmail: 'seller@example.com',
    contactPhone: null,
    status: ListingStatus.active,
    predictedValue: 20000,
    predictedLow: 17000,
    predictedHigh: 23000,
    dealDeltaPct: overrides.dealDeltaPct !== undefined ? overrides.dealDeltaPct : -10,
    userId: 'owner_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    dealBadge: 'under' as const,
  };
}

// Mocks

const prismaMock = {
  favorite: { findMany: jest.fn() },
};
const listingsMock = { findActive: jest.fn() };
const favoritesMock = { listingIds: jest.fn() };
const searchHistoryMock = { recent: jest.fn() };

// Tests

describe('RecommendationsService', () => {
  let service: RecommendationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RecommendationsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ListingsService, useValue: listingsMock },
        { provide: FavoritesService, useValue: favoritesMock },
        { provide: SearchHistoryService, useValue: searchHistoryMock },
      ],
    }).compile();
    service = module.get(RecommendationsService);
  });

  // Cold-start

  describe('cold-start (no favorites, no search history)', () => {
    beforeEach(() => {
      prismaMock.favorite.findMany.mockResolvedValue([]);
      searchHistoryMock.recent.mockResolvedValue([]);
    });

    it('sorts by deal score only (most underpriced first)', async () => {
      const listings = [
        makeListing({ id: 'l1', dealDeltaPct: 0 }),   // at market → deal 0.5
        makeListing({ id: 'l2', dealDeltaPct: -30 }),  // 30% below → deal 1.0
        makeListing({ id: 'l3', dealDeltaPct: 10 }),   // 10% over → deal ~0.33
      ];
      listingsMock.findActive.mockResolvedValue(listings);

      const results = await service.recommend(userId, 10);
      expect(results[0].id).toBe('l2');
      expect(results[1].id).toBe('l1');
      expect(results[2].id).toBe('l3');
    });

    it('handles null dealDeltaPct (unvaluated listing) as neutral 0.5', async () => {
      const listings = [
        makeListing({ id: 'l1', dealDeltaPct: null }),
        makeListing({ id: 'l2', dealDeltaPct: -10 }),
      ];
      listingsMock.findActive.mockResolvedValue(listings);

      const results = await service.recommend(userId, 10);
      expect(results[0].id).toBe('l2'); // −10% beats neutral
    });

    it('respects the limit parameter', async () => {
      const listings = Array.from({ length: 20 }, (_, i) =>
        makeListing({ id: `l${i}`, dealDeltaPct: -i }),
      );
      listingsMock.findActive.mockResolvedValue(listings);

      const results = await service.recommend(userId, 5);
      expect(results).toHaveLength(5);
    });

    it('returns empty array when no active listings', async () => {
      listingsMock.findActive.mockResolvedValue([]);
      const results = await service.recommend(userId, 10);
      expect(results).toEqual([]);
    });

    it('why string mentions below-market price for underpriced listings', async () => {
      listingsMock.findActive.mockResolvedValue([
        makeListing({ id: 'l1', dealDeltaPct: -20 }),
      ]);
      const results = await service.recommend(userId, 10);
      expect(results[0].why).toContain('below market');
    });
  });

  // Preference scoring

  describe('with preference profile', () => {
    const favoritedListing = makeListing({
      id: 'fav_listing',
      manufacturer: 'toyota',
      type: 'suv',
      fuel: 'gas',
      drive: 'awd',
    });

    beforeEach(() => {
      prismaMock.favorite.findMany.mockResolvedValue([
        { listing: favoritedListing, createdAt: new Date() },
      ]);
      searchHistoryMock.recent.mockResolvedValue([]);
    });

    it('scores a listing matching top preferences higher than a cold match', async () => {
      const preferred = makeListing({
        id: 'preferred',
        manufacturer: 'toyota',
        type: 'suv',
        fuel: 'gas',
        drive: 'awd',
        dealDeltaPct: 0,
      });
      const mismatch = makeListing({
        id: 'mismatch',
        manufacturer: 'honda',
        type: 'sedan',
        fuel: 'electric',
        drive: 'fwd',
        dealDeltaPct: 0,
      });
      listingsMock.findActive.mockResolvedValue([mismatch, preferred]);

      const results = await service.recommend(userId, 10);
      const preferredIdx = results.findIndex((r) => r.id === 'preferred');
      const mismatchIdx = results.findIndex((r) => r.id === 'mismatch');
      expect(preferredIdx).toBeLessThan(mismatchIdx);
    });

    it('why string mentions preferred manufacturer and type', async () => {
      listingsMock.findActive.mockResolvedValue([
        makeListing({
          id: 'l1',
          manufacturer: 'toyota',
          type: 'suv',
          fuel: 'gas',
          drive: 'awd',
          dealDeltaPct: null,
        }),
      ]);
      const results = await service.recommend(userId, 10);
      expect(results[0].why).toContain('manufacturer (toyota)');
      expect(results[0].why).toContain('type (suv)');
    });

    it('search history filter hits contribute to make preference', async () => {
      prismaMock.favorite.findMany.mockResolvedValue([]);
      searchHistoryMock.recent.mockResolvedValue([
        { filters: { make: 'ford', type: 'truck' }, createdAt: new Date() },
        { filters: { make: 'ford' }, createdAt: new Date() },
      ]);
      listingsMock.findActive.mockResolvedValue([
        makeListing({ id: 'ford_truck', manufacturer: 'ford', type: 'truck', dealDeltaPct: 0 }),
        makeListing({ id: 'toyota_sedan', manufacturer: 'toyota', type: 'sedan', dealDeltaPct: 0 }),
      ]);

      const results = await service.recommend(userId, 10);
      expect(results[0].id).toBe('ford_truck');
    });

    it('score is deterministic on the same fixture data', async () => {
      const listings = [
        makeListing({ id: 'a', manufacturer: 'toyota', dealDeltaPct: -5 }),
        makeListing({ id: 'b', manufacturer: 'honda', dealDeltaPct: -5 }),
      ];
      listingsMock.findActive.mockResolvedValue(listings);

      const r1 = await service.recommend(userId, 10);
      const r2 = await service.recommend(userId, 10);
      expect(r1.map((r) => r.id)).toEqual(r2.map((r) => r.id));
      expect(r1.map((r) => r.score)).toEqual(r2.map((r) => r.score));
    });
  });

  // excludeUserId

  it('passes excludeUserId so own listings never appear', async () => {
    prismaMock.favorite.findMany.mockResolvedValue([]);
    searchHistoryMock.recent.mockResolvedValue([]);
    listingsMock.findActive.mockResolvedValue([]);

    await service.recommend(userId, 10);
    expect(listingsMock.findActive).toHaveBeenCalledWith(
      expect.objectContaining({ excludeUserId: userId }),
    );
  });
});
