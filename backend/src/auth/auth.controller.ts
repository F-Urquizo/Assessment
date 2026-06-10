import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from './guards';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

// All /auth/* routes are public — they authenticate by credentials/cookie,
// not by Bearer token. This covers current routes and future ones (refresh,
// logout, verify-email) added in later steps.
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  // POST /auth/register → 201 (NestJS default for @Post)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // POST /auth/login → 200; stricter throttle to resist brute-force.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, rawRefresh, user } = await this.auth.login(dto);
    res.cookie('refresh', rawRefresh, this.cookieOptions());
    return { accessToken, user };
  }

  // GET /auth/verify-email?token=<rawToken>
  // 200 on success; 400 invalid; 410 expired/used.
  // Redirect to the landing page is handled client-side by Ramiro's frontend.
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    await this.auth.verifyEmail(token);
    return { verified: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.['refresh'] as string | undefined;
    if (!raw) throw new UnauthorizedException();
    const { accessToken, rawRefresh } = await this.auth.refresh(raw);
    res.cookie('refresh', rawRefresh, this.cookieOptions());
    return { accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies?.['refresh'] as string | undefined;
    await this.auth.logout(raw);
    res.clearCookie('refresh', this.clearCookieOpts());
  }

  private cookieOptions(): CookieOptions {
    const secure =
      this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
    const sameSite = this.config.get<'lax' | 'strict' | 'none'>(
      'COOKIE_SAME_SITE',
      'lax',
    );
    return {
      httpOnly: true,
      secure,
      sameSite,
      // Path covers /auth/refresh, /auth/logout — both need the cookie.
      path: '/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  // clearCookie must use the same path/sameSite/secure so the browser removes it.
  private clearCookieOpts(): CookieOptions {
    const { maxAge: _maxAge, ...opts } = this.cookieOptions();
    return opts;
  }
}
