import { describe, it, expect } from 'vitest';
import { mockBrowse, mockListingDetail } from './marketplace-mock';

describe('mockBrowse', () => {
  it('filters by make and returns only active listings', () => {
    const { items } = mockBrowse({ make: 'toyota' });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((l) => l.manufacturer === 'toyota')).toBe(true);
    expect(items.every((l) => l.status === 'active')).toBe(true);
  });

  it('sorts by best deal (most under-priced first, nulls last)', () => {
    const { items } = mockBrowse({ sort: 'bestDeal' });
    const valued = items.filter((l) => l.dealDeltaPct !== null);
    for (let i = 1; i < valued.length; i++) {
      expect(valued[i - 1].dealDeltaPct!).toBeLessThanOrEqual(valued[i].dealDeltaPct!);
    }
  });
});

describe('mockListingDetail', () => {
  it('returns a listing with a price history for a known id', () => {
    const detail = mockListingDetail('mock-1');
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe('mock-1');
    expect(detail!.priceHistory.length).toBeGreaterThan(0);
  });

  it('returns null for an unknown id', () => {
    expect(mockListingDetail('does-not-exist')).toBeNull();
  });
});
