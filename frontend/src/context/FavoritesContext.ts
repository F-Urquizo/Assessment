import { createContext, useContext } from 'react';
import type { Listing } from '../lib/marketplace-types';

export interface FavoritesContextValue {
  favorites: Listing[];
  isFavorite: (id: string) => boolean;
  toggle: (listing: Listing) => void;
}

export const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx)
    throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
