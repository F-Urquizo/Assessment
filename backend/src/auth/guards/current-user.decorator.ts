import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '../jwt.strategy';

/** Inject req.user (set by JwtAuthGuard) into a route handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser =>
    ctx.switchToHttp().getRequest<{ user: RequestUser }>().user,
);
