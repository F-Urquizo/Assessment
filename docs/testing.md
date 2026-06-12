# Testing Strategy

> How Bluebook is tested: what each layer covers, how to run it, and what is
> intentionally left to manual verification. Numbers are current as of the
> latest run: **196 backend tests** (15 suites), **11 frontend test files**
> (Vitest), and **1 model-service test module** (pytest).

---

## 1. Overview

| Layer | Tool | Scope | How to run |
|---|---|---|---|
| Backend unit + integration | Jest 30 | Services, controllers, DTOs, guards, strategies | `cd backend && npm test` |
| Backend E2E | Jest + Supertest | Full HTTP flow against a real test DB | `cd backend && npm run test:e2e` |
| Backend coverage | Jest | Line/branch coverage report | `cd backend && npm run test:cov` |
| Frontend unit + component | Vitest 4 + Testing Library | Lib logic, React components, context providers | `cd frontend && npm run test:run` |
| Frontend watch | Vitest | Interactive re-run on save | `cd frontend && npm test` |
| Model service | pytest | Flask endpoints + prediction invariants | `cd model-service && pytest test_app.py` |

---

## 2. Backend tests (Jest)

### 2.1 Running

```bash
cd backend
npm test               # all 196 tests, single run
npm run test:cov       # same + coverage report in /coverage
npm run test:e2e       # E2E suite (requires DATABASE_URL in .env.test)
npm run test:watch     # watch mode for development
```

The unit/integration tests mock all external dependencies (Prisma, model
service, mail). They do **not** require a running database, model service,
or SMTP server.

### 2.2 Test suites and what they cover

#### `auth/auth.service.spec.ts`

Core auth business logic. All external I/O (Prisma, argon2, mail) is mocked.

| Area | Key assertions |
|---|---|
| `register` | argon2id hash is stored (not the raw password); `passwordHash` never appears in the return value; `409` on duplicate email; email verification token is stored as SHA-256 hash; raw token is used in the email link |
| `resendVerification` | Issues a fresh token for unverified accounts; silently ignores verified accounts and unknown emails |
| `login` | Returns `accessToken`, `rawRefresh`, and a sanitized user; JWT payload is `{ sub, role }`; refresh token stored as hash, not raw; `401` for unknown email or wrong password; `403` for unverified account |
| `refresh` | Rotates the token (old revoked, new issued); reuse of a revoked token revokes the entire `familyId` chain |
| `logout` | Revokes the current token |
| `verifyEmail` | Marks `emailVerified = true`; rejects expired and already-used tokens |

#### `auth/auth.controller.spec.ts`

HTTP layer for auth. Verifies the controller correctly delegates to the service
and handles the cookie correctly.

| Area | Key assertions |
|---|---|
| `POST /auth/register` | `passwordHash` absent from response |
| `POST /auth/login` | Cookie named `refresh` is set; scoped to `path=/auth`; `SameSite` and `Secure` read from `ConfigService`; `rawRefresh` not in the response body |
| `POST /auth/refresh` | Cookie updated, `rawRefresh` not in body; `401` when cookie is absent |
| `POST /auth/logout` | Cookie cleared; idempotent (no error when cookie is absent) |
| `GET /auth/verify-email` | Token forwarded from query param |

#### `auth/guards/guards.spec.ts` · `auth/jwt.strategy.spec.ts`

JWT guard and strategy unit tests — token extraction, payload validation,
`@Public()` opt-out behaviour.

#### `listings/listings.service.spec.ts`

Listings business logic. Prisma and `ModelService` are mocked.

| Area | Key assertions |
|---|---|
| `create` | Model called with snake_case fields; derived columns stored; deal badge computed; client cannot set `predictedValue`; verified user can publish (`active`); unverified user blocked from `active` but can save `draft`; listing still saved when model service is unreachable; `created` history row written with null old values; listing + history row written in one transaction |
| `update` | `404` for missing listing; `403` for non-owner; admin can edit any listing; model re-called only when a spec field changes; `asking_price_change` history row when only price moves; `revaluation` row when specs change; unverified owner blocked from publishing |
| `browse` | Filters, sort modes, pagination all produce correct `where`/`orderBy` Prisma calls |
| `findOne` | Returns `ListingDetailView` with price history; `404` for missing id |
| `remove` | Owner can delete; non-owner blocked |

