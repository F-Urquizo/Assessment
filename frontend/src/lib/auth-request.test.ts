import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authRequest } from './auth-request';
import { getAccessToken, onTokenChange, setAccessToken } from './token-store';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('authRequest 401 interceptor', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(null);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    onTokenChange(null);
  });

  it('passes through a successful request without refreshing', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [{ id: 'l1' }]));

    const result = await authRequest<{ id: string }[]>('/favorites', 'tok-1');

    expect(result).toEqual([{ id: 'l1' }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok-1');
    expect(init?.credentials).toBe('include');
  });

  it('on 401: refreshes silently and retries once with the new token', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'tok-fresh' }))
      .mockResolvedValueOnce(jsonResponse(200, { favorited: true }));

    const result = await authRequest<{ favorited: boolean }>(
      '/favorites',
      'tok-expired',
      { method: 'POST', body: '{"listingId":"l1"}' },
    );

    expect(result).toEqual({ favorited: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // 2nd call is the refresh
    expect(fetchMock.mock.calls[1][0]).toBe('/auth/refresh');
    // 3rd call retries the original request with the fresh token
    const [retryPath, retryInit] = fetchMock.mock.calls[2];
    expect(retryPath).toBe('/favorites');
    expect(new Headers(retryInit?.headers).get('Authorization')).toBe(
      'Bearer tok-fresh',
    );
    // The token store saw the new token (AuthProvider syncs from here)
    expect(getAccessToken()).toBe('tok-fresh');
  });

  it('on 401 with dead session: refresh fails, token store cleared, error thrown', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthorized' }));

    setAccessToken('tok-zombie');
    const seen: Array<string | null> = [];
    onTokenChange((t) => seen.push(t));

    await expect(authRequest('/favorites', 'tok-zombie')).rejects.toThrow(
      'Unauthorized',
    );
    // No retry without a fresh token: original + refresh only
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Forced-logout signal: provider observes the cleared token
    expect(getAccessToken()).toBeNull();
    expect(seen).toContain(null);
  });

  it('single-flight: concurrent 401s share one refresh call', async () => {
    let resolveRefresh!: (r: Response) => void;
    const refreshGate = new Promise<Response>((r) => {
      resolveRefresh = r;
    });

    fetchMock.mockImplementation((input, init) => {
      const path = String(input);
      if (path === '/auth/refresh') return refreshGate;
      const token = new Headers(init?.headers).get('Authorization');
      return Promise.resolve(
        token === 'Bearer tok-fresh'
          ? jsonResponse(200, { ok: true })
          : jsonResponse(401, { message: 'Unauthorized' }),
      );
    });

    const a = authRequest('/favorites', 'tok-expired');
    const b = authRequest('/listings/mine', 'tok-expired');
    // Let both hit their 401 and queue on the refresh, then release it.
    await new Promise((r) => setTimeout(r, 0));
    resolveRefresh(jsonResponse(200, { accessToken: 'tok-fresh' }));

    await expect(a).resolves.toEqual({ ok: true });
    await expect(b).resolves.toEqual({ ok: true });

    const refreshCalls = fetchMock.mock.calls.filter(
      ([input]) => String(input) === '/auth/refresh',
    );
    expect(refreshCalls).toHaveLength(1);
  });
});
