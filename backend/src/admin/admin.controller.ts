import { Controller, Get, Query } from '@nestjs/common';
import { AuditEvent, Prisma, Role } from '@prisma/client';
import { Roles } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin')
@Roles(Role.admin)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('audit-log')
  async getAuditLog(
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
    @Query('userId') userId?: string,
    @Query('event') event?: string,
  ) {
    const take = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200);
    const skip = Math.max(parseInt(offsetStr ?? '0', 10) || 0, 0);

    const where: Prisma.AuditLogWhereInput = {};
    if (userId) where.userId = userId;
    if (event && Object.values(AuditEvent).includes(event as AuditEvent)) {
      where.event = event as AuditEvent;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, limit: take, offset: skip };
  }
}
