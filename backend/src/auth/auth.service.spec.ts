// argon2 must be mocked before any import that pulls it in.
jest.mock('argon2', () => ({
  argon2id: 2,
  hash: jest.fn(),
  verify: jest.fn(),
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuditEvent, Prisma, Role } from '@prisma/client';
import { hash as argon2hash, verify as argon2verify } from 'argon2';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// emailVerified=true so login tests pass the gate by default.
// Override to { ...baseUser, emailVerified: false } in gate-specific tests.
const baseUser = {
  id: 'cuid_test',
  email: 'user@example.com',
  passwordHash: '$argon2id$stored_hash',
  role: Role.user,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const publicUser = {
  id: baseUser.id,
  email: baseUser.email,
  role: baseUser.role,
  emailVerified: true,
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

const usersMock = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  toPublic: jest.fn().mockReturnValue(publicUser),
};

const jwtMock = {
  sign: jest.fn().mockReturnValue('signed.jwt.token'),
};

const prismaMock = {
  refreshToken: {
    create: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  emailVerificationToken: {
    create: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  user: {
    update: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(),
};

const mailMock = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
};

const auditMock = {
  log: jest.fn().mockResolvedValue(undefined),
};

const configMock = {
  get: jest.fn().mockImplementation((_key: string, fallback: unknown) => fallback),
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
        { provide: MailService, useValue: mailMock },
        { provide: ConfigService, useValue: configMock },
        { provide: AuditService, useValue: auditMock },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();

    // Re-set defaults cleared above.
    (argon2hash as jest.Mock).mockResolvedValue('$argon2id$mock_hash');
    (argon2verify as jest.Mock).mockResolvedValue(true);
    jwtMock.sign.mockReturnValue('signed.jwt.token');
    prismaMock.refreshToken.create.mockResolvedValue({});
    prismaMock.refreshToken.update.mockResolvedValue({});
    prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.emailVerificationToken.create.mockResolvedValue({});
    prismaMock.emailVerificationToken.update.mockResolvedValue({});
    prismaMock.user.update.mockResolvedValue({});
    // $transaction passes prismaMock as the transaction client.
    prismaMock.$transaction.mockImplementation((fn: any) => fn(prismaMock));
    usersMock.toPublic.mockReturnValue(publicUser);
    usersMock.findById.mockResolvedValue(baseUser);
    mailMock.sendVerificationEmail.mockResolvedValue(undefined);
    auditMock.log.mockResolvedValue(undefined);
    configMock.get.mockImplementation((_key: string, fallback: unknown) => fallback);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    beforeEach(() => usersMock.create.mockResolvedValue(baseUser));

    it('hashes the password with argon2id before storing', async () => {
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

    it('creates an email verification token with a 64-char SHA-256 hash', async () => {
      await service.register({ email: 'a@b.com', password: 'password123' });

      expect(prismaMock.emailVerificationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: baseUser.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
      const storedHash: string =
        (prismaMock.emailVerificationToken.create as jest.Mock).mock.calls[0][0].data.tokenHash;
      expect(storedHash).toHaveLength(64);
    });

    it('calls sendVerificationEmail with a link containing the raw token', async () => {
      await service.register({ email: 'a@b.com', password: 'password123' });

      expect(mailMock.sendVerificationEmail).toHaveBeenCalledWith(
        baseUser.email,
        expect.stringContaining('/verify-email?token='),
      );
    });

    it('stored hash is the SHA-256 of the raw token in the link', async () => {
      await service.register({ email: 'a@b.com', password: 'password123' });

      const link: string = (mailMock.sendVerificationEmail as jest.Mock).mock.calls[0][1];
      const rawInLink = link.split('?token=')[1];
      const expectedHash = createHash('sha256').update(rawInLink).digest('hex');
      const storedHash: string =
        (prismaMock.emailVerificationToken.create as jest.Mock).mock.calls[0][0].data.tokenHash;

      expect(storedHash).toBe(expectedHash);
      expect(rawInLink).not.toBe(storedHash);
    });
  });

  // ── resendVerification ──────────────────────────────────────────────────────

  describe('resendVerification', () => {
    it('issues a fresh token and emails the link for an unverified account', async () => {
      usersMock.findByEmail.mockResolvedValue({
        ...baseUser,
        emailVerified: false,
      });

      await service.resendVerification('user@example.com');

      expect(prismaMock.emailVerificationToken.create).toHaveBeenCalledTimes(1);
      expect(mailMock.sendVerificationEmail).toHaveBeenCalledWith(
        baseUser.email,
        expect.stringContaining('/verify-email?token='),
      );
    });

    it('does nothing for an already-verified account', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser); // emailVerified: true

      await service.resendVerification('user@example.com');

      expect(prismaMock.emailVerificationToken.create).not.toHaveBeenCalled();
      expect(mailMock.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('does nothing (and does not throw) for an unknown account', async () => {
      usersMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.resendVerification('nobody@example.com'),
      ).resolves.toBeUndefined();
      expect(mailMock.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns accessToken, rawRefresh and public user for a verified account', async () => {
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
      expect(savedHash).not.toBe(result.rawRefresh);
      expect(savedHash).toHaveLength(64);
    });

    it('throws 401 when email is not found', async () => {
      usersMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 on wrong password', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);
      (argon2verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 403 when email is not verified', async () => {
      usersMock.findByEmail.mockResolvedValue({ ...baseUser, emailVerified: false });

      await expect(
        service.login({ email: 'user@example.com', password: 'password123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('never includes passwordHash in the returned user', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);

      const result = await service.login({ email: 'user@example.com', password: 'password123' });

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('logs login_success with userId and context on valid credentials', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);

      await service.login(
        { email: 'user@example.com', password: 'password123' },
        { ip: '1.2.3.4', userAgent: 'jest' },
      );

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditEvent.login_success,
          userId: baseUser.id,
          ip: '1.2.3.4',
          userAgent: 'jest',
        }),
      );
    });

    it('logs login_failure with null userId and email in metadata when user not found', async () => {
      usersMock.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditEvent.login_failure,
          userId: null,
          metadata: expect.objectContaining({ email: 'ghost@example.com' }),
        }),
      );
    });

    it('logs login_failure with userId when password is wrong', async () => {
      usersMock.findByEmail.mockResolvedValue(baseUser);
      (argon2verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'user@example.com', password: 'bad' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditEvent.login_failure,
          userId: baseUser.id,
        }),
      );
    });
  });

  // ── verifyEmail ───────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    const RAW = 'e'.repeat(64);
    const TOKEN_HASH = createHash('sha256').update(RAW).digest('hex');

    const validToken = {
      id: 'evt-cuid',
      userId: baseUser.id,
      tokenHash: TOKEN_HASH,
      expiresAt: new Date(Date.now() + 100_000),
      usedAt: null,
      createdAt: new Date(),
    };

    it('marks the token used and the user verified in a transaction', async () => {
      prismaMock.emailVerificationToken.findFirst.mockResolvedValue(validToken);

      await service.verifyEmail(RAW);

      expect(prismaMock.emailVerificationToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validToken.id },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: baseUser.id },
        data: { emailVerified: true },
      });
    });

    it('second call with the same token throws 410 (single-use)', async () => {
      // Simulate a token that was already used.
      prismaMock.emailVerificationToken.findFirst.mockResolvedValue({
        ...validToken,
        usedAt: new Date(),
      });

      await expect(service.verifyEmail(RAW)).rejects.toThrow(GoneException);
      // User update must NOT be called again.
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('throws 400 when token is not found', async () => {
      prismaMock.emailVerificationToken.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail(RAW)).rejects.toThrow(BadRequestException);
    });

    it('throws 410 when token is expired', async () => {
      prismaMock.emailVerificationToken.findFirst.mockResolvedValue({
        ...validToken,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.verifyEmail(RAW)).rejects.toThrow(GoneException);
    });

    it('throws 400 for an empty/falsy token without hitting the database', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow(BadRequestException);
      expect(prismaMock.emailVerificationToken.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('refresh', () => {
    const RAW = 'a'.repeat(64);
    const TOKEN_HASH = createHash('sha256').update(RAW).digest('hex');
    const FAMILY_ID = 'family-uuid-001';

    const validStored = {
      id: 'token-cuid',
      userId: baseUser.id,
      tokenHash: TOKEN_HASH,
      familyId: FAMILY_ID,
      expiresAt: new Date(Date.now() + 100_000),
      revokedAt: null,
      createdAt: new Date(),
    };

    it('revokes old token and creates a new one in the same family', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(validStored);

      await service.refresh(RAW);

      expect(prismaMock.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validStored.id },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(prismaMock.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: baseUser.id,
            familyId: FAMILY_ID,
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('returns a new accessToken and a fresh rawRefresh different from the original', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(validStored);

      const result = await service.refresh(RAW);

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.rawRefresh).toBeDefined();
      expect(result.rawRefresh).not.toBe(RAW);
    });

    it('stores a 64-char SHA-256 hash for the new token — not the raw value', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(validStored);

      const result = await service.refresh(RAW);

      const newHash: string =
        (prismaMock.refreshToken.create as jest.Mock).mock.calls[0][0].data.tokenHash;
      expect(newHash).toHaveLength(64);
      expect(newHash).not.toBe(result.rawRefresh);
    });

    it('reuse attack: revokes entire family and throws 401', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        ...validStored,
        revokedAt: new Date(),
      });

      await expect(service.refresh(RAW)).rejects.toThrow(UnauthorizedException);

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: FAMILY_ID },
        data: expect.objectContaining({ revokedAt: expect.any(Date) }),
      });
    });

    it('throws 401 when the token is expired', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        ...validStored,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(service.refresh(RAW)).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when the token is not found', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refresh(RAW)).rejects.toThrow(UnauthorizedException);
    });

    it('reloads user by userId for the new JWT (reflects current role)', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(validStored);

      await service.refresh(RAW);

      expect(usersMock.findById).toHaveBeenCalledWith(baseUser.id);
      expect(jwtMock.sign).toHaveBeenCalledWith({
        sub: baseUser.id,
        role: baseUser.role,
      });
    });

    it('logs token_rotated with userId and familyId after successful rotation', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue(validStored);

      await service.refresh(RAW, { ip: '1.1.1.1' });

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditEvent.token_rotated,
          userId: baseUser.id,
          metadata: expect.objectContaining({ familyId: FAMILY_ID }),
          ip: '1.1.1.1',
        }),
      );
    });

    it('logs refresh_reuse_detected with familyId before throwing 401', async () => {
      prismaMock.refreshToken.findFirst.mockResolvedValue({
        ...validStored,
        revokedAt: new Date(),
      });

      await expect(service.refresh(RAW)).rejects.toThrow(UnauthorizedException);

      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: AuditEvent.refresh_reuse_detected,
          userId: baseUser.id,
          metadata: expect.objectContaining({ familyId: FAMILY_ID }),
        }),
      );
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    const RAW = 'b'.repeat(64);
    const TOKEN_HASH = createHash('sha256').update(RAW).digest('hex');

    it('revokes the token by hash when a valid raw token is provided', async () => {
      await service.logout(RAW);

      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: TOKEN_HASH, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('resolves without error when no token is provided (undefined)', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      expect(prismaMock.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('resolves without error when the token is not in the database', async () => {
      prismaMock.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.logout(RAW)).resolves.toBeUndefined();
    });
  });
});
