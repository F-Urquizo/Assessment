import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './crypto/crypto.module';
import { ListingsModule } from './listings/listings.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { FavoritesModule } from './favorites/favorites.module';
import { JwtAuthGuard, RolesGuard, VerifiedGuard } from './auth/guards';
import { ModelController } from './model/model.controller';
import { ModelService } from './model/model.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // 200 req / 60 s per IP globally; login overrides to 5 req / 60 s.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    PrismaModule,
    AuditModule,
    CryptoModule,
    UsersModule,
    AuthModule,
    AdminModule,
    ListingsModule,
    RecommendationsModule,
    FavoritesModule,
  ],
  controllers: [ModelController],
  providers: [
    ModelService,
    // Guard execution order: Throttler → JWT → Roles → Verified.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: VerifiedGuard },
  ],
})
export class AppModule {}
