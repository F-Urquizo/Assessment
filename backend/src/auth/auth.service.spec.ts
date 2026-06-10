// argon2 must be mocked before any import that pulls it in.
jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import { hash as argon2hash, verify as argon2verify } from 'argon2';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseUser = {
  id: 'cuid_test',
  email: 'user@example.com',
  passwordHash: '$argon2id$stored_hash',
  role: Role.user,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const publicUser = {
  id: baseUser.id,
  email: baseUser.email,
  role: baseUser.role,
  emailVerified: baseUser.emailVerified,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const usersMock = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  toPublic: jest.fn().mockReturnValue(publicUser),
};

const jwtMock = {
  sign: jest.fn().mockReturnValue('signed.jwt.token'),
};

const prismaMock = {
  refreshToken: { create: jest.fn().mockResolvedValue({}) },
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();

    // Re-set defaults cleared above.
    (argon2hash as jest.Mock).mockResolvedValue('$argon2id$mock_hash');
    (argon2verify as jest.Mock).mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('signed.jwt.token');
    prismaMock.refreshToken.create.mockResolvedValue({});
    usersMock.toPublic.mockReturnValue(publicUser);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('hashes the password with argon2id before storing', async () => {
      usersMock.create.mockResolvedValue(baseUser);

      await service.register({ email: 'a@b.com', password: 'password123' });

      expect(argon2hash).toHaveBeenCalledWith(
        'password123',
        expect.objectContaining({ type: 2 }), // 2 = argon2id
      );
      const storedHash = (usersMock.create as jest.Mock).mock.calls[0][0].passwordHash;
      expect(storedHash).toBe('$argon2id$mock_hash');
      expect(storedHash).not.toBe('password123');
    });

    it('returns { user } without passwordHash', async () => {
      usersMock.create.mockResolvedValue(baseUser);

      const result = await service.register({ email: 'a@b.com', password: 'password123' });

      expect(result.user).toEqual(publicUser);
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws 409 ConflictException on P2002 (duplicate email)', async () => {
      const p2002 = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0', meta: { target: ['email'] } },
      );
      usersMock.create.mockRejectedValue(p2002);

      await expect(
        service.register({ email: 'dup@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('re-throws non-P2002 Prisma errors', async () => {
      const other = new Prisma.PrismaClientKnownRequestError('Something else', {
        code: 'P2003',
        clientVersion: '6.0.0',
      });
      usersMock.create.mockRejectedValue(other);

      await expect(
        service.register({ email: 'a@b.com', password: 'password123' }),
      ).rejects.toThrow(other);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns accessToken, rawRefresh and public user on valid credentials', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);

      const result = await service.login({ email: 'user@example.com', password: 'password123' });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.rawRefresh).toEqual(expect.any(String));
      expect(result.user).toEqual(publicUser);
    });

    it('signs JWT with { sub: userId, role }', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);

      await service.login({ email: 'user@example.com', password: 'password123' });

      expect(jwtMock.sign).toHaveBeenCalledWith({
        sub: baseUser.id,
        role: baseUser.role,
      });
    });

    it('persists a refresh token row with a hash — not the raw token', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);

      const result = await service.login({ email: 'user@example.com', password: 'password123' });

      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: baseUser.id,
          tokenHash: expect.any(String),
          familyId: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });

      const savedHash: string =
        (prismaMock.refreshToken.create as jest.Mock).mock.calls[0][0].data.tokenHash;
      // The stored value must be a hash, not the raw token.
      expect(savedHash).not.toBe(result.rawRefresh);
      // SHA-256 hex is always 64 chars.
      expect(savedHash).toHaveLength(64);
    });

    it('throws 401 UnauthorizedException when email is not found', async () => {
      usersMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 UnauthorizedException on wrong password', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);
      (argon2verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('never includes passwordHash in the returned user', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);

      const result = await service.login({ email: 'user@example.com', password: 'password123' });

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });
});
