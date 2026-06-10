// Authenticated fetch seam (Ramiro's territory). Attaches the bearer access
// token and sends cookies. Callers pass the current token from useAuth(). Ramiro
// can evolve this — e.g. add silent-refresh on 401 — without touching callers.
export async function authRequest<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message || `request to ${path} failed`,
    );
  }
  return data as T;
}
