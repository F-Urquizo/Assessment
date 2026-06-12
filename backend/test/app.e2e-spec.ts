/**
 * E2E integration test: auth → listings → favorites → recommendations
 *
 * Runs against the appraisal_test DB (set by test/setup-env.ts via .env.test).
 * MailService and ModelService are mocked so the test needs no SMTP or running
 * model-service. Applies pending Prisma migrations in beforeAll.
 *
 * Step flow (all sequential within one describe block):
 *   1  register → 201
 *   2  login before verify → 403
 *   3  verify-email with captured token → 200
 *   4  login after verify → 200 + accessToken + refresh cookie
 *   5  create listing (Bearer) → 201 + valuation from mock
 *   6  browse marketplace → listing appears
 *   7a add to favorites → 201
 *   7b double-favorite → 409
 *   8  recommendations (authenticated) → 200 array
 *   9a refresh with captured cookie → 200 + { accessToken, user }
 *   9b logout → 204
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';

import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '../src/app.module';
import { MailService } from '../src/mail/mail.service';
import { ModelService } from '../src/model/model.service';
import { PrismaService } from '../src/prisma/prisma.service';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function cleanDb(prisma: PrismaService): Promise<void> {
  // Deletion order respects FK constraints (children before parents).
  await prisma.searchHistory.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.listingPriceHistory.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}

// ─── suite ───────────────────────────────────────────────────────────────────

describe('E2E: auth → listings → favorites → recommendations', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Shared state threaded through each step
  let accessToken: string;
  let refreshCookieValue: string; // "refresh=<raw>" — the name=value part only
  let listingId: string;
  let capturedVerifyLink: string;

  const EMAIL = `e2e_${Date.now()}@example.com`;
  const PASSWORD = 'Password123!';

  // ── Mocks ──────────────────────────────────────────────────────────────────

  const mailMock = {
    sendVerificationEmail: jest.fn(async (_email: string, link: string) => {
      capturedVerifyLink = link;
    }),
  };

  // Deterministic valuation so assertions on predictedValue are stable.
  const modelMock = {
    post: jest.fn().mockResolvedValue({ price: 15000, low: 13000, high: 17000 }),
    get: jest.fn().mockResolvedValue({}),
  };

  // ── Setup / teardown ───────────────────────────────────────────────────────

  beforeAll(async () => {
    // Ensure all migrations are applied to the test DB.
    // DATABASE_URL is already pointing at appraisal_test (via setup-env.ts).
    execSync('npx prisma migrate deploy', {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env },
      stdio: 'pipe',
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Disable rate-limiting so rapid test requests don't get throttled.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      // Replace real mail sender — capture the link instead of sending SMTP.
      .overrideProvider(MailService)
      .useValue(mailMock)
      // Replace real model-service HTTP call with deterministic stub.
      .overrideProvider(ModelService)
      .useValue(modelMock)
      .compile();

    prisma = module.get(PrismaService);

    // Wipe any leftover rows before the suite runs.
    await cleanDb(prisma);

    app = module.createNestApplication<App>();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      }),
    );
    await app.init();
  }, 60_000); // allow extra time for migration + Prisma connect

  afterAll(async () => {
    await cleanDb(prisma);
    await app.close();
  });

  // ── Step 1 ─────────────────────────────────────────────────────────────────

  it('1. POST /auth/register → 201, emailVerified:false, token link captured', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(201);

    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body.user.emailVerified).toBe(false);
    // Confirms mailMock was called and captured the link
    expect(typeof capturedVerifyLink).toBe('string');
    expect(capturedVerifyLink).toContain('token=');
  });

  // ── Step 2 ─────────────────────────────────────────────────────────────────

  it('2. POST /auth/login before email verified → 403', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(403);
  });

  // ── Step 3 ─────────────────────────────────────────────────────────────────

  it('3. GET /auth/verify-email with captured token → 200 {verified:true}', async () => {
    // The link is: {FRONTEND_URL}/verify-email?token=<rawToken>
    const rawToken = capturedVerifyLink.split('token=')[1];
    expect(rawToken).toBeTruthy();

    const res = await request(app.getHttpServer())
      .get('/auth/verify-email')
      .query({ token: rawToken })
      .expect(200);

    expect(res.body.verified).toBe(true);
  });

  // ── Step 4 ─────────────────────────────────────────────────────────────────

  it('4. POST /auth/login after verified → 200 + accessToken + httpOnly refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.emailVerified).toBe(true);

    // Capture the httpOnly cookie for later refresh/logout calls.
    // Set-Cookie headers come as an array of full directive strings, e.g.:
    //   "refresh=abc123; Path=/auth; HttpOnly; SameSite=Lax; Max-Age=604800"
    // The Cookie request header accepts only the name=value part.
    const setCookieHeaders = res.headers['set-cookie'] as string[] | undefined;
    expect(Array.isArray(setCookieHeaders)).toBe(true);
    const fullDirective = (setCookieHeaders as string[]).find((c) =>
      c.startsWith('refresh='),
    );
    expect(fullDirective).toBeTruthy();
    refreshCookieValue = fullDirective!.split(';')[0]; // "refresh=<raw>"

    accessToken = res.body.accessToken;
  });

  // ── Step 5 ─────────────────────────────────────────────────────────────────

  it('5. POST /listings (Bearer) → 201 with deterministic model-service valuation', async () => {
    const res = await request(app.getHttpServer())
      .post('/listings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        manufacturer: 'Toyota',
        model: 'Camry',
        year: 2015,
        odometer: 50000,
        condition: 'good',
        fuel: 'gas',
        titleStatus: 'clean',
        transmission: 'automatic',
        drive: 'fwd',
        type: 'sedan',
        paintColor: 'white',
        state: 'ca',
        askingPrice: 14000,
        contactEmail: EMAIL,
        status: 'active',
      })
      .expect(201);

    expect(typeof res.body.id).toBe('string');
    // Valuation fields come from modelMock ({ price: 15000, low: 13000, high: 17000 })
    expect(res.body.predictedValue).toBe(15000);
    expect(res.body.predictedLow).toBe(13000);
    expect(res.body.predictedHigh).toBe(17000);
    // dealBadge is derived (service adds it); predictedValue < askingPrice → "Over"
    expect(res.body).toHaveProperty('dealBadge');

    // req.user was correctly populated from the JWT (the listing is owned by our user)
    expect(modelMock.post).toHaveBeenCalledWith(
      '/predict',
      expect.objectContaining({ manufacturer: 'Toyota', model: 'Camry' }),
    );

    listingId = res.body.id;
  });

  // ── Step 6 ─────────────────────────────────────────────────────────────────

  it('6. GET /listings (public browse) → active listing appears in results', async () => {
    const res = await request(app.getHttpServer())
      .get('/listings')
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');

    const found = res.body.items.find(
      (l: { id: string }) => l.id === listingId,
    );
    expect(found).toBeDefined();
  });

  // ── Step 7a ────────────────────────────────────────────────────────────────

  it('7a. POST /favorites/:listingId (Bearer) → 201', async () => {
    await request(app.getHttpServer())
      .post(`/favorites/${listingId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
  });

  // ── Step 7b ────────────────────────────────────────────────────────────────

  it('7b. POST /favorites/:listingId again → 409 conflict (duplicate)', async () => {
    await request(app.getHttpServer())
      .post(`/favorites/${listingId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(409);
  });

  // ── Step 8 ─────────────────────────────────────────────────────────────────

  it('8. GET /recommendations (Bearer) → 200 array (cold-start or pref-scored)', async () => {
    const res = await request(app.getHttpServer())
      .get('/recommendations')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // The endpoint excludes the caller's own listings so the array may be empty
    // on a clean test DB, but it must be an array.
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ── Step 9a ────────────────────────────────────────────────────────────────

  it('9a. POST /auth/refresh (cookie) → 200 + { accessToken, user }', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookieValue)
      .expect(200);

    expect(typeof res.body.accessToken).toBe('string');
    // The auth bug fix: refresh must return user alongside the new accessToken.
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.body.user.emailVerified).toBe(true);

    // Rotate to the newly issued refresh cookie so logout uses the current one.
    const newSetCookie = res.headers['set-cookie'] as string[] | undefined;
    if (newSetCookie) {
      const newDirective = newSetCookie.find((c) => c.startsWith('refresh='));
      if (newDirective) refreshCookieValue = newDirective.split(';')[0];
    }
    accessToken = res.body.accessToken;
  });

  // ── Step 9b ────────────────────────────────────────────────────────────────

  it('9b. POST /auth/logout (cookie) → 204 No Content', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', refreshCookieValue)
      .expect(204);
  });
});
