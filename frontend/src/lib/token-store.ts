// In-memory mirror of the access token, readable outside React so the 401
// interceptor in auth-request.ts can swap it after a silent refresh. Memory
// only — never localStorage/sessionStorage (see docs/API_CONTRACT.md).
let accessToken: string | null = null;
let listener: ((token: string | null) => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

/** Update the token and notify the AuthProvider (if mounted). */
export function setAccessToken(token: string | null): void {
  accessToken = token;
  listener?.(token);
}

/**
 * AuthProvider registers here so interceptor-driven refreshes (and refresh
 * failures → forced logout) flow back into React state. Single subscriber —
 * there is exactly one provider.
 */
export function onTokenChange(
  fn: ((token: string | null) => void) | null,
): void {
  listener = fn;
}
