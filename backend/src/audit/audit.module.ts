import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// @Global so AuditService can be injected anywhere after AppModule imports this
// module — no need to re-list AuditModule in every feature module's imports.
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
