import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserDto } from '../lib/auth-types';
import { AuthContext, type AuthContextValue } from './AuthContext';
import {
  login as apiLogin,
  logout as apiLogout,
  refreshAccessToken,
} from '../lib/api';
import { onTokenChange, setAccessToken as storeToken } from '../lib/token-store';

// The access token lives in React state only (never localStorage — XSS vector;
// see docs/API_CONTRACT.md). It is lost on reload by design: the httpOnly
// refresh cookie silently renews it on startup.
//
// /auth/refresh returns only { accessToken } and there is no /auth/me, so the
// UserDto cannot be rebuilt from the API after a reload. The profile (id,
// email, role — no secrets) is cached in sessionStorage and only trusted when
// the refresh call succeeds; a failed refresh discards it.
const USER_CACHE_KEY = 'auth.user';

function readCachedUser(): UserDto | null {
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserDto) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep React state in sync with the token store: the 401 interceptor in
  // auth-request.ts refreshes tokens (or kills the session) outside React.
  useEffect(() => {
    onTokenChange((token) => {
      setAccessToken(token);
      if (!token) {
        sessionStorage.removeItem(USER_CACHE_KEY);
        setUser(null);
      }
    });
    return () => onTokenChange(null);
  }, []);

  // Silent session restore on startup: if the refresh cookie is still valid we
  // get a fresh access token; otherwise the user is simply logged out.
  useEffect(() => {
    let cancelled = false;
    refreshAccessToken()
      .then(({ accessToken }) => {
        if (cancelled) return;
        storeToken(accessToken);
        setUser(readCachedUser());
      })
      .catch(() => {
        sessionStorage.removeItem(USER_CACHE_KEY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await apiLogin(email, password);
    sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    storeToken(accessToken);
    setUser(user);
  }, []);

  const logout = useCallback(async () => {
    // Clear local state even if the server call fails — the worst case is an
    // orphaned refresh token that expires on its own.
    try {
      await apiLogout();
    } finally {
      storeToken(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      loading,
      accessToken,
      login,
      logout,
    }),
    [user, loading, accessToken, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
