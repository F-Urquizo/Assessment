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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `request to ${path} failed`);
  }
  return data as T;
}

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
export function fetchRecommendations(limit = 8): Promise<RecommendedListing[]> {
  return request<RecommendedListing[]>(`/recommendations?limit=${limit}`);
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