#### `listings/deal.spec.ts`

Pure functions, no mocks needed.

| Function | Key assertions |
|---|---|
| `computeDealDeltaPct` | Correct sign (negative = good deal); rounds to two decimal places; `null` when `predictedValue` is null or zero |
| `dealBadge` | `"under"` at or below −10%; `"over"` at or above +10%; `"fair"` strictly inside; `null` for null delta |

#### `listings/dto/browse-listings.dto.spec.ts`

DTO validation: numeric coercion from query strings, `pageSize` max 100,
unknown `sort`/`type` values rejected, `q` length limit, year/mileage range
bounds.

#### `listings/listings.controller.spec.ts`

Thin delegation tests confirming each route passes the correct arguments to
the service.

#### `favorites/favorites.service.spec.ts`

| Area | Key assertions |
|---|---|
| `add` | Creates row when listing exists; `404` for unknown listing; `409` on duplicate (Prisma P2002) |
| `remove` | Idempotent — no error when row does not exist |
| `list` | Returns `ListingView[]` enriched with `dealBadge` |

#### `recommendations/recommendations.service.spec.ts`

| Area | Key assertions |
|---|---|
| Cold start | Sorted by deal score (most underpriced first); `null` delta treated as neutral 0.5; `limit` respected; empty array when no active listings; "why" mentions below-market percentage |
| With preference profile | A listing matching top preferences scores higher than a cold match; "why" names preferred manufacturer and type; search history make-filter contributes to preference |
| General | Own listings excluded via `excludeUserId` |

#### `crypto/crypto.service.spec.ts`

| Area | Key assertions |
|---|---|
| Round-trip | `decrypt(encrypt(x)) === x` for plain strings, empty strings, unicode |
| Random IV | Same plaintext produces different ciphertext each call |
| Tampering detection (GCM auth tag) | Throws when ciphertext body, auth tag, or IV is modified |
| Format validation | Throws on fewer or more than 3 colon-separated parts |
| Key validation | Constructor throws on keys shorter or longer than 32 bytes |

#### `audit/audit.service.spec.ts` · `mail/mail.service.spec.ts` · `users/users.service.spec.ts` · `admin/admin.controller.spec.ts`

Unit tests for the remaining services and the admin controller, covering their
core operations and guard behaviours.

---

### 2.3 End-to-end test (`test/app.e2e-spec.ts`)

Runs a real NestJS application against a dedicated **test database**
(`appraisal_test` by default, configured via `backend/.env.test`). Prisma
migrations are applied in `beforeAll`. `MailService` and `ModelService` are
replaced with mocks so no SMTP server or model service is needed.

The test is a **linear flow** — each step depends on state from the previous:

| Step | What is tested |
|---|---|
| 1. `POST /auth/register` | `201`, user object returned |
| 2. `POST /auth/login` (pre-verify) | `403 "email not verified"` |
| 3. `GET /auth/verify-email` | `200` using the link captured from the mail mock |
| 4. `POST /auth/login` (post-verify) | `200`, access token and refresh cookie issued |
| 5. `POST /listings` | `201`, listing created with mock valuation (price 15000, low 13000, high 17000) |
| 6. `GET /listings` | Listing appears in the browse results |
| 7a. `POST /favorites/:id` | `201` |
| 7b. `POST /favorites/:id` (duplicate) | `409` |
| 8. `GET /recommendations` | `200`, array returned |
| 9a. `POST /auth/refresh` | `200`, new access token issued |
| 9b. `POST /auth/logout` | `204` |

**Running the E2E suite:**

```bash
cd backend
npm run test:e2e
```

Requires `backend/.env.test` to contain a `DATABASE_URL` pointing at a
Postgres instance (separate from the dev database is recommended).

---

## 3. Frontend tests (Vitest)

### 3.1 Running

```bash
cd frontend
npm run test:run   # single run (CI mode)
npm test           # watch mode
```

Tests use jsdom as the environment and Testing Library for DOM assertions.
Network calls are intercepted with `vi.mock` — no live backend is needed.

### 3.2 Test files and what they cover

#### `lib/deal.test.ts`

`evaluateDeal` for buyer and seller modes. Checks verdict class and label at
the boundary conditions (ask at floor, ask at estimate, ask at ceiling).
Verifies `askPct` is clamped to `[0, 100]` for absurd asks.

