import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
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
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }
}
