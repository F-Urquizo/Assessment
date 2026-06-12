# Low-Level Design — Bluebook

> Implementation-level detail for every major subsystem. Assumes familiarity
> with the high-level design in [`high-level-design.md`](./high-level-design.md).
> Schema rationale: [`db-design.md`](./db-design.md).
> Security controls: [`security.md`](./security.md).
> Auth API shapes: [`API_CONTRACT.md`](./API_CONTRACT.md).

---

## 1. Frontend

### 1.1 Application shell (`frontend/src/App.tsx`)

Three context providers are nested at the root in this order:

```
AuthProvider
  └── FavoritesProvider
        └── MyListingsProvider
              └── <Routes>
```

On mount, `App` calls `fetchOptions()` (→ `GET /options`) and stores the
result in local state. All child components receive this `Options` object as a
prop. If the call fails, `MOCK_OPTIONS` is used instead — the marketplace
stays functional with no live backend.

### 1.2 Context providers

| Provider | File | What it holds |
|---|---|---|
| `AuthProvider` | `context/auth-provider.ts` + `AuthProvider.tsx` | Current user, access token (memory only via `lib/token-store.ts`), login/logout/refresh helpers |
| `FavoritesProvider` | `context/FavoritesProvider.tsx` | Favourite listing ids, add/remove actions |
| `MyListingsProvider` | `context/MyListingsProvider.tsx` | Current user's listings, create/edit/delete actions |
| `StudioProvider` | `context/StudioProvider.tsx` | Appraisal wizard state (scoped to Studio) |
| `GarageProvider` | `context/GarageProvider.tsx` | Saved appraisals (scoped to Studio) |

### 1.3 Token storage

`frontend/src/lib/token-store.ts` holds the JWT access token in a
module-level variable — never `localStorage`, never `sessionStorage`. It is
lost on page refresh; a silent `POST /auth/refresh` on boot restores it from
the httpOnly cookie.

### 1.4 Deal scoring (`frontend/src/lib/deal.ts`)

`evaluateDeal(appraisal, askingPrice, mode)` — five verdict tiers:

| Verdict | Buyer label | Condition |
|---|---|---|
| `v-great` | Great deal | `ask ≤ low` |
| `v-good` | Good buy | `ask / estimate < 0.97` |
| `v-fair` | Fair price | `ask / estimate` within ±3% |
| `v-high` | A bit high | `ask > estimate` but `ask ≤ high` |
| `v-over` | Overpriced | `ask > high` |

In `seller` mode the same five classes map to different labels and subtitles
(e.g. `v-great` → "Quick-sale price — leaves money on the table"). Each mode
also returns a three-tile **price guide**:

- **Buyer**: Open offer / Fair value / Walk-away above
- **Seller**: List at / Expect to net / Quick-sale floor

### 1.5 Marketplace filters (`frontend/src/lib/marketplace-filters.ts`)

Client-side helpers that build `BrowseListingsDto`-compatible query params
from the filter bar state. Filter dimensions: make, body type, state, price
band, mileage band, sort order, page.

### 1.6 Key component files

| File | Responsibility |
|---|---|
| `components/views/MarketplaceView.tsx` | Listing grid + filter bar layout |
| `components/views/ListingCard.tsx` | Single listing card with deal badge; `role="button"`, `tabIndex={0}`, handles Enter/Space for keyboard access |
| `components/views/ListingDetail.tsx` | Over/under-valued visual analysis, `ValuePlate`, price history chart |
| `components/views/RecommendationsRail.tsx` | "Recommended for you" horizontal rail |
| `components/views/SpecWizard.tsx` | Step-by-step appraisal card wizard |
| `components/views/SellForm.tsx` | Create/edit listing form with inline per-field validation |
| `components/views/GarageView.tsx` | Saved appraisals grid |
| `components/views/CompareTable.tsx` | Head-to-head vehicle comparison table |
| `components/LineChart.tsx` | Depreciation forecast / price history chart |
| `pages/LoginPage.tsx` | Login form, resend-verification flow |
| `pages/RegisterPage.tsx` | Registration form |
| `pages/VerifyEmailPage.tsx` | Token validation landing, resend flow |
| `pages/ListingDetailPage.tsx` | Route shell for `/listings/:id` |

