import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * Global secure-by-default guard.
 * Every route requires a valid Bearer JWT unless decorated with @Public().
 *
 * For @Public() routes that receive a Bearer token, the guard still attempts
 * validation so req.user is populated for optional-auth use-cases (e.g.
 * recording search history for logged-in users on the public browse endpoint).
 * Validation errors are silently swallowed — the request is never blocked.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!isPublic) return super.canActivate(context);

    // Public route: try to populate req.user when a token is present, but
    // never block the request regardless of the outcome.
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    if (req.headers['authorization']?.startsWith('Bearer ')) {
      return Promise.resolve(super.canActivate(context)).then(
        () => true,
        () => true,
      );
    }
    return true;
  }
}
