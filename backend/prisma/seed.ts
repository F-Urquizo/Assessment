import { PrismaClient, ListingStatus, PriceChangeReason } from '@prisma/client';
import * as argon2 from 'argon2';

// Dev seed: a handful of verified users and active marketplace listings so the
// app shows real data end-to-end without the model-service running (valuations
// are pre-computed here). Idempotent — re-running replaces the demo listings.
// Run with: npx prisma db seed   (after Postgres is up + migrations applied)

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';
const USERS = ['alice@demo.test', 'bob@demo.test', 'carol@demo.test'];

interface SeedListing {
  owner: string;
  manufacturer: string;
  model: string;
  year: number;
  odometer: number;
  cylinders: number | null;
  condition: string;
  fuel: string;
  titleStatus: string;
  transmission: string;
  drive: string;
  type: string;
  paintColor: string;
  state: string;
  askingPrice: number;
  description: string;
  predictedValue: number | null;
  predictedLow: number | null;
  predictedHigh: number | null;
  dealDeltaPct: number | null;
  createdAt: string;
}

// 12 listings across 3 sellers — a spread of Under / Fair / Over / not-yet-valued.
const LISTINGS: SeedListing[] = [
  { owner: 'alice@demo.test', manufacturer: 'toyota', model: 'camry', year: 2020, odometer: 41200, cylinders: 4, condition: 'good', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: 'fwd', type: 'sedan', paintColor: 'silver', state: 'ca', askingPrice: 18000, description: 'One owner, clean Carfax, new tires.', predictedValue: 21000, predictedLow: 19000, predictedHigh: 23000, dealDeltaPct: -14.29, createdAt: '2026-06-09T09:00:00Z' },
  { owner: 'bob@demo.test', manufacturer: 'ford', model: 'f-150', year: 2019, odometer: 58800, cylinders: 6, condition: 'good', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: 'rwd', type: 'truck', paintColor: 'blue', state: 'tx', askingPrice: 32000, description: 'Tow package, bed liner, well maintained.', predictedValue: 31000, predictedLow: 28000, predictedHigh: 34000, dealDeltaPct: 3.23, createdAt: '2026-06-08T15:30:00Z' },
  { owner: 'carol@demo.test', manufacturer: 'honda', model: 'civic', year: 2021, odometer: 22100, cylinders: 4, condition: 'excellent', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: 'fwd', type: 'sedan', paintColor: 'red', state: 'ny', askingPrice: 24000, description: 'Low miles, still under warranty.', predictedValue: 21000, predictedLow: 19000, predictedHigh: 23000, dealDeltaPct: 14.29, createdAt: '2026-06-07T11:10:00Z' },
  { owner: 'alice@demo.test', manufacturer: 'tesla', model: 'model 3', year: 2022, odometer: 18400, cylinders: null, condition: 'excellent', fuel: 'electric', titleStatus: 'clean', transmission: 'automatic', drive: 'rwd', type: 'sedan', paintColor: 'white', state: 'ca', askingPrice: 33000, description: 'Long range, autopilot, garage kept.', predictedValue: 38000, predictedLow: 35000, predictedHigh: 41000, dealDeltaPct: -13.16, createdAt: '2026-06-06T18:45:00Z' },
  { owner: 'bob@demo.test', manufacturer: 'chevrolet', model: 'silverado', year: 2018, odometer: 72500, cylinders: 8, condition: 'good', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: '4wd', type: 'truck', paintColor: 'black', state: 'fl', askingPrice: 28000, description: 'Strong runner, recent service.', predictedValue: 27500, predictedLow: 25000, predictedHigh: 30000, dealDeltaPct: 1.82, createdAt: '2026-06-05T08:20:00Z' },
  { owner: 'carol@demo.test', manufacturer: 'bmw', model: '330i', year: 2019, odometer: 39000, cylinders: 4, condition: 'good', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: 'rwd', type: 'sedan', paintColor: 'blue', state: 'wa', askingPrice: 31000, description: 'Sport package, premium sound.', predictedValue: 27000, predictedLow: 24000, predictedHigh: 30000, dealDeltaPct: 14.81, createdAt: '2026-06-04T14:00:00Z' },
  { owner: 'alice@demo.test', manufacturer: 'toyota', model: 'rav4', year: 2020, odometer: 47300, cylinders: 4, condition: 'good', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: '4wd', type: 'suv', paintColor: 'silver', state: 'tx', askingPrice: 26000, description: 'AWD, roof rails, family SUV.', predictedValue: 28000, predictedLow: 25000, predictedHigh: 31000, dealDeltaPct: -7.14, createdAt: '2026-06-03T16:40:00Z' },
  { owner: 'bob@demo.test', manufacturer: 'honda', model: 'cr-v', year: 2017, odometer: 81000, cylinders: 4, condition: 'fair', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: 'fwd', type: 'suv', paintColor: 'white', state: 'ca', askingPrice: 19000, description: 'Higher miles but reliable.', predictedValue: 22000, predictedLow: 20000, predictedHigh: 24000, dealDeltaPct: -13.64, createdAt: '2026-06-02T10:05:00Z' },
  { owner: 'carol@demo.test', manufacturer: 'ford', model: 'mustang', year: 2021, odometer: 15600, cylinders: 8, condition: 'excellent', fuel: 'gas', titleStatus: 'clean', transmission: 'manual', drive: 'rwd', type: 'coupe', paintColor: 'red', state: 'fl', askingPrice: 41000, description: 'GT, manual, barely driven.', predictedValue: 39000, predictedLow: 35000, predictedHigh: 43000, dealDeltaPct: 5.13, createdAt: '2026-06-01T19:25:00Z' },
  { owner: 'alice@demo.test', manufacturer: 'chevrolet', model: 'bolt', year: 2022, odometer: 12900, cylinders: null, condition: 'excellent', fuel: 'electric', titleStatus: 'clean', transmission: 'automatic', drive: 'fwd', type: 'hatchback', paintColor: 'blue', state: 'ny', askingPrice: 23000, description: 'Efficient commuter, fast charging.', predictedValue: null, predictedLow: null, predictedHigh: null, dealDeltaPct: null, createdAt: '2026-05-31T13:15:00Z' },
  { owner: 'bob@demo.test', manufacturer: 'nissan', model: 'altima', year: 2019, odometer: 53000, cylinders: 4, condition: 'good', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: 'fwd', type: 'sedan', paintColor: 'gray', state: 'tx', askingPrice: 16000, description: 'Comfortable, great MPG.', predictedValue: 18500, predictedLow: 16500, predictedHigh: 20500, dealDeltaPct: -13.51, createdAt: '2026-05-30T09:50:00Z' },
  { owner: 'carol@demo.test', manufacturer: 'subaru', model: 'outback', year: 2020, odometer: 44800, cylinders: 4, condition: 'good', fuel: 'gas', titleStatus: 'clean', transmission: 'automatic', drive: '4wd', type: 'suv', paintColor: 'green', state: 'wa', askingPrice: 27000, description: 'AWD wagon, adventure ready.', predictedValue: 26000, predictedLow: 23000, predictedHigh: 29000, dealDeltaPct: 3.85, createdAt: '2026-05-29T17:30:00Z' },
];