### 1.7 Accessibility

- **Skip link** — first focusable element jumps to `<main id="main-content">`.
- **Keyboard operability** — all interactive controls reachable and operable
  via keyboard; listing cards handle Enter/Space.
- **Deal badge** — text + symbol + colour (three redundant channels; never
  colour alone).
- **ARIA** — meaningful `aria-label` on compound controls; decorative glyphs
  are `aria-hidden`.
- **Reduced motion** — `prefers-reduced-motion: reduce` honoured in
  `studio.css`.
- **Contrast** — targets WCAG AA.

---

## 2. Backend

### 2.1 Module map

```
AppModule
 ├── ConfigModule        (global, reads .env)
 ├── ThrottlerModule     (global rate limiting)
 ├── PrismaModule        (global DB client)
 ├── CryptoModule        (global AES-256-GCM)
 ├── UsersModule
 ├── AuthModule          ← imports UsersModule, MailModule, AuditModule
 ├── ListingsModule      ← imports ModelModule
 ├── FavoritesModule
 ├── RecommendationsModule ← imports ListingsModule, FavoritesModule
 ├── AdminModule
 ├── AuditModule
 └── MailModule
```

### 2.2 Global cross-cutting layers (applied in `main.ts` / `app.module.ts`)

| Layer | What it does |
|---|---|
| `JwtAuthGuard` | Default-on JWT validation on every route; opt-out with `@Public()` |
| `RolesGuard` | Enforces `@Roles('admin')` on admin-only routes |
| `EmailVerifiedGuard` | Blocks protected write operations if `emailVerified = false` |
| `ValidationPipe` | Whitelists DTO fields; strips unknown properties — client can never set server-derived columns like `predictedValue` |
| `Helmet` | CSP, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, conditional HSTS |
| `ThrottlerGuard` | 200 req / 60 s globally; `@Throttle(5, 60)` on `POST /auth/login` |
| `CookieParser` | Parses the `refresh` cookie on every request |
| `Swagger` | OpenAPI at `/docs`; every DTO decorated with `@ApiProperty` |

### 2.3 Auth module (`backend/src/auth/`)

**Endpoints:**

| Method + Path | Auth | What happens |
|---|---|---|
| `POST /auth/register` | Public | Normalise email → argon2id hash → create User → send verification email (fire-and-forget) → `201 { user }` |
| `POST /auth/login` | Public | Verify credentials → check `emailVerified` → issue access JWT + refresh cookie → `200 { accessToken, user }` |
| `POST /auth/refresh` | Cookie | Validate refresh token hash → rotate (revoke old, create new) → `200 { accessToken }` + new cookie |
| `POST /auth/logout` | Cookie | Revoke refresh token → clear cookie → `204` |
| `GET /auth/verify-email?token=` | Public | Hash token → look up → set `emailVerified = true` → `200` |
| `POST /auth/resend-verification` | Public | Always `202`; sends email only if account exists and is unverified; rate-limited 3 req/min |

**Token mechanics:**

- Access JWT signed with `JWT_ACCESS_SECRET`, TTL 15 minutes.
- Refresh token: `crypto.randomBytes(32)`, stored as `SHA-256(rawToken)`.
  Cookie attributes: `httpOnly`, `secure` (config-driven), `sameSite`
  (config-driven), `path=/auth`, `maxAge=7 days`.
- **Rotation**: every `/auth/refresh` issues a new token and revokes the old.
- **Reuse-attack detection**: tokens share a `familyId`. Presenting a revoked
  token triggers `updateMany({ where: { familyId } }, { revokedAt: now })`,
  logging a `refresh_reuse_detected` audit event and forcing re-login.

### 2.4 Listings module (`backend/src/listings/`)

**Valuation-on-write flow:**

