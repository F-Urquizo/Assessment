import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import type { RequestUser } from '../auth/jwt.strategy';

const user: RequestUser = {
  id: 'user_1',
  email: 'seller@example.com',
  role: Role.user,
  emailVerified: true,
};

const serviceMock = {
  create: jest.fn().mockResolvedValue({ id: 'listing_1' }),
  browse: jest.fn().mockResolvedValue({
    items: [{ id: 'listing_1' }],
    total: 1,
    page: 1,
    pageSize: 20,
  }),
  findOne: jest.fn().mockResolvedValue({ id: 'listing_1' }),
  update: jest.fn().mockResolvedValue({ id: 'listing_1' }),
  remove: jest.fn().mockResolvedValue(undefined),
};

describe('ListingsController', () => {
  let controller: ListingsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [{ provide: ListingsService, useValue: serviceMock }],
    }).compile();

    controller = module.get(ListingsController);
    jest.clearAllMocks();
  });

  it('create() delegates to the service with the current user', async () => {
    const dto = { manufacturer: 'toyota' } as never;
    await controller.create(user, dto);
    expect(serviceMock.create).toHaveBeenCalledWith(user, dto);
  });

  it('findAll() passes the browse query through to the service', async () => {
    const query = { make: 'toyota', sort: 'bestDeal', page: 2 } as never;
    const result = await controller.findAll(query);
    expect(serviceMock.browse).toHaveBeenCalledWith(query);
    expect(result).toEqual({
      items: [{ id: 'listing_1' }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('findOne() looks up by id', async () => {
    await controller.findOne('listing_1');
    expect(serviceMock.findOne).toHaveBeenCalledWith('listing_1');
  });

  it('update() delegates with the current user, id and dto', async () => {
    const dto = { askingPrice: 100 } as never;
    await controller.update(user, 'listing_1', dto);
    expect(serviceMock.update).toHaveBeenCalledWith(user, 'listing_1', dto);
  });

  it('remove() delegates with the current user and id', async () => {
    await controller.remove(user, 'listing_1');
    expect(serviceMock.remove).toHaveBeenCalledWith(user, 'listing_1');
  });
});
