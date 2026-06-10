import { describe, it, expect } from 'vitest';
import { evaluateDeal } from './deal';
import type { Appraisal } from '../types';

// estimate 20k, band 18k–22k — a clean symmetric appraisal to pin the thresholds.
const appraisal: Appraisal = { estimate: 20000, low: 18000, high: 22000, known_model: true };

describe('evaluateDeal — buyer verdicts', () => {
  it('an ask at/below the floor is a great deal', () => {
    const v = evaluateDeal(appraisal, 18000, 'buyer');
    expect(v.cls).toBe('v-great');
    expect(v.title).toBe('Great deal');
  });

  it('an ask right at the estimate is fair', () => {
    expect(evaluateDeal(appraisal, 20000, 'buyer').cls).toBe('v-fair');
  });

  it('an ask above the ceiling is overpriced', () => {
    expect(evaluateDeal(appraisal, 24000, 'buyer').cls).toBe('v-over');
  });

  it('delta is ask minus estimate', () => {
    expect(evaluateDeal(appraisal, 21000, 'buyer').delta).toBe(1000);
  });
});

describe('evaluateDeal — seller verdicts', () => {
  it('an ask at/above the ceiling is ambitious', () => {
    expect(evaluateDeal(appraisal, 22000, 'seller').cls).toBe('v-over');
  });

  it('an ask below the floor is a quick-sale price', () => {
    expect(evaluateDeal(appraisal, 17000, 'seller').cls).toBe('v-great');
  });
});

describe('evaluateDeal — bar geometry', () => {
  it('clamps askPct into the 0–100 range for an absurd ask', () => {
    const v = evaluateDeal(appraisal, 999999, 'seller');
    expect(v.askPct).toBeLessThanOrEqual(100);
    expect(v.askPct).toBeGreaterThanOrEqual(0);
  });
});
