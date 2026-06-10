import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FavoritesService } from './favorites.service';

function prismaMock() {
  return {
    favorite: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    listing: { findUnique: jest.fn() },
  };
}

function service(prisma: ReturnType<typeof prismaMock>): FavoritesService {
  return new FavoritesService(prisma as unknown as PrismaService);
}

describe('FavoritesService', () => {
  it('list() maps the joined listing to a view with a deal badge', async () => {
    const prisma = prismaMock();
    prisma.favorite.findMany.mockResolvedValue([
      { listing: { id: 'l1', dealDeltaPct: -15 } },
      { listing: { id: 'l2', dealDeltaPct: 14 } },
    ]);
    const result = await service(prisma).list('u1');
    expect(result.map((l) => l.dealBadge)).toEqual(['under', 'over']);
  });

  it('add() rejects when the listing does not exist', async () => {
    const prisma = prismaMock();
    prisma.listing.findUnique.mockResolvedValue(null);
    await expect(service(prisma).add('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('add() is idempotent — a duplicate (P2002) is swallowed', async () => {
    const prisma = prismaMock();
    prisma.listing.findUnique.mockResolvedValue({ id: 'l1' });
    prisma.favorite.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service(prisma).add('u1', 'l1')).resolves.toEqual({
      favorited: true,
    });
  });

  it('remove() deletes by (userId, listingId)', async () => {
    const prisma = prismaMock();
    prisma.favorite.deleteMany.mockResolvedValue({ count: 1 });
    await service(prisma).remove('u1', 'l1');
    expect(prisma.favorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', listingId: 'l1' },
    });
  });
});
