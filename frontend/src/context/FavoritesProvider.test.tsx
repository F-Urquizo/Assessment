import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockAuthProvider } from './MockAuthProvider';
import { FavoritesProvider } from './FavoritesProvider';
import { useFavorites } from './FavoritesContext';
import type { Listing } from '../lib/marketplace-types';

function makeListing(id: string): Listing {
  return {
    id,
    manufacturer: 'toyota',
    model: 'camry',
    year: 2020,
    odometer: 40000,
    cylinders: 4,
    condition: 'good',
    fuel: 'gas',
    titleStatus: 'clean',
    transmission: 'automatic',
    drive: 'fwd',
    type: 'sedan',
    paintColor: 'white',
    state: 'ca',
    askingPrice: 20000,
    description: null,
    contactEmail: 'a@b.c',
    contactPhone: null,
    status: 'active',
    predictedValue: 21000,
    predictedLow: 19000,
    predictedHigh: 23000,
    dealDeltaPct: -5,
    dealBadge: 'fair',
    userId: 'u1',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };
}

function Probe({ listing }: { listing: Listing }) {
  const { isFavorite, toggle, favorites } = useFavorites();
  return (
    <button onClick={() => toggle(listing)}>
      {isFavorite(listing.id) ? 'saved' : 'save'} · {favorites.length}
    </button>
  );
}

describe('FavoritesProvider', () => {
  it('toggles a listing in and out of favourites (optimistic, offline-safe)', async () => {
    const listing = makeListing('l1');
    render(
      <MockAuthProvider>
        <FavoritesProvider>
          <Probe listing={listing} />
        </FavoritesProvider>
      </MockAuthProvider>,
    );

    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('save · 0');

    await userEvent.click(btn);
    expect(btn).toHaveTextContent('saved · 1');

    await userEvent.click(btn);
    expect(btn).toHaveTextContent('save · 0');
  });
});
