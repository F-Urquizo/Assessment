/**
 * Unit tests for the global guard stack and decorators exported from
 * src/auth/guards. Passport's AuthGuard is mocked so tests are isolated.
 *
 * To prove the barrel works, every import in this file comes from the index:
 *   import { ... } from 'src/auth/guards'
 */

// Must be hoisted before any import that pulls in @nestjs/passport.
const superCanActivate = jest.fn().mockReturnValue(true);
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () =>
    class MockPassportBase {
      canActivate(ctx: unknown) {
        return superCanActivate(ctx);
      }
    },
}));

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import {
  IS_PUBLIC_KEY,
  JwtAuthGuard,
  ROLES_KEY,
  RolesGuard,
  VERIFIED_KEY,
  VerifiedGuard,
} from './index';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCtx(
  user?: Partial<{ role: Role; emailVerified: boolean }>,
  handlerKey?: string,
  value?: unknown,
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user, headers: {} }) }),
  } as unknown as ExecutionContext;
}

function makeReflector(metadata: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: jest.fn().mockImplementation((key: string) => metadata[key]),
  } as unknown as Reflector;
}

// ── JwtAuthGuard ───────────────────────────────────────────────────────────

describe('JwtAuthGuard', () => {
  beforeEach(() => superCanActivate.mockClear());

  it('returns true immediately for @Public() routes without calling passport', () => {
    const reflector = makeReflector({ [IS_PUBLIC_KEY]: true });
    const guard = new JwtAuthGuard(reflector);
    const ctx = makeCtx();

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('delegates to passport (super) when route is not @Public()', () => {
    superCanActivate.mockReturnValue(true);
    const reflector = makeReflector({ [IS_PUBLIC_KEY]: false });
    const guard = new JwtAuthGuard(reflector);
    const ctx = makeCtx();

    guard.canActivate(ctx);

    expect(superCanActivate).toHaveBeenCalledWith(ctx);
  });

  it('returns what passport returns for authenticated routes', () => {
    superCanActivate.mockReturnValue(false);
    const reflector = makeReflector({ [IS_PUBLIC_KEY]: false });
    const guard = new JwtAuthGuard(reflector);

    const result = guard.canActivate(makeCtx());

    expect(result).toBe(false);
  });
});

// ── RolesGuard ────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  it('returns true when no @Roles() metadata is set', () => {
    const guard = new RolesGuard(makeReflector({}));

    expect(guard.canActivate(makeCtx({ role: Role.user }))).toBe(true);
  });

  it('returns true when user role matches the required role', () => {
    const guard = new RolesGuard(makeReflector({ [ROLES_KEY]: [Role.admin] }));

    expect(guard.canActivate(makeCtx({ role: Role.admin }))).toBe(true);
  });

  it('throws ForbiddenException when user role does not match', () => {
    const guard = new RolesGuard(makeReflector({ [ROLES_KEY]: [Role.admin] }));

    expect(() => guard.canActivate(makeCtx({ role: Role.user }))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when user is missing entirely', () => {
    const guard = new RolesGuard(makeReflector({ [ROLES_KEY]: [Role.admin] }));

    expect(() => guard.canActivate(makeCtx(undefined))).toThrow(ForbiddenException);
  });

  it('accepts the first matching role in a multi-role list', () => {
    const guard = new RolesGuard(
      makeReflector({ [ROLES_KEY]: [Role.user, Role.admin] }),
    );

    expect(guard.canActivate(makeCtx({ role: Role.user }))).toBe(true);
  });
});

// ── VerifiedGuard ─────────────────────────────────────────────────────────

describe('VerifiedGuard', () => {
  it('returns true when no @Verified() metadata is set', () => {
    const guard = new VerifiedGuard(makeReflector({}));

    expect(guard.canActivate(makeCtx({ emailVerified: false }))).toBe(true);
  });

  it('returns true when emailVerified = true', () => {
    const guard = new VerifiedGuard(
      makeReflector({ [VERIFIED_KEY]: true }),
    );

    expect(guard.canActivate(makeCtx({ emailVerified: true }))).toBe(true);
  });

  it('throws ForbiddenException when emailVerified = false', () => {
    const guard = new VerifiedGuard(
      makeReflector({ [VERIFIED_KEY]: true }),
    );

    expect(() => guard.canActivate(makeCtx({ emailVerified: false }))).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException when user has no emailVerified field', () => {
    const guard = new VerifiedGuard(
      makeReflector({ [VERIFIED_KEY]: true }),
    );

    expect(() => guard.canActivate(makeCtx({}))).toThrow(ForbiddenException);
  });

  it('error message is "email not verified"', () => {
    const guard = new VerifiedGuard(
      makeReflector({ [VERIFIED_KEY]: true }),
    );
    let message: string | undefined;
    try {
      guard.canActivate(makeCtx({ emailVerified: false }));
    } catch (e) {
      message = (e as ForbiddenException).message;
    }
    expect(message).toBe('email not verified');
  });
});
