import { Injectable } from '@nestjs/common';
import { AuditEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export { AuditEvent };

export interface AuditCtx {
  ip?: string;
  userAgent?: string;
}

interface LogParams extends AuditCtx {
  event: AuditEvent;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Best-effort: a log failure must NEVER propagate to the caller.
  async log(params: LogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          event: params.event,
          userId: params.userId ?? null,
          ip: params.ip ?? null,
          userAgent: params.userAgent ?? null,
          metadata: params.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (e) {
      console.error('[AuditService] Failed to write log entry:', e);
    }
  }
}
