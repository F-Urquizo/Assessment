import { SetMetadata } from '@nestjs/common';

export const VERIFIED_KEY = 'requiresVerified';
/** Require emailVerified = true. VerifiedGuard enforces this. */
export const Verified = () => SetMetadata(VERIFIED_KEY, true);