```
POST /listings  (or PATCH /listings/:id with spec/price change)
  1. ValidationPipe strips client-supplied predictedValue / dealDeltaPct
  2. ListingsService maps camelCase DTO → snake_case model input
  3. ModelModule.predict(input) → { price, low, high }
  4. dealDeltaPct = (askingPrice − price) / price × 100
  5. Prisma $transaction:
       INSERT/UPDATE Listing   (predicted* + dealDeltaPct stored)
       INSERT ListingPriceHistory (reason: created | asking_price_change | revaluation)
```

**Browse (`GET /listings`)** — `BrowseListingsDto` supports:
- Filters: `make`, `type`, `state`, `minPrice`/`maxPrice`, `minMileage`/`maxMileage`, `minYear`/`maxYear`, `status`
- Sort: `newest`, `oldest`, `priceAsc`, `priceDesc`, `mileageAsc`, `bestDeal`
- Pagination: `page`, `limit`

Search history is written fire-and-forget inside the browse controller for
authenticated users (preference signal for recommendations).

### 2.5 Favorites module (`backend/src/favorites/`)

`POST /favorites/:listingId` — idempotent upsert (catches Prisma `P2002`
unique-violation and returns 200 instead of 409 on duplicate).
`DELETE /favorites/:listingId` — removes the row.
`GET /favorites` — returns the current user's saved listings.

All three routes require a valid JWT. The `Favorite` table has a DB-level
unique constraint on `(userId, listingId)` as the race-safe guard.

### 2.6 Recommendations module (`backend/src/recommendations/`)

`GET /recommendations?limit=N`

Algorithm constants (tunable):

| Constant | Value | Purpose |
|---|---|---|
| `CANDIDATE_POOL_SIZE` | 200 | Active listings fetched for scoring |
| `PREF_WINDOW_DAYS` | 90 | How far back in favourites + search history |
| `DEAL_WEIGHT` | 0.5 | Weight of deal score in combined score |
| `PREF_WEIGHT` | 0.5 | Weight of preference score in combined score |

Deal score normalization: `max(0, min(1, (-dealDeltaPct + 30) / 60))`
→ −30% maps to 1.0, 0% maps to 0.5, +30% maps to 0.0.

Preference score: frequency of `manufacturer`, `type`, `fuel`, `drive` in the
user's last 90 days of favourites and search-history, each normalised by the
max frequency across that dimension, averaged over the four dimensions.

Cold start (all frequency maps empty): preference score is 0, combined = deal
score only.

"Why" string is built from: top preference dimension matches + deal delta if
`dealDeltaPct ≤ −10%`.

### 2.7 Crypto module (`backend/src/crypto/crypto.service.ts`)

Global `@Injectable()` AES-256-GCM service.

| Property | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key | 32 bytes from `ENCRYPTION_KEY` (64 hex chars), validated at constructor time |
| IV | 12 bytes, `crypto.randomBytes(12)` per call |
| Auth tag | 16 bytes (GCM default) |
| Output format | `base64(iv):base64(authTag):base64(ciphertext)` stored as `TEXT` |

`encrypt(plaintext: string): string` and `decrypt(ciphertext: string): string`
are injected wherever a column needs protection at rest.

### 2.8 Audit module (`backend/src/audit/`)

Append-only log table `auth_audit_log`. Eight event types:

`register` · `login_success` · `login_failure` · `logout` ·
`token_rotated` · `refresh_reuse_detected` · `email_verified` · `role_changed`

Each row stores `userId` (nullable — unknown-email login failures have no
user), `ip`, `userAgent`, `metadata` (JSONB, event-specific context), and
`createdAt`. Rows are never updated or deleted.

---

## 3. Model Service

### 3.1 Model inputs (13 features)

