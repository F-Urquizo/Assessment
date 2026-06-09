// Auth API types — mirrors the backend DTOs in backend/src/auth/dto/*.ts
//
// There is no formal monorepo, so these types are maintained manually in sync
// with the backend. When a DTO field changes, update both files and the
// API_CONTRACT.md table. The backend is the source of truth.
//
// NADA ES IMPLEMENTADO AQUI — this file is consumed by future auth context
// and API call wrappers added to lib/api.ts.

/**
 * Public user shape returned by all auth endpoints.
 * Matches the Prisma User model minus passwordHash and timestamps.
 * Field names and types must stay aligned with schema.prisma.
 */
export interface UserDto {
  id: string;
  email: string;            // always lowercase
  role: 'user' | 'admin';
  emailVerified: boolean;
}

/**
 * NestJS default error envelope.
 * `message` is a string[] when class-validator fires (validation errors),
 * a plain string for all other errors.
 */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

// ─── Request bodies ───────────────────────────────────────────────────────────

export interface RegisterBody {
  email: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

// refresh and logout carry no body; verify-email uses a query param

// ─── Response shapes ─────────────────────────────────────────────────────────

/** POST /auth/register → 201 */
export interface RegisterResponse {
  user: UserDto;
}

/**
 * POST /auth/login → 200
 * accessToken must be stored IN MEMORY ONLY — not localStorage, not
 * sessionStorage. The refresh token travels only in the httpOnly cookie
 * and is never readable from JavaScript.
 */
export interface LoginResponse {
  accessToken: string;
  user: UserDto;
}

/** POST /auth/refresh → 200 */
export interface RefreshResponse {
  accessToken: string;
}

// POST /auth/logout → 204, no body

/** GET /auth/verify-email?token=... → 200 */
export interface VerifyEmailResponse {
  message: string;
}

// ─── Validation constants (mirror backend class-validator rules) ───────────────

/** Minimum password length enforced by the backend DTO. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Regex used by the frontend to pre-validate email format.
 * The backend uses class-validator's @IsEmail() which follows RFC 5322.
 * This is a pragmatic subset sufficient for UX feedback.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
