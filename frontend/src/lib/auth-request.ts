// Authenticated fetch seam (Ramiro's territory). Attaches the bearer access
// token and sends cookies. Callers pass the current token from useAuth().
//
// 401 interceptor: access tokens live 15 minutes, so an authed call can fail
// mid-session. On 401 this does ONE silent refresh against /auth/refresh
// (single-flight — concurrent 401s share the same refresh) and retries the
// request with the new token. If the refresh itself fails the token store is
// cleared, which the AuthProvider observes as a forced logout.
import { setAccessToken } from './token-store';

function doFetch(
  path: string,
  token: string | null,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(path, { ...init, headers, credentials: 'include' });
}

let refreshInFlight: Promise<string | null> | null = null;

/** One refresh at a time; resolves the new token or null if the session died. */
function silentRefresh(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { accessToken?: string };
        return data.accessToken ?? null;
      })
      .catch(() => null)
      .then((token) => {
        refreshInFlight = null;
        setAccessToken(token); // null → AuthProvider clears the session
        return token;
      });
  }
  return refreshInFlight;
}

export async function authRequest<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<T> {
  let res = await doFetch(path, token, init);

  if (res.status === 401) {
    const fresh = await silentRefresh();
    if (fresh) res = await doFetch(path, fresh, init);
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { message?: string }).message || `request to ${path} failed`,
    );
  }
  return data as T;
}
