import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { hash, verify, argon2id } from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, UserPublic } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFY_EMAIL_TTL_MS = 24 * 60 * 60 * 1000;

export interface LoginResult {
  accessToken: string;
  /** Raw refresh token — controller writes this into the httpOnly cookie. */
  rawRefresh: string;
  user: UserPublic;
}

export interface RefreshResult {
  accessToken: string;
  rawRefresh: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: UserPublic }> {
    const passwordHash = await hash(dto.password, { type: argon2id });
    let user;
    try {
      user = await this.users.create({ email: dto.email, passwordHash });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('email already registered');
      }
      throw e;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFY_EMAIL_TTL_MS);

    await this.prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
    const link = `${frontendUrl}/verify-email?token=${rawToken}`;
    await this.mail.sendVerificationEmail(user.email, link);

    return { user: this.users.toPublic(user) };
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findByEmail(dto.email);
    // Deliberately identical error for unknown email and wrong password.
    if (!user) throw new UnauthorizedException('invalid credentials');

    const valid = await verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('invalid credentials');

    if (!user.emailVerified) throw new ForbiddenException('email not verified');

    const accessToken = this.jwt.sign({ sub: user.id, role: user.role });

    const rawRefresh = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, familyId, expiresAt },
    });

    return { accessToken, rawRefresh, user: this.users.toPublic(user) };
  }

  async verifyEmail(rawToken: string): Promise<void> {
    if (!rawToken) throw new BadRequestException('invalid verification token');

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash },
    });

    if (!stored) throw new BadRequestException('invalid verification token');
    // Check usedAt before expiry so a deliberately used (and later expired) token
    // reports "already used" rather than "expired".
    if (stored.usedAt) throw new GoneException('token already used');
    if (stored.expiresAt < new Date()) throw new GoneException('token expired');

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      });
      await tx.user.update({
        where: { id: stored.userId },
        data: { emailVerified: true },
      });
    });
  }

  async refresh(rawToken: string): Promise<RefreshResult> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });

    if (!stored) throw new UnauthorizedException('invalid refresh token');
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('invalid refresh token');

    if (stored.revokedAt) {
      // Reuse-attack: a token from this family was already consumed — kill the whole chain.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('invalid refresh token');
    }

    const newRaw = randomBytes(32).toString('hex');
    const newHash = createHash('sha256').update(newRaw).digest('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.create({
        data: { userId: stored.userId, tokenHash: newHash, familyId: stored.familyId, expiresAt },
      });
    });

    // Reload user so the new JWT reflects any role change since the last login.
    const user = await this.users.findById(stored.userId);
    if (!user) throw new UnauthorizedException();

    const accessToken = this.jwt.sign({ sub: user.id, role: user.role });
    return { accessToken, rawRefresh: newRaw };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
