// Runs in the Jest worker (setupFiles) — before any module is imported.
// Overrides DATABASE_URL so PrismaService connects to the test DB,
// not the dev DB. All other vars fall through to .env via ConfigModule.
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.test'),
  override: true,
});