#### `lib/sell-validation.test.ts`

`validateSell` inline form validation. Covers missing model, non-positive
asking price, implausible year, negative mileage, malformed contact email.
`firstErrorField` returns the first invalid field in form order.

#### `lib/auth-request.test.ts`

The `authRequest` 401 interceptor. Key scenarios:

| Scenario | Expected behaviour |
|---|---|
| Successful request | No refresh called |
| `401` response | Silently refreshes, retries once with the new token |
| `401` + dead session (refresh fails) | Token store cleared, error thrown |
| Concurrent `401`s | **Single-flight** — only one refresh call made, all callers await the same promise |

#### `lib/marketplace-filters.test.ts`

Filter state → query param serialization. Verifies that each filter dimension
is correctly encoded and that defaults are omitted.

#### `lib/marketplace-mock.test.ts`

`MOCK_OPTIONS` shape validation — confirms the fallback option set has the
same keys as the live `/options` response so graceful degradation works.

#### `lib/recommendations.test.ts`

`dealScore` normalization (−20% → 1.0, parity → 0.5, +20% → 0.0),
`buildWhy` string generation, and `mockRecommendations` sort order.

#### `components/views/ListingCard.test.tsx`

| Scenario | What is verified |
|---|---|
| Valued listing | Vehicle name, asking price, deal badge with delta |
| `onOpen` | Called with listing id on click |
| Keyboard | Enter opens the card (keyboard operability) |
| Unvalued listing | "Not valued yet" shown, no badge |

#### `components/views/RecsList.test.tsx`

Recommendations list renders items with their "why" strings.

#### `components/views/SpecWizard.test.tsx`

| Scenario | What is verified |
|---|---|
| Step 1 | Starts on manufacturer, advances when option picked |
| Back navigation | Returns to previous step |
| Stepper jump | Clicking an earlier step in the stepper navigates there |
| Last step | Ends on review screen — does not auto-appraise |

#### `context/FavoritesProvider.test.tsx`

Toggle a listing in and out of favorites: optimistic update, rollback on
network failure, offline-safe (no false positive when the request errors).

#### `context/MyListingsProvider.test.tsx`

Create and remove a listing (optimistic + rollback); validation blocks save
with no asking price; creating while logged out is rejected; a garage car
pre-fills as `draft` (not `active`).

---

## 4. Model service tests (pytest)

```bash
cd model-service
pytest test_app.py -v
```

Uses the Flask test client — no network port needed.

| Test | What is verified |
|---|---|
| `test_predict_basic` | `low ≤ price ≤ high`; `price > 1000` for a well-specified vehicle |
| `test_analyze_structure` | Response contains `appraisal`, `drivers`, `recommendations`, `forecast`, `mileage_curve`, `market` |

---

## 5. What is intentionally NOT tested

| Area | Why |
|---|---|
| Model accuracy / ML metrics | Out of scope for integration testing; the model is evaluated offline during training |
| Frontend against the live backend | Manual testing via `npm run dev` + a running backend covers this; E2E already tests the full HTTP stack |
| Email delivery | Nodemailer is mocked in all automated tests; delivery is verified manually in development (the backend logs the verification link when SMTP is not configured) |
| Admin endpoints (automated) | Covered by the admin controller unit test; the admin UI is minimal and verified manually |
| TLS / HTTPS behaviour | Infrastructure concern; tested manually with `TLS_MODE=direct` and a self-signed cert |

---

## 6. Test environment setup

### Backend unit tests

No setup required. All external dependencies are mocked with `jest.fn()` /
`jest.spyOn()`.

### Backend E2E

1. Copy `backend/.env.test` — it must contain a `DATABASE_URL` pointing at a
   separate Postgres database (e.g. `appraisal_test`).
2. The suite runs `prisma migrate deploy` in `beforeAll` automatically.
3. `MailService` and `ModelService` are replaced with in-memory mocks in the
   `TestingModule` setup — no SMTP or model service needed.

### Frontend tests

No setup required. `jsdom` is the test environment (configured in
`vite.config.ts`). Network calls are mocked with `vi.mock`.

### Model service tests

Requires the `model_artifacts.joblib` file to be present (via `git lfs pull`
or `python train_model.py`). All other dependencies are in `requirements.txt`.
