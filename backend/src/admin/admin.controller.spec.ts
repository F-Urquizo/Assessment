import { Test } from '@nestjs/testing';
import { AuditEvent, Role } from '@prisma/client';
import { ROLES_KEY } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';
import { AdminController } from './admin.controller';

const now = new Date();

const sampleRows = [
  { id: 'c1', userId: 'u1', event: AuditEvent.login_success, ip: '1.2.3.4', userAgent: 'browser', metadata: null, createdAt: now },
  { id: 'c2', userId: null, event: AuditEvent.login_failure, ip: null, userAgent: null, metadata: { email: 'x@y.com' }, createdAt: new Date(now.getTime() - 1000) },
];

const prismaMock = {
  auditLog: {
    findMany: jest.fn().mockResolvedValue(sampleRows),
    count: jest.fn().mockResolvedValue(2),
  },
};

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: PrismaService, useValue: prismaMock }],
    }).compile();

    controller = module.get(AdminController);
    jest.clearAllMocks();
    prismaMock.auditLog.findMany.mockResolvedValue(sampleRows);
    prismaMock.auditLog.count.mockResolvedValue(2);
  });

  // ── @Roles guard metadata ──────────────────────────────────────────────────

  it('has @Roles(Role.admin) applied at the class level', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminController);
    expect(roles).toContain(Role.admin);
  });

  // ── GET /admin/audit-log ──────────────────────────────────────────────────

  describe('GET /admin/audit-log', () => {
    it('returns items ordered newest-first with total, limit, offset', async () => {
      const result = await controller.getAuditLog();

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toMatchObject({ items: sampleRows, total: 2, limit: 50, offset: 0 });
    });

    it('defaults to limit=50 and offset=0 when no query params provided', async () => {
      await controller.getAuditLog();

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50, skip: 0 }),
      );
    });

    it('respects custom limit and offset', async () => {
      await controller.getAuditLog('10', '20');

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });

    it('caps limit at 200', async () => {
      await controller.getAuditLog('999');

      const call = (prismaMock.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(call.take).toBe(200);
    });

    it('filters by userId when provided', async () => {
      await controller.getAuditLog(undefined, undefined, 'user-abc');

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-abc' }) }),
      );
    });

    it('filters by event when a valid AuditEvent is provided', async () => {
      await controller.getAuditLog(undefined, undefined, undefined, 'login_success');

      expect(prismaMock.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ event: AuditEvent.login_success }) }),
      );
    });

    it('ignores unknown event strings (no filter applied)', async () => {
      await controller.getAuditLog(undefined, undefined, undefined, 'not_a_real_event');

      const call = (prismaMock.auditLog.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where).not.toHaveProperty('event');
    });
  });
});
