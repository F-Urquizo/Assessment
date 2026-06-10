import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Listing } from '../lib/marketplace-types';
import { addFavorite, fetchFavorites, removeFavorite } from '../lib/api';
import { useAuth } from './AuthContext';
import { FavoritesContext, type FavoritesContextValue } from './FavoritesContext';

/**
 * Favourites state for the marketplace (Fran's slice, frontend). Hydrates from
 * GET /favorites when logged in and mutates via POST/DELETE — but updates are
 * optimistic and API failures are swallowed, so the ♥ still works against the
 * mock auth / offline. The auth token comes from the AuthContext seam.
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, accessToken } = useAuth();
  const [favorites, setFavorites] = useState<Listing[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Logged in → hydrate from the server (empty on failure); logged out → clear.
    // Resolving through one promise keeps all setState calls async (lint rule).
    const load = isAuthenticated
      ? fetchFavorites(accessToken).catch(() => [] as Listing[])
      : Promise.resolve<Listing[]>([]);
    load.then((list) => {
      if (!cancelled) setFavorites(Array.isArray(list) ? list : []);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken]);

  const ids = useMemo(() => new Set(favorites.map((l) => l.id)), [favorites]);

  const add = useCallback(
    (listing: Listing) => {
      setFavorites((prev) =>
        prev.some((l) => l.id === listing.id) ? prev : [listing, ...prev],
      );
      addFavorite(listing.id, accessToken).catch(() => {});
    },
    [accessToken],
  );

  const remove = useCallback(
    (id: string) => {
      setFavorites((prev) => prev.filter((l) => l.id !== id));
      removeFavorite(id, accessToken).catch(() => {});
    },
    [accessToken],
  );

  const toggle = useCallback(
    (listing: Listing) => {
      if (ids.has(listing.id)) remove(listing.id);
      else add(listing);
    },
    [ids, add, remove],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, isFavorite: (id) => ids.has(id), toggle }),
    [favorites, ids, toggle],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}
