import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { FavoritesService } from './favorites.service';
import { PrismaService } from '../prisma/prisma.service';

// Fixtures

const userId = 'user_1';
const listingId = 'listing_1';

const fakeListing = {
  id: listingId,
  manufacturer: 'toyota',
  model: 'camry',
  year: 2018,
  odometer: 40000,
  cylinders: 4,
  condition: 'good',
  fuel: 'gas',
  titleStatus: 'clean',
  transmission: 'automatic',
  drive: 'fwd',
  type: 'sedan',
  paintColor: 'white',
  state: 'ca',
  askingPrice: 18000,
  description: null,
  contactEmail: 'seller@example.com',
  contactPhone: null,
  status: 'active' as const,
  predictedValue: 20000,
  predictedLow: 17000,
  predictedHigh: 23000,
  dealDeltaPct: -10,
  userId: 'owner_1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Prisma mock

const prismaMock = {
  listing: { findUnique: jest.fn() },
  favorite: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
};

// Tests

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(FavoritesService);
  });

  // add

  describe('add', () => {
    it('creates a favorite when listing exists', async () => {
      prismaMock.listing.findUnique.mockResolvedValue({ id: listingId });
      prismaMock.favorite.create.mockResolvedValue({});
      await expect(service.add(userId, listingId)).resolves.toBeUndefined();
      expect(prismaMock.favorite.create).toHaveBeenCalledWith({
        data: { userId, listingId },
      });
    });

    it('throws NotFoundException when listing does not exist', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);
      await expect(service.add(userId, 'no_such')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.favorite.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate (P2002)', async () => {
      prismaMock.listing.findUnique.mockResolvedValue({ id: listingId });
      const p2002 = Object.assign(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: '5.0.0',
        }),
      );
      prismaMock.favorite.create.mockRejectedValue(p2002);
      await expect(service.add(userId, listingId)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('re-throws unexpected errors', async () => {
      prismaMock.listing.findUnique.mockResolvedValue({ id: listingId });
      prismaMock.favorite.create.mockRejectedValue(new Error('db error'));
      await expect(service.add(userId, listingId)).rejects.toThrow('db error');
    });
  });

  // remove

  describe('remove', () => {
    it('deletes matching rows (idempotent)', async () => {
      prismaMock.favorite.deleteMany.mockResolvedValue({ count: 1 });
      await expect(service.remove(userId, listingId)).resolves.toBeUndefined();
      expect(prismaMock.favorite.deleteMany).toHaveBeenCalledWith({
        where: { userId, listingId },
      });
    });

    it('does not throw when row does not exist (idempotent)', async () => {
      prismaMock.favorite.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove(userId, 'no_such')).resolves.toBeUndefined();
    });
  });

  // list

  describe('list', () => {
    it('returns favorited listings enriched with dealBadge', async () => {
      prismaMock.favorite.findMany.mockResolvedValue([
        { listing: fakeListing },
      ]);
      const result = await service.list(userId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(listingId);
      // dealDeltaPct = −10 → badge is 'under'
      expect(result[0].dealBadge).toBe('under');
    });

    it('returns empty array when no favorites', async () => {
      prismaMock.favorite.findMany.mockResolvedValue([]);
      const result = await service.list(userId);
      expect(result).toEqual([]);
    });
  });
});
