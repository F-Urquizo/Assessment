import { Test } from '@nestjs/testing';
import { AuditEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

const prismaMock = {
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
};

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(AuditService);
    jest.clearAllMocks();
    prismaMock.auditLog.create.mockResolvedValue({});
  });

  it('creates a row with the expected fields', async () => {
    await service.log({
      event: AuditEvent.login_success,
      userId: 'user-id',
      ip: '127.0.0.1',
      userAgent: 'jest',
      metadata: { foo: 'bar' },
    });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: AuditEvent.login_success,
        userId: 'user-id',
        ip: '127.0.0.1',
        userAgent: 'jest',
        metadata: { foo: 'bar' },
      }),
    });
  });

  it('stores null for missing userId, ip, userAgent', async () => {
    await service.log({ event: AuditEvent.login_failure });

    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: null,
        ip: null,
        userAgent: null,
      }),
    });
  });

  it('does not throw when the DB write fails (best-effort)', async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error('DB unavailable'));

    await expect(
      service.log({ event: AuditEvent.login_success, userId: 'uid' }),
    ).resolves.toBeUndefined();
  });
});