| Field | Encoding | Notes |
|---|---|---|
| `manufacturer` | Target encoding | Unknown values map to global mean |
| `model` | Target encoding (as `model_grp`) | Normalised, unknown → `"other"` |
| `state` | Target encoding | Unknown → global mean |
| `year` | Numeric → `vehicle_age = REF_YEAR − year` | `REF_YEAR = 2021` |
| `odometer` | Numeric | Miles |
| `cylinders` | Numeric | Optional; defaults to dataset median if null |
| `condition` | One-hot | 6-level ordered scale |
| `fuel` | One-hot | Fixed option set |
| `title_status` | One-hot | 6-level ordered scale |
| `transmission` | One-hot | Fixed option set |
| `drive` | One-hot | Fixed option set |
| `type` | One-hot | Body style, fixed option set |
| `paint_color` | One-hot | Fixed option set |

Predictions are made on a **log-transformed scale**; `np.expm1()` is applied
to all outputs.

### 3.2 `/predict` response

```json
{
  "price": 14200,
  "low":   11800,
  "high":  17100,
  "model_group": "f-150",
  "known_model": true
}
```

`low`/`high` are the 10th/90th percentiles across all trees in the forest.

### 3.3 `/analyze` response structure

```
appraisal     → estimate, low, high, spread_pct, model_group, known_model
drivers       → list of up to 9 factors sorted by "swing" (max price − min price across options)
                factors: condition, title_status, odometer, cylinders, drive, fuel,
                         transmission, paint_color, type
recommendations → up to 3 actionable suggestions (condition upgrade, clean title, lower mileage)
forecast      → 5-year depreciation at 12k miles/year:
                total_loss, retained_pct, avg_annual_loss, value_in_3yr, yearly points
mileage_curve → 13 data points (odometer vs value) for a ±60k–120k range
market        → percentile vs segment or manufacturer median, comparable count,
                popular models, vs_median delta
vehicle       → echo of the 13 input fields
```

### 3.4 `/compare` (up to 4 vehicles)

Returns a `slim_analysis` per vehicle: estimate, low, high, retained_3yr_pct,
avg_annual_loss, percentile, vs_median, top_driver, top_rec. Awards two flags:
`award_cheapest` (lowest estimate) and `award_holds_value` (highest
`retained_3yr_pct`).

---

## 4. Database Schema (summary)

Full rationale and normalisation argument in [`db-design.md`](./db-design.md).

### `User`

```
id            TEXT (cuid)   PK
email         TEXT UNIQUE   lowercased before insert
passwordHash  TEXT          argon2id digest
role          Role          user | admin
emailVerified BOOLEAN       default false
createdAt     TIMESTAMP
updatedAt     TIMESTAMP
```

### `Listing`

13 spec columns (manufacturer → state) are 1:1 with `/predict` input.
4 derived columns written only by `ListingsService`:

```
predictedValue  INT?
predictedLow    INT?
predictedHigh   INT?
dealDeltaPct    FLOAT?    (askingPrice − predictedValue) / predictedValue × 100
```

Indexes: `userId`, `status`, `manufacturer`.

### `ListingPriceHistory`

Append-only. One row per price/valuation change including creation.
Reason enum: `created` | `asking_price_change` | `revaluation`.
Written in the same transaction as the `Listing` write.
Indexes: `listingId`, `changedAt`.

### `RefreshToken`

```
tokenHash  TEXT    SHA-256(rawToken)
familyId   TEXT    groups the rotation chain for one login session
expiresAt  TIMESTAMP
revokedAt  TIMESTAMP?
```

Indexes: `userId`, `familyId`, `tokenHash`.

### `EmailVerificationToken`

```
tokenHash  TEXT    SHA-256(rawToken)
expiresAt  TIMESTAMP
usedAt     TIMESTAMP?   set on first valid use; row is kept (not deleted) for audit
```

Index: `tokenHash`.

### `Favorite`

Composite unique `(userId, listingId)`. Both FKs cascade on delete.
Index: `userId`.

### `SearchHistory`

```
userId   TEXT?   nullable (SET NULL on user delete)
filters  JSONB   non-null filter fields from BrowseListingsDto
```

Index: composite `(userId, createdAt)`.

### `AuditLog` (table: `auth_audit_log`)

