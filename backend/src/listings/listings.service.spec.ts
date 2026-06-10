import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ListingStatus, Role } from '@prisma/client';
import { ListingsService } from './listings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModelService } from '../model/model.service';
import type { RequestUser } from '../auth/jwt.strategy';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const verifiedUser: RequestUser = {
  id: 'user_1',
  email: 'seller@example.com',
  role: Role.user,
  emailVerified: true,
};
const unverifiedUser: RequestUser = { ...verifiedUser, emailVerified: false };
const adminUser: RequestUser = {
  id: 'admin_1',
  email: 'admin@example.com',
  role: Role.admin,
  emailVerified: true,
};

const validSpec = {
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
};

const createDto = {
  ...validSpec,
  askingPrice: 18000,
  description: 'Clean one-owner Camry',
  contactEmail: 'seller@example.com',
};

function makeListing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'listing_1',
    ...validSpec,
    askingPrice: 18000,
    description: 'Clean one-owner Camry',
    contactEmail: 'seller@example.com',
    contactPhone: null,
    status: ListingStatus.draft,
    predictedValue: 20000,
    predictedLow: 18000,
    predictedHigh: 22000,
    dealDeltaPct: -10,
    userId: 'user_1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const prediction = { price: 20000, low: 18000, high: 22000 };

// Shape of the `{ data }` object the service hands to prisma create/update.
type PersistArgs = { data: Record<string, number | string | null> };

