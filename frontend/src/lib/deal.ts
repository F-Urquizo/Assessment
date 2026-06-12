import type { Appraisal } from '../types';
import { fmt } from './format';

export type DealMode = 'buyer' | 'seller';

export type VerdictClass = 'v-great' | 'v-good' | 'v-fair' | 'v-high' | 'v-over';

export interface GuideTile {
  label: string;
  value: string;
  accent: boolean;
}

export interface DealVerdict {
  cls: VerdictClass;
  title: string;
  sub: string;
  delta: number;
  fairPct: number;
  askPct: number;
  guide: GuideTile[];
}

const round50 = (n: number) => Math.round(n / 50) * 50;

function buyerVerdict(
  ask: number,
  { estimate, low, high }: Appraisal,
): Pick<DealVerdict, 'cls' | 'title' | 'sub'> {
  const ratio = ask / estimate;
  if (ask <= low)
    return { cls: 'v-great', title: 'Great deal', sub: 'At or below Bluebook’s low estimate' };
  if (ratio < 0.97)
    return { cls: 'v-good', title: 'Good buy', sub: 'Priced below fair value' };
  if (ratio <= 1.03)
    return { cls: 'v-fair', title: 'Fair price', sub: 'Right around fair value' };
  if (ask <= high)
    return { cls: 'v-high', title: 'A bit high', sub: 'Above fair value but inside the band' };
  return { cls: 'v-over', title: 'Overpriced', sub: 'Above Bluebook’s high estimate' };
}

function sellerVerdict(
  ask: number,
  { estimate, low, high }: Appraisal,
): Pick<DealVerdict, 'cls' | 'title' | 'sub'> {
  const ratio = ask / estimate;
  if (ask >= high)
    return { cls: 'v-over', title: 'Ambitious', sub: 'Above the optimistic ceiling — expect slow interest' };
  if (ratio > 1.03)
    return { cls: 'v-high', title: 'Premium ask', sub: 'Above fair value — room to negotiate down' };
  if (ratio >= 0.97)
    return { cls: 'v-fair', title: 'Market price', sub: 'Right at fair value — balanced' };
  if (ask > low)
    return { cls: 'v-good', title: 'Priced to move', sub: 'Below fair value — should sell faster' };
  return { cls: 'v-great', title: 'Quick-sale price', sub: 'At or below the floor — leaves money on the table' };
}

function buyerGuide(estimate: number, low: number, high: number): GuideTile[] {
  return [
    { label: 'Open offer', value: fmt(round50(Math.max(low, estimate * 0.93))), accent: true },
    { label: 'Fair value', value: fmt(estimate), accent: false },
    { label: 'Walk away above', value: fmt(round50(high)), accent: false },
  ];
}

function sellerGuide(estimate: number, low: number, high: number): GuideTile[] {
  return [
    { label: 'List at', value: fmt(round50(Math.min(high, estimate * 1.06))), accent: true },
    { label: 'Expect to net', value: fmt(estimate), accent: false },
    { label: 'Quick-sale floor', value: fmt(round50(low)), accent: false },
  ];
}

export function evaluateDeal(
  appraisal: Appraisal,
  ask: number,
  mode: DealMode,
): DealVerdict {
  const { estimate, low, high } = appraisal;
  const verdict = mode === 'buyer' ? buyerVerdict(ask, appraisal) : sellerVerdict(ask, appraisal);
  const span = Math.max(high - low, 1);
  return {
    ...verdict,
    delta: ask - estimate,
    fairPct: Math.max(2, Math.min(98, ((estimate - low) / span) * 100)),
    askPct: Math.max(0, Math.min(100, ((ask - low) / span) * 100)),
    guide: mode === 'buyer' ? buyerGuide(estimate, low, high) : sellerGuide(estimate, low, high),
  };
}