async function main() {
  const passwordHash = await argon2.hash(DEMO_PASSWORD);

  // Upsert demo users (verified so their listings can be published live).
  const userIdByEmail: Record<string, string> = {};
  for (const email of USERS) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, emailVerified: true },
    });
    userIdByEmail[email] = user.id;
  }

  // Idempotent reseed: drop prior demo listings (cascades their price history).
  await prisma.listing.deleteMany({
    where: { userId: { in: Object.values(userIdByEmail) } },
  });

  for (const l of LISTINGS) {
    const listing = await prisma.listing.create({
      data: {
        manufacturer: l.manufacturer,
        model: l.model,
        year: l.year,
        odometer: l.odometer,
        cylinders: l.cylinders,
        condition: l.condition,
        fuel: l.fuel,
        titleStatus: l.titleStatus,
        transmission: l.transmission,
        drive: l.drive,
        type: l.type,
        paintColor: l.paintColor,
        state: l.state,
        askingPrice: l.askingPrice,
        description: l.description,
        contactEmail: l.owner,
        status: ListingStatus.active,
        predictedValue: l.predictedValue,
        predictedLow: l.predictedLow,
        predictedHigh: l.predictedHigh,
        dealDeltaPct: l.dealDeltaPct,
        userId: userIdByEmail[l.owner],
        createdAt: new Date(l.createdAt),
      },
    });
    // Initial 'created' price-history row, mirroring the ListingsService flow.
    await prisma.listingPriceHistory.create({
      data: {
        listingId: listing.id,
        reason: PriceChangeReason.created,
        oldAskingPrice: null,
        newAskingPrice: listing.askingPrice,
        oldPredictedValue: null,
        newPredictedValue: listing.predictedValue,
        oldPredictedLow: null,
        newPredictedLow: listing.predictedLow,
        oldPredictedHigh: null,
        newPredictedHigh: listing.predictedHigh,
      },
    });
  }

  console.log(
    `Seeded ${USERS.length} users and ${LISTINGS.length} listings.\n` +
      `Demo login → ${USERS.join(', ')}  (password: ${DEMO_PASSWORD})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
