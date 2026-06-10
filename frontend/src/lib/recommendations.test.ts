import { describe, it, expect } from 'vitest';
import { buildWhy, dealScore } from './recommendations-types';
import { mockRecommendations } from './recommendations-mock';

describe('dealScore', () => {
  it('maps a 20% discount to 1.0, a 20% markup to 0.0, parity to 0.5', () => {
    expect(dealScore(-20)).toBe(1);
    expect(dealScore(20)).toBe(0);
    expect(dealScore(0)).toBe(0.5);
  });
});

describe('buildWhy', () => {
  it('calls a 10%+ discount a great deal', () => {
    expect(buildWhy(-14)).toMatch(/great deal/i);
  });
  it('describes a small markup as fairly priced', () => {
    expect(buildWhy(4)).toMatch(/fairly priced/i);
  });
});

describe('mockRecommendations', () => {
  it('returns only valued listings, best deal first, within the limit', () => {
    const recs = mockRecommendations(4);
    expect(recs.length).toBeLessThanOrEqual(4);
    expect(recs.every((r) => r.listing.dealDeltaPct !== null)).toBe(true);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score);
    }
  });
});
