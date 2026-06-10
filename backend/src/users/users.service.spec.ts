import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

// Minimal stub — only the User model methods used by UsersService.
const prismaMock = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const baseUser = {
  id: 'cuid_test',
  email: 'user@example.com',
  passwordHash: '$2b$10$hash',
  role: Role.user,
  emailVerified: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  // ── findByEmail ────────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('normalizes email to lowercase before the DB query', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await service.findByEmail('USER@EXAMPLE.COM');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('trims whitespace as part of normalization', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await service.findByEmail('  User@Example.com  ');

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('returns null when no user is found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      expect(await service.findByEmail('ghost@example.com')).toBeNull();
    });

    it('returns the User row when found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(baseUser);

      const result = await service.findByEmail('user@example.com');

      expect(result).toEqual(baseUser);
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('normalizes email to lowercase before inserting', async () => {
      prismaMock.user.create.mockResolvedValue({ ...baseUser, email: 'new@example.com' });

      await service.create({ email: 'NEW@EXAMPLE.COM', passwordHash: 'hash' });

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: { email: 'new@example.com', passwordHash: 'hash' },
      });
    });

    it('does not set emailVerified or role — Prisma defaults apply', async () => {
      prismaMock.user.create.mockResolvedValue(baseUser);

      await service.create({ email: 'u@example.com', passwordHash: 'hash' });

      const calledData = prismaMock.user.create.mock.calls[0][0].data;
      expect(calledData).not.toHaveProperty('emailVerified');
      expect(calledData).not.toHaveProperty('role');
    });

    it('returns the created User row', async () => {
      prismaMock.user.create.mockResolvedValue(baseUser);

      const result = await service.create({ email: baseUser.email, passwordHash: 'hash' });

      expect(result).toEqual(baseUser);
    });
  });

  // ── markEmailVerified ──────────────────────────────────────────────────────

  describe('markEmailVerified', () => {
    it('updates only emailVerified to true for the given userId', async () => {
      prismaMock.user.update.mockResolvedValue({ ...baseUser, emailVerified: true });

      await service.markEmailVerified('cuid_test');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'cuid_test' },
        data: { emailVerified: true },
      });
    });
  });

  // ── toPublic ───────────────────────────────────────────────────────────────

  describe('toPublic', () => {
    it('returns only id, email, role, emailVerified', () => {
      const result = service.toPublic(baseUser);

      expect(result).toEqual({
        id: baseUser.id,
        email: baseUser.email,
        role: baseUser.role,
        emailVerified: baseUser.emailVerified,
      });
    });

    it('strips passwordHash', () => {
      expect(service.toPublic(baseUser)).not.toHaveProperty('passwordHash');
    });

    it('strips timestamps', () => {
      const result = service.toPublic(baseUser);
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });
});
