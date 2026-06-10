import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

const baseUser = {
  id: 'cuid_1',
  email: 'user@example.com',
  passwordHash: '$argon2id$hash',
  role: Role.user,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const usersMock = { findById: jest.fn() };
const configMock = { getOrThrow: jest.fn().mockReturnValue('test_secret_32_chars_xxxxxxxxxx') };

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
    jest.clearAllMocks();
    configMock.getOrThrow.mockReturnValue('test_secret_32_chars_xxxxxxxxxx');
  });

  describe('validate', () => {
    it('returns { id, role, emailVerified } for an existing user', async () => {
      usersMock.findById.mockResolvedValue(baseUser);

      const result = await strategy.validate({ sub: 'cuid_1', role: 'user' });

      expect(result).toEqual({
        id: baseUser.id,
        email: baseUser.email,
        role: baseUser.role,
        emailVerified: baseUser.emailVerified,
      });
    });

    it('looks up the user by payload.sub', async () => {
      usersMock.findById.mockResolvedValue(baseUser);

      await strategy.validate({ sub: 'cuid_1', role: 'user' });

      expect(usersMock.findById).toHaveBeenCalledWith('cuid_1');
    });

    it('throws UnauthorizedException when user is not found', async () => {
      usersMock.findById.mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'deleted_user', role: 'user' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('never includes passwordHash in the returned object', async () => {
      usersMock.findById.mockResolvedValue(baseUser);

      const result = await strategy.validate({ sub: 'cuid_1', role: 'user' });

      expect(result).not.toHaveProperty('passwordHash');
    });
  });
});