```
userId    TEXT?   nullable (SET NULL on user delete)
event     AuditEvent
ip        TEXT?
userAgent TEXT?
metadata  JSONB?
createdAt TIMESTAMP
```

Append-only. `userId` is SET NULL (not CASCADE) so rows survive account deletion.
Indexes: `userId`, `event`, `createdAt`.

### Primary keys

All tables use `cuid()` — non-sequential, no sequence lock contention, URL-safe.

---

## 5. Security Controls

| Control | Detail |
|---|---|
| Password hashing | argon2id, default params: time cost 3, memory 65 536 KB, parallelism 4 |
| Access token | JWT signed with `JWT_ACCESS_SECRET`, 15 min TTL, in response body only |
| Refresh token | 32-byte opaque random value; SHA-256 hash in DB; httpOnly/Secure cookie, path=/auth, 7-day TTL |
| Token rotation | Every `/auth/refresh` issues new + revokes old; replay of revoked token revokes entire `familyId` chain |
| Encryption at rest | AES-256-GCM: 12-byte random IV per call, 16-byte auth tag, stored as `base64(iv):base64(authTag):base64(ct)` |
| Transport | `TLS_MODE=direct` (NestJS HTTPS, self-signed dev cert, HTTP→HTTPS redirect on port 3080) or `TLS_MODE=proxy` (trust X-Forwarded-Proto) |
| HSTS | `max-age=31536000; includeSubDomains; preload` — emitted only when `TLS_MODE` is set |
| Security headers | Helmet: CSP, nosniff, X-Frame-Options SAMEORIGIN, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control |
| Rate limiting | 200 req / 60 s global; 5 req / 60 s on `POST /auth/login` |
| Audit log | 8 event types, append-only, IP + User-Agent + JSONB metadata per event |
| DTO whitelist | `ValidationPipe` strips any field not declared in the DTO, preventing client override of server-derived columns |

---

## 6. Seed Data

`backend/prisma/seed.ts` — idempotent (safe to re-run).

- **3 users**: `alice@demo.test`, `bob@demo.test`, `carol@demo.test`
- **Password**: `Password123!` (argon2id hashed on seed)
- **Email verified**: yes for all three
- **12 active listings** with pre-computed valuations, deal badges, and price
  history rows
- **Demo favourites** pre-seeded for alice

Run: `npx prisma db seed` (requires Postgres up and migrations applied).

---

## 7. Migrations

Seven versioned migrations under `backend/prisma/migrations/`:

| Migration | Contents |
|---|---|
| `20260609181917_auth_init` | User, RefreshToken, EmailVerificationToken |
| `20260610033940_listings_init` | Listing |
| `20260610065019_audit_log` | AuditLog (`auth_audit_log`) |
| `20260610171233_listing_price_history` | ListingPriceHistory (initial columns) |
| `20260610200000_add_favorites_search_history` | Favorite, SearchHistory |
| `20260611025500_add_listing_price_history_ranges` | Adds `predicted*` range columns to ListingPriceHistory |
| `20260612120000_favorites` | Favorites refinements |

---

## 8. Environment Variables (key ones)

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | Prisma connection string |
| `JWT_ACCESS_SECRET` | Backend | Signs access JWTs |
| `JWT_REFRESH_SECRET` | Backend | Not used directly — refresh tokens are opaque (SHA-256 only) |
| `ENCRYPTION_KEY` | Backend | 64 hex chars (32 bytes) for AES-256-GCM |
| `COOKIE_SAME_SITE` | Backend | `lax` / `strict` / `none` |
| `COOKIE_SECURE` | Backend | `true` in prod |
| `CORS_ORIGIN` | Backend | Allowed frontend origin |
| `TLS_MODE` | Backend | `direct` / `proxy` / unset |
| `MODEL_SERVICE_URL` | Backend | URL of the Flask service (default: `http://model-service:5050`) |
| `VITE_API_TARGET` | Frontend | Override for Vite dev proxy target (default: `http://127.0.0.1:3000`) |
