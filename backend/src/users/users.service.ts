import { Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Public shape of a user — matches UserDto in frontend/src/lib/auth-types.ts.
 * passwordHash and timestamps are intentionally excluded.
 */
export type UserPublic = {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalize(email: string): string {
    return email.trim().toLowerCase();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: this.normalize(email) },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: this.normalize(data.email),
        passwordHash: data.passwordHash,
      },
    });
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async setRole(userId: string, role: Role): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  toPublic(user: User): UserPublic {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }
}
