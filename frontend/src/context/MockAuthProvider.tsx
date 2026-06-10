import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { UserDto } from '../lib/auth-types';
import { AuthContext, type AuthContextValue } from './AuthContext';

// Stand-in for Ramiro's real AuthProvider. Provides a logged-in, verified user
// and a fake token so per-user features (favourites) are reviewable before the
// real auth shell lands. Ramiro never edits this file — he adds AuthProvider.tsx
// and flips the one line in auth-provider.ts.
const MOCK_USER: UserDto = {
  id: 'mock-seller',
  email: 'andres@dev.local',
  role: 'user',
  emailVerified: true,
};

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(MOCK_USER);

  const login = useCallback(async () => setUser(MOCK_USER), []);
  const logout = useCallback(async () => setUser(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      loading: false,
      accessToken: user ? 'mock-access-token' : null,
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
