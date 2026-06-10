import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const publicUser = {
  id: 'cuid_test',
  email: 'user@example.com',
  role: Role.user,
  emailVerified: false,
};

const authMock = {
  register: jest.fn(),
  login: jest.fn(),
};

const configMock = {
  get: jest.fn().mockImplementation((_key: string, fallback: unknown) => fallback),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    controller = module.get(AuthController);
    jest.clearAllMocks();
    configMock.get.mockImplementation((_key: string, fallback: unknown) => fallback);
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('returns the service result directly', async () => {
      const expected = { user: publicUser };
      authMock.register.mockResolvedValue(expected);

      const result = await controller.register({ email: 'a@b.com', password: 'pass1234' });

      expect(result).toEqual(expected);
    });

    it('does not include passwordHash in the response', async () => {
      authMock.register.mockResolvedValue({ user: publicUser });

      const result = await controller.register({ email: 'a@b.com', password: 'pass1234' });

      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    const mockRes = { cookie: jest.fn() };

    beforeEach(() => jest.clearAllMocks());

    it('sets an httpOnly cookie named "refresh" with the raw token', async () => {
      authMock.login.mockResolvedValue({
        accessToken: 'jwt.token',
        rawRefresh: 'raw_token_hex',
        user: publicUser,
      });

      await controller.login(
        { email: 'user@example.com', password: 'pass1234' },
        mockRes as any,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh',
        'raw_token_hex',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('scopes the cookie to /auth/refresh', async () => {
      authMock.login.mockResolvedValue({
        accessToken: 'jwt',
        rawRefresh: 'raw',
        user: publicUser,
      });

      await controller.login(
        { email: 'user@example.com', password: 'pass1234' },
        mockRes as any,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh',
        expect.any(String),
        expect.objectContaining({ path: '/auth/refresh' }),
      );
    });

    it('response body contains accessToken and user — no rawRefresh', async () => {
      authMock.login.mockResolvedValue({
        accessToken: 'jwt.token',
        rawRefresh: 'raw_token_hex',
        user: publicUser,
      });

      const result = await controller.login(
        { email: 'user@example.com', password: 'pass1234' },
        mockRes as any,
      );

      expect(result).toEqual({ accessToken: 'jwt.token', user: publicUser });
      expect(result).not.toHaveProperty('rawRefresh');
    });

    it('uses SameSite and Secure values from ConfigService', async () => {
      authMock.login.mockResolvedValue({
        accessToken: 'jwt',
        rawRefresh: 'raw',
        user: publicUser,
      });
      configMock.get.mockImplementation((key: string, fallback: unknown) => {
        if (key === 'COOKIE_SAME_SITE') return 'none';
        if (key === 'COOKIE_SECURE') return 'true';
        return fallback;
      });

      await controller.login(
        { email: 'user@example.com', password: 'pass1234' },
        mockRes as any,
      );

      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh',
        expect.any(String),
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });
  });
});
