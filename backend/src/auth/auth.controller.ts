import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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

  // POST /auth/login → 200 (override NestJS @Post default of 201)
  @Post('login')
  @HttpCode(HttpStatus.OK)
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
