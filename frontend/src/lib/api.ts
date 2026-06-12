import type { Analysis, CompareResult, Options, Payload } from '../types';
import type {
  BrowseQuery,
  BrowseResult,
  Listing,
  ListingDetail,
  ListingInput,
} from './marketplace-types';
import type { RecommendedListing } from './recommendations-types';
import { authRequest } from './auth-request';
import type {
  LoginResponse,
  RefreshResponse,
  RegisterResponse,
  VerifyEmailResponse,
} from './auth-types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `request to ${path} failed`);
  }
  return data as T;
}

type RawRecommendedListing = Listing & {
  score: number;
  why: string;
};

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchOptions(): Promise<Options> {
  return request<Options>('/options');
}

export function analyze(payload: Payload): Promise<Analysis> {
  return postJson<Analysis>('/analyze', payload);
}

export function compare(
  vehicles: Array<Payload & { _label: string }>,
): Promise<{ results: CompareResult[] }> {
  return postJson<{ results: CompareResult[] }>('/compare', { vehicles });
}

/** Serialises a browse query, dropping empty/undefined params. */
function toQueryString(query: BrowseQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** GET /listings — filtered, sorted, paged marketplace listings (public). */
export function fetchListings(query: BrowseQuery = {}): Promise<BrowseResult> {
  return request<BrowseResult>(`/listings${toQueryString(query)}`);
}

/** GET /recommendations — top-N best-deal active listings with a "why" (public). */
export async function fetchRecommendations(limit = 8): Promise<RecommendedListing[]> {
  const recs = await request<RawRecommendedListing[]>(
    `/recommendations?limit=${limit}`,
  );
  return recs.map(({ score, why, ...listing }) => ({ listing, score, why }));
}

/** GET /listings/:id — full listing detail incl. price history (public). */
export function fetchListing(id: string): Promise<ListingDetail> {
  return request<ListingDetail>(`/listings/${encodeURIComponent(id)}`);
}

// ── Favourites (require auth — token from useAuth via the auth-request seam) ──

/** GET /favorites — the current user's saved listings. */
export function fetchFavorites(token: string | null): Promise<Listing[]> {
  return authRequest<Listing[]>('/favorites', token);
}

/** POST /favorites — favourite a listing. */
export function addFavorite(
  listingId: string,
  token: string | null,
): Promise<{ favorited: true }> {
  return authRequest('/favorites', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId }),
  });
}

/** DELETE /favorites/:id — un-favourite a listing. */
export function removeFavorite(
  listingId: string,
  token: string | null,
): Promise<void> {
  return authRequest<void>(`/favorites/${encodeURIComponent(listingId)}`, token, {
    method: 'DELETE',
  });
}

// ── My listings / Sell (require auth) ──

/** GET /listings/mine — the current user's listings, any status. */
export function fetchMyListings(token: string | null): Promise<Listing[]> {
  return authRequest<Listing[]>('/listings/mine', token);
}

/** POST /listings — create a listing. */
export function createListing(
  input: ListingInput,
  token: string | null,
): Promise<Listing> {
  return authRequest<Listing>('/listings', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** PATCH /listings/:id — update a listing. */
export function updateListing(
  id: string,
  input: Partial<ListingInput>,
  token: string | null,
): Promise<Listing> {
  return authRequest<Listing>(`/listings/${encodeURIComponent(id)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/** DELETE /listings/:id — delete a listing. */
export function deleteListing(id: string, token: string | null): Promise<void> {
  return authRequest<void>(`/listings/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
}

// ── Auth (Ramiro) — see docs/API_CONTRACT.md ─────────────────────────────────
//
// These use their own helper instead of request<T>() because auth pages must
// branch on the HTTP status (401 invalid credentials, 403 unverified, 409
// email taken, 422 validation list) and NestJS puts the human message in
// `message`, not `error`. All auth calls send credentials so the httpOnly
// refresh cookie travels with them.

/** Error carrying the NestJS envelope so callers can branch on statusCode. */
export class AuthApiError extends Error {
  readonly statusCode: number;
  /** string[] when class-validator fires, plain string otherwise. */
  readonly messages: string | string[];

  constructor(statusCode: number, messages: string | string[]) {
    super(Array.isArray(messages) ? messages.join('. ') : messages);
    this.name = 'AuthApiError';
    this.statusCode = statusCode;
    this.messages = messages;
  }
}

async function authJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, credentials: 'include' });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as { statusCode?: number; message?: string | string[] };
    throw new AuthApiError(
      body.statusCode ?? res.status,
      body.message ?? `request to ${path} failed`,
    );
  }
  return data as T;
}

function authPost<T>(path: string, body?: unknown): Promise<T> {
  return authJson<T>(path, {
    method: 'POST',
    ...(body !== undefined && {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
}

/** POST /auth/register → 201. No tokens issued; user must verify email then log in. */
export function register(email: string, password: string): Promise<RegisterResponse> {
  return authPost<RegisterResponse>('/auth/register', { email, password });
}

/** POST /auth/login → 200 with access token (memory only) + httpOnly refresh cookie. */
export function login(email: string, password: string): Promise<LoginResponse> {
  return authPost<LoginResponse>('/auth/login', { email, password });
}

/** POST /auth/refresh → 200. Rotates the refresh cookie, returns a new access token. */
export function refreshAccessToken(): Promise<RefreshResponse> {
  return authPost<RefreshResponse>('/auth/refresh');
}

/** POST /auth/logout → 204. Revokes the refresh token and clears the cookie. */
export function logout(): Promise<void> {
  return authPost<void>('/auth/logout');
}

/** GET /auth/verify-email?token=... → 200, or 400/410 for invalid/expired/used. */
export function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  return authJson<VerifyEmailResponse>(
    `/auth/verify-email?token=${encodeURIComponent(token)}`,
  );
}

/** POST /auth/resend-verification → 202 always (never reveals whether the
 *  account exists). Re-sends the verification link for an unverified account. */
export function resendVerification(email: string): Promise<{ ok: true }> {
  return authPost<{ ok: true }>('/auth/resend-verification', { email });
}