/** The data persisted by the first call to a mocked prisma write. */
function persistedData(
  mock: jest.Mock,
): Record<string, number | string | null> {
  return (mock.mock.calls[0] as [PersistArgs])[0].data;
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const prismaMock = {
  listing: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const modelMock = {
  post: jest.fn(),
  get: jest.fn(),
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ListingsService', () => {
  let service: ListingsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ModelService, useValue: modelMock },
      ],
    }).compile();

    service = module.get(ListingsService);
    jest.clearAllMocks();
    modelMock.post.mockResolvedValue(prediction);
    prismaMock.listing.create.mockImplementation((args: PersistArgs) =>
      Promise.resolve(makeListing(args.data)),
    );
    prismaMock.listing.update.mockImplementation((args: PersistArgs) =>
      Promise.resolve(makeListing(args.data)),
    );
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('valuates against model-service with snake_case spec fields', async () => {
      await service.create(verifiedUser, createDto);

      expect(modelMock.post).toHaveBeenCalledWith(
        '/predict',
        expect.objectContaining({
          manufacturer: 'toyota',
          title_status: 'clean', // camel → snake
          paint_color: 'white', // camel → snake
          year: 2018,
        }),
      );
    });

    it('stores the predicted value/low/high and computed deal delta', async () => {
      await service.create(verifiedUser, createDto);

      expect(prismaMock.listing.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user_1',
          predictedValue: 20000,
          predictedLow: 18000,
          predictedHigh: 22000,
          dealDeltaPct: -10, // (18000 - 20000) / 20000 * 100
        }),
      });
    });

    it('attaches a deal badge derived from the delta', async () => {
      const view = await service.create(verifiedUser, createDto);
      expect(view.dealBadge).toBe('under'); // -10% → good deal
    });

    it('never lets the client set predicted/derived fields', async () => {
      await service.create(verifiedUser, {
        ...createDto,
        predictedValue: 999999,
        dealDeltaPct: 999,
        userId: 'somebody_else',
      } as never);

      const data = persistedData(prismaMock.listing.create);
      expect(data.predictedValue).toBe(20000);
      expect(data.userId).toBe('user_1');
    });

    it('lets a verified user publish directly (status active)', async () => {
      await expect(
        service.create(verifiedUser, {
          ...createDto,
          status: ListingStatus.active,
        }),
      ).resolves.toBeDefined();
      expect(prismaMock.listing.create).toHaveBeenCalled();
    });

    it('forbids an unverified user from publishing (status active)', async () => {
      await expect(
        service.create(unverifiedUser, {
          ...createDto,
          status: ListingStatus.active,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.listing.create).not.toHaveBeenCalled();
    });

    it('allows an unverified user to save a draft', async () => {
      await expect(
        service.create(unverifiedUser, createDto),
      ).resolves.toBeDefined();
    });

    it('still creates the listing when model-service is unreachable', async () => {
      modelMock.post.mockRejectedValue(new ServiceUnavailableException());

      const view = await service.create(verifiedUser, createDto);

      const data = persistedData(prismaMock.listing.create);
      expect(data.predictedValue).toBeNull();
      expect(data.dealDeltaPct).toBeNull();
      expect(view.dealBadge).toBeNull();
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    beforeEach(() => {
      prismaMock.listing.findUnique.mockResolvedValue(makeListing());
    });

    it('throws NotFound when the listing does not exist', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);
      await expect(
        service.update(verifiedUser, 'missing', { askingPrice: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids a non-owner who is not admin', async () => {
      const stranger: RequestUser = { ...verifiedUser, id: 'user_2' };
      await expect(
        service.update(stranger, 'listing_1', { askingPrice: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.listing.update).not.toHaveBeenCalled();
    });

    it('lets an admin edit a listing they do not own', async () => {
      await expect(
        service.update(adminUser, 'listing_1', { askingPrice: 15000 }),
      ).resolves.toBeDefined();
      expect(prismaMock.listing.update).toHaveBeenCalled();
    });

    it('re-valuates when a spec field changes', async () => {
      await service.update(verifiedUser, 'listing_1', { odometer: 90000 });
      expect(modelMock.post).toHaveBeenCalledWith(
        '/predict',
        expect.objectContaining({ odometer: 90000 }),
      );
    });

    it('does NOT call model-service when only the asking price changes', async () => {
      await service.update(verifiedUser, 'listing_1', { askingPrice: 16000 });

      expect(modelMock.post).not.toHaveBeenCalled();
      // delta recomputed from existing predictedValue: (16000-20000)/20000*100
      const data = persistedData(prismaMock.listing.update);
      expect(data.dealDeltaPct).toBe(-20);
    });

    it('forbids an unverified owner from publishing via update', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(
        makeListing({ userId: 'user_1' }),
      );
      await expect(
        service.update(unverifiedUser, 'listing_1', {
          status: ListingStatus.active,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes when the owner requests it', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(makeListing());
      await service.remove(verifiedUser, 'listing_1');
      expect(prismaMock.listing.delete).toHaveBeenCalledWith({
        where: { id: 'listing_1' },
      });
    });

    it('forbids a non-owner from deleting', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(
        makeListing({ userId: 'someone' }),
      );
      await expect(
        service.remove(verifiedUser, 'listing_1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.listing.delete).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing listing', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);
      await expect(
        service.remove(verifiedUser, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the listing with a deal badge', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(makeListing());
      const view = await service.findOne('listing_1');
      expect(view.id).toBe('listing_1');
      expect(view.dealBadge).toBe('under');
    });

    it('throws NotFound when absent', async () => {
      prismaMock.listing.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── findActive (Fran's recommendation seam) ──────────────────────────────────

  describe('findActive', () => {
    it('queries only active listings and excludes the given user', async () => {
      prismaMock.listing.findMany.mockResolvedValue([
        makeListing({ status: ListingStatus.active }),
      ]);

      const views = await service.findActive({
        excludeUserId: 'user_99',
        take: 10,
      });

      expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ListingStatus.active, userId: { not: 'user_99' } },
          take: 10,
        }),
      );
      expect(views[0].dealBadge).toBe('under');
    });

    it('returns all active listings when no user is excluded', async () => {
      prismaMock.listing.findMany.mockResolvedValue([]);
      await service.findActive();
      expect(prismaMock.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: ListingStatus.active } }),
      );
    });
  });
});
