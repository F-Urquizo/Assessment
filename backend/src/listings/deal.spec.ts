import { computeDealDeltaPct, dealBadge, DEAL_THRESHOLD_PCT } from './deal';

describe('computeDealDeltaPct', () => {
  it('is negative when asking is below predicted (a good deal)', () => {
    expect(computeDealDeltaPct(9000, 10000)).toBe(-10);
  });

  it('is positive when asking is above predicted', () => {
    expect(computeDealDeltaPct(11000, 10000)).toBe(10);
  });

  it('is zero when asking equals predicted', () => {
    expect(computeDealDeltaPct(10000, 10000)).toBe(0);
  });

  it('rounds to two decimal places', () => {
    // (10333 - 10000) / 10000 * 100 = 3.33
    expect(computeDealDeltaPct(10333, 10000)).toBe(3.33);
  });

  it('returns null when predicted value is missing', () => {
    expect(computeDealDeltaPct(10000, null)).toBeNull();
  });

  it('returns null when predicted value is zero (avoids divide-by-zero)', () => {
    expect(computeDealDeltaPct(10000, 0)).toBeNull();
  });
});

describe('dealBadge', () => {
  it('is "under" at or below the negative threshold', () => {
    expect(dealBadge(-DEAL_THRESHOLD_PCT)).toBe('under');
    expect(dealBadge(-25)).toBe('under');
  });

  it('is "over" at or above the positive threshold', () => {
    expect(dealBadge(DEAL_THRESHOLD_PCT)).toBe('over');
    expect(dealBadge(25)).toBe('over');
  });

  it('is "fair" strictly inside the threshold band', () => {
    expect(dealBadge(0)).toBe('fair');
    expect(dealBadge(-(DEAL_THRESHOLD_PCT - 0.01))).toBe('fair');
    expect(dealBadge(DEAL_THRESHOLD_PCT - 0.01)).toBe('fair');
  });

  it('is null when there is no delta', () => {
    expect(dealBadge(null)).toBeNull();
  });
});
