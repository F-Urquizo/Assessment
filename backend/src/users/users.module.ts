import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

// No controller — UsersModule is a data layer, not a route handler.
// PrismaModule is @Global() so PrismaService is injectable here without
// listing it in imports.
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
