import { UnauthorizedException } from '@nestjs/common';
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
  refresh: jest.fn(),
  logout: jest.fn(),
};

const configMock = {
  get: jest.fn().mockImplementation((_key: string, fallback: unknown) => fallback),
};

function makeRes() {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

function makeReq(cookieValue?: string) {
  return { cookies: cookieValue !== undefined ? { refresh: cookieValue } : {} };
}

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
    authMock.logout.mockResolvedValue(undefined);
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
    it('sets an httpOnly cookie named "refresh" with the raw token', async () => {
      authMock.login.mockResolvedValue({
        accessToken: 'jwt.token',
        rawRefresh: 'raw_token_hex',
        user: publicUser,
      });
      const res = makeRes();

      await controller.login({ email: 'user@example.com', password: 'pass1234' }, res as any);

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh',
        'raw_token_hex',
        expect.objectContaining({ httpOnly: true }),
      );
    });

    it('scopes the cookie to /auth', async () => {
      authMock.login.mockResolvedValue({
        accessToken: 'jwt',
        rawRefresh: 'raw',
        user: publicUser,
      });
      const res = makeRes();

      await controller.login({ email: 'user@example.com', password: 'pass1234' }, res as any);

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh',
        expect.any(String),
        expect.objectContaining({ path: '/auth' }),
      );
    });

    it('response body contains accessToken and user — no rawRefresh', async () => {
      authMock.login.mockResolvedValue({
        accessToken: 'jwt.token',
        rawRefresh: 'raw_token_hex',
        user: publicUser,
      });
      const res = makeRes();

      const result = await controller.login(
        { email: 'user@example.com', password: 'pass1234' },
        res as any,
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
      const res = makeRes();

      await controller.login({ email: 'user@example.com', password: 'pass1234' }, res as any);

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh',
        expect.any(String),
        expect.objectContaining({ sameSite: 'none', secure: true }),
      );
    });
  });

  // ── refresh ───────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('reads the refresh cookie, calls service, sets new cookie and returns { accessToken }', async () => {
      authMock.refresh.mockResolvedValue({
        accessToken: 'new.jwt',
        rawRefresh: 'new_raw',
      });
      const res = makeRes();

      const result = await controller.refresh(makeReq('old_raw') as any, res as any);

      expect(authMock.refresh).toHaveBeenCalledWith('old_raw');
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh',
        'new_raw',
        expect.objectContaining({ httpOnly: true, path: '/auth' }),
      );
      expect(result).toEqual({ accessToken: 'new.jwt' });
    });

    it('response body does not include rawRefresh', async () => {
      authMock.refresh.mockResolvedValue({ accessToken: 'new.jwt', rawRefresh: 'new_raw' });
      const res = makeRes();

      const result = await controller.refresh(makeReq('old_raw') as any, res as any);

      expect(result).not.toHaveProperty('rawRefresh');
    });

    it('throws 401 when no refresh cookie is present', async () => {
      const res = makeRes();

      await expect(
        controller.refresh(makeReq() as any, res as any),
      ).rejects.toThrow(UnauthorizedException);
      expect(authMock.refresh).not.toHaveBeenCalled();
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('calls logout with cookie value and clears the cookie', async () => {
      const res = makeRes();

      await controller.logout(makeReq('raw_token') as any, res as any);

      expect(authMock.logout).toHaveBeenCalledWith('raw_token');
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh',
        expect.objectContaining({ path: '/auth', httpOnly: true }),
      );
    });

    it('clearCookie options do not contain maxAge (to avoid conflicting with browser expiry)', async () => {
      const res = makeRes();

      await controller.logout(makeReq('raw_token') as any, res as any);

      const clearOpts = (res.clearCookie as jest.Mock).mock.calls[0][1];
      expect(clearOpts).not.toHaveProperty('maxAge');
    });

    it('is idempotent: no cookie → still calls logout(undefined) and clears cookie', async () => {
      const res = makeRes();

      await controller.logout(makeReq() as any, res as any);

      expect(authMock.logout).toHaveBeenCalledWith(undefined);
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });
});
