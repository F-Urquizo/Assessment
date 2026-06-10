import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListingCard from './ListingCard';
import type { Listing } from '../../lib/marketplace-types';

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    manufacturer: 'toyota',
    model: 'camry',
    year: 2020,
    odometer: 41200,
    cylinders: 6,
    condition: 'good',
    fuel: 'gas',
    titleStatus: 'clean',
    transmission: 'automatic',
    drive: 'fwd',
    type: 'sedan',
    paintColor: 'silver',
    state: 'ca',
    askingPrice: 18000,
    description: null,
    contactEmail: 'seller@example.com',
    contactPhone: null,
    status: 'active',
    predictedValue: 21000,
    predictedLow: 19000,
    predictedHigh: 23000,
    dealDeltaPct: -14.29,
    dealBadge: 'under',
    userId: 'u1',
    createdAt: '2026-06-09T09:00:00.000Z',
    updatedAt: '2026-06-09T09:00:00.000Z',
    ...over,
  };
}

describe('ListingCard', () => {
  it('renders the vehicle, asking price and an Under-priced badge with the delta', () => {
    render(<ListingCard listing={listing()} />);

    expect(screen.getByText('2020 TOYOTA CAMRY')).toBeInTheDocument();
    expect(screen.getByText('$18,000')).toBeInTheDocument();
    expect(screen.getByText('Under priced')).toBeInTheDocument();
    expect(screen.getByText('-14%')).toBeInTheDocument();
  });

  it('shows the model value range when the listing is valued', () => {
    render(<ListingCard listing={listing()} />);
    expect(screen.getByText('$21,000')).toBeInTheDocument();
    expect(screen.getByText(/\$19,000–\$23,000/)).toBeInTheDocument();
  });

  it('shows "Not valued yet" and no badge when there is no valuation', () => {
    render(
      <ListingCard
        listing={listing({
          predictedValue: null,
          predictedLow: null,
          predictedHigh: null,
          dealDeltaPct: null,
          dealBadge: null,
        })}
      />,
    );
    expect(screen.getByText('Not valued yet')).toBeInTheDocument();
    expect(screen.queryByText('Under priced')).not.toBeInTheDocument();
  });
});
