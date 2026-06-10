import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { hash, verify, argon2id } from 'argon2';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService, UserPublic } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LoginResult {
  accessToken: string;
  /** Raw refresh token — controller writes this into the httpOnly cookie. */
  rawRefresh: string;
  user: UserPublic;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(dto: RegisterDto): Promise<{ user: UserPublic }> {
    const passwordHash = await hash(dto.password, { type: argon2id });
    try {
      const user = await this.users.create({ email: dto.email, passwordHash });
      return { user: this.users.toPublic(user) };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('email already registered');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.users.findByEmail(dto.email);
    // Deliberately identical error for unknown email and wrong password.
    if (!user) throw new UnauthorizedException('invalid credentials');

    const valid = await verify(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException('invalid credentials');

    // TODO step 8: gate on emailVerified
    // if (!user.emailVerified) throw new ForbiddenException('email not verified');

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
}
