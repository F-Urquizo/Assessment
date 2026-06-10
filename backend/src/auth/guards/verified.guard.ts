import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { VERIFIED_KEY } from './verified.decorator';

/**
 * Enforces @Verified() constraints. No-ops when @Verified() is absent.
 * Throws 403 if req.user.emailVerified !== true.
 */
@Injectable()
export class VerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(VERIFIED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { emailVerified: boolean } }>();
    if (!user?.emailVerified) throw new ForbiddenException('email not verified');
    return true;
  }
}
