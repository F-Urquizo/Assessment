import { createContext, useContext } from 'react';
import type { UserDto } from '../lib/auth-types';

// ── Auth CONTRACT (owned here; Ramiro builds his AuthProvider against THIS) ──
// This interface is the seam between Andrés's per-user features (favourites,
// sell) and Ramiro's auth shell. Ramiro must NOT create a second context — he
// implements a provider that supplies this value. See context/auth-provider.ts.

export interface AuthContextValue {
  user: UserDto | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** In-memory access token (never localStorage). Passed to authed API calls. */
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
