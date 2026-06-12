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
import { AuditCtx, AuditEvent, AuditService } from '../audit/audit.service';
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
  user: UserPublic;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
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

    await this.issueEmailVerification(user);

    await this.audit.log({ event: AuditEvent.register, userId: user.id });

    return { user: this.users.toPublic(user) };
  }

  /**
   * Re-send the verification link for an account that registered but never
   * verified. Always resolves the same way regardless of whether the account
   * exists or is already verified, so the endpoint can't be used to enumerate
   * users — only an unverified, existing account actually triggers an email.
   */
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerified) return;
    await this.issueEmailVerification(user);
  }

  /** Mint a single-use email-verification token and mail the link. Shared by
   *  registration and the resend flow so both issue identical tokens. */
  private async issueEmailVerification(user: {
    id: string;
    email: string;
  }): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFY_EMAIL_TTL_MS);

    await this.prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
    const link = `${frontendUrl}/verify-email?token=${rawToken}`;
    await this.mail.sendVerificationEmail(user.email, link);
  }

  async login(dto: LoginDto, ctx: AuditCtx = {}): Promise<LoginResult> {
    const user = await this.users.findByEmail(dto.email);

    if (!user) {
      await this.audit.log({
        event: AuditEvent.login_failure,
        userId: null,
        metadata: { email: dto.email },
        ...ctx,
      });
      // Deliberately identical error for unknown email and wrong password.
      throw new UnauthorizedException('invalid credentials');
    }

    const valid = await verify(user.passwordHash, dto.password);
    if (!valid) {
      await this.audit.log({
        event: AuditEvent.login_failure,
        userId: user.id,
        ...ctx,
      });
      throw new UnauthorizedException('invalid credentials');
    }

    if (!user.emailVerified) throw new ForbiddenException('email not verified');

    const accessToken = this.jwt.sign({ sub: user.id, role: user.role });

    const rawRefresh = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawRefresh).digest('hex');
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, familyId, expiresAt },
    });

    await this.audit.log({ event: AuditEvent.login_success, userId: user.id, ...ctx });

    return { accessToken, rawRefresh, user: this.users.toPublic(user) };
  }

  async verifyEmail(rawToken: string): Promise<void> {
    if (!rawToken) throw new BadRequestException('invalid verification token');

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const stored = await this.prisma.emailVerificationToken.findFirst({
      where: { tokenHash },
    });

    if (!stored) throw new BadRequestException('invalid verification token');
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

    await this.audit.log({ event: AuditEvent.email_verified, userId: stored.userId });
  }

  async refresh(rawToken: string, ctx: AuditCtx = {}): Promise<RefreshResult> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const stored = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });

    if (!stored) throw new UnauthorizedException('invalid refresh token');
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('invalid refresh token');

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        event: AuditEvent.refresh_reuse_detected,
        userId: stored.userId,
        metadata: { familyId: stored.familyId },
        ...ctx,
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

    const user = await this.users.findById(stored.userId);
    if (!user) throw new UnauthorizedException();

    const accessToken = this.jwt.sign({ sub: user.id, role: user.role });

    await this.audit.log({
      event: AuditEvent.token_rotated,
      userId: stored.userId,
      metadata: { familyId: stored.familyId },
      ...ctx,
    });

    return { accessToken, rawRefresh: newRaw, user: this.users.toPublic(user) };
  }

  async logout(rawToken: string | undefined, ctx: AuditCtx = {}): Promise<void> {
    if (!rawToken) return;
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const token = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (token) {
      await this.audit.log({ event: AuditEvent.logout, userId: token.userId, ...ctx });
    }
  }
}
