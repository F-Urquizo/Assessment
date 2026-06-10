import { ListingsService, ListingView } from '../listings/listings.service';
import {
  RecommendationsService,
  buildWhy,
  dealScore,
} from './recommendations.service';

// Minimal ListingView factory — only the fields the recommender reads matter;
// the rest are filled with plausible defaults.
function view(over: Partial<ListingView>): ListingView {
  return {
    id: 'x',
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
    dealDeltaPct: 0,
    dealBadge: 'fair',
    userId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as ListingView;
}

function serviceWith(listings: ListingView[]): RecommendationsService {
  const stub = { findActive: jest.fn().mockResolvedValue(listings) };
  return new RecommendationsService(stub as unknown as ListingsService);
}

describe('RecommendationsService.topPicks', () => {
  it('ranks the most under-priced listing first', async () => {
    const svc = serviceWith([
      view({ id: 'over', dealDeltaPct: 12 }),
      view({ id: 'under', dealDeltaPct: -15 }),
      view({ id: 'fair', dealDeltaPct: 2 }),
    ]);
    const recs = await svc.topPicks();
    expect(recs.map((r) => r.listing.id)).toEqual(['under', 'fair', 'over']);
  });

  it('excludes unvalued listings (no dealDeltaPct)', async () => {
    const svc = serviceWith([
      view({ id: 'valued', dealDeltaPct: -5 }),
      view({ id: 'unvalued', dealDeltaPct: null }),
    ]);
    const recs = await svc.topPicks();
    expect(recs).toHaveLength(1);
    expect(recs[0].listing.id).toBe('valued');
  });

  it('honours the limit (clamped to 1..24)', async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      view({ id: `l${i}`, dealDeltaPct: -i }),
    );
    const svc = serviceWith(many);
    expect(await svc.topPicks({ limit: 3 })).toHaveLength(3);
  });

  it('attaches a score and a why string to each pick', async () => {
    const svc = serviceWith([view({ id: 'a', dealDeltaPct: -14 })]);
    const [rec] = await svc.topPicks();
    expect(rec.score).toBeGreaterThan(0.5);
    expect(rec.why).toMatch(/below the model/i);
  });
});

describe('dealScore', () => {
  it('maps a 20% discount to 1.0 and a 20% markup to 0.0', () => {
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
