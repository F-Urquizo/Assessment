# Architecture

> System design for **Bluebook** — a full-stack used-car valuation + marketplace
> platform. This document covers the runtime topology, each service's
> responsibility, the request flows that cross service boundaries, and the key
> design decisions behind them.
>
> Companion docs: [`db-design.md`](./db-design.md) (schema + normalisation),
> [`security.md`](./security.md) (security controls),
> [`API_CONTRACT.md`](./API_CONTRACT.md) (auth API contract),
> [`usability.md`](./usability.md) (UX + accessibility).

---

## 1. System overview

Bluebook is split into **three deployable services** plus a database, wired
together with Docker Compose. The frontend talks **only** to the backend; the
backend is the single gateway that owns the database and is the **only** caller
of the Python valuation model.

```
              ┌──────────────┐     proxy (dev)      ┌──────────────────┐
  Browser ───▶│   Frontend   │ ───── /api ─────────▶│     Backend      │
   (SPA)      │ React + Vite │  /auth /listings     │  NestJS gateway  │
              └──────────────┘  /recommendations    └───────┬──────────┘
                                                            │
                                          Prisma ORM        │  HTTP (server-to-server)
                                   ┌────────────────────────┼───────────────────────┐
                                   ▼                        ▼                        ▼
                            ┌─────────────┐         (valuation calls)        ┌───────────────┐
                            │ PostgreSQL  │                                  │ model-service │
                            │   (Prisma)  │◀── valuation-on-write writes ───▶│ Flask + RF    │
                            └─────────────┘    cached results to Listing     └───────────────┘
```

| Layer | Tech | Responsibility |
|---|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, React Router 7, Vitest | SPA: Studio (appraisal wizard) + Marketplace + auth UI. Renders, never trusts; holds the access token in memory only. |
| **Backend** | NestJS 11, Prisma 6, PostgreSQL 16, Passport-JWT, argon2, class-validator, Helmet, Throttler, Swagger, Nodemailer | API gateway: auth/sessions, listings CRUD, favourites, recommendations, admin. Owns the DB. Proxies valuation to the model. |
| **Model service** | Python, Flask, scikit-learn (random forest), pandas/NumPy, joblib | Stateless inference: `/predict`, `/analyze`, `/compare`, `/options`. No DB, no auth. |
| **Database** | PostgreSQL 16 via Prisma | System of record. Migrations + idempotent seed. |
| **Infra** | Docker Compose, Git LFS | Orchestration (Postgres + backend + model-service); the ~107 MB model artifact ships via LFS. |

**Boundary rule:** the browser never reaches Postgres or the model service
directly. Everything funnels through the NestJS gateway, which is where
authentication, validation, authorization and rate limiting live.

---

## 2. Services

### 2.1 Frontend (`frontend/`)

A single-page React app built with Vite. Routing is client-side via React
Router (`frontend/src/App.tsx`):

| Route | View | Access |
|---|---|---|
| `/` | Marketplace (grid + filters + recommendations rail) | Public |
| `/listings/:id` | Listing detail (over/under-valued analysis, price history, contact, ♥) | Public |
| `/favorites` | Saved listings | **Protected** (redirects to `/login`) |
| `/studio` | Valuation Studio (appraisal wizard, garage, compare) | Public |
| `/login`, `/register`, `/verify-email` | Auth flows | Public |

**State & context.** Cross-cutting concerns are React contexts layered at the
app root: `AuthProvider` (session) wraps `FavoritesProvider` and
`MyListingsProvider`; `StudioProvider`/`GarageProvider` scope the appraisal
experience. The **access token lives in React state only** — never
`localStorage`/`sessionStorage` — to remove the XSS exfiltration vector
(`frontend/src/context/AuthProvider.tsx`, `lib/token-store.ts`).

**Talking to the backend.** The frontend calls **relative paths** (`/auth/...`,
`/listings/...`). In dev, the **Vite proxy** (`vite.config.ts`) forwards them to
the backend at `http://127.0.0.1:3000` (override with `VITE_API_TARGET`). This
keeps cookies same-origin and means no hard-coded backend URL in the bundle.

**Graceful degradation.** If `/options` is unreachable at boot, the app falls
back to `MOCK_OPTIONS` so the marketplace stays reviewable on localhost without a
live backend (`App.tsx`). This is the runtime face of the **contracts-first**
strategy: typed contracts + mocks let frontend work proceed against unfinished
backend slices.

### 2.2 Backend (`backend/`)

A NestJS application organised into feature modules, each owning one slice of the
domain:

| Module | Path | Responsibility |
|---|---|---|
| `AuthModule` | `src/auth` | register · login · verify-email · refresh (rotation) · logout; JWT strategy + guards |
| `ListingsModule` | `src/listings` | Listings CRUD, browse (filter/sort/paginate), valuation-on-write, price history, search history |
| `FavoritesModule` | `src/favorites` | Add/remove/list favourites per user (idempotent) |
| `RecommendationsModule` | `src/recommendations` | "Recommended for you" — deal score + preference score |
| `ModelModule` | `src/model` | Server-to-server client for the Flask model-service |
| `AdminModule` | `src/admin` | Admin-only operations (role-gated) |
| `AuditModule` | `src/audit` | Append-only auth event log |
| `CryptoModule` | `src/crypto` | Global AES-256-GCM encrypt/decrypt service |
| `MailModule` | `src/mail` | Verification emails (Nodemailer) |
| `UsersModule`, `PrismaModule` | `src/users`, `src/prisma` | User service (strips `passwordHash`); DB client |

**Global cross-cutting layers** (applied in `app.module.ts` / `main.ts`):

- **Guards** — JWT auth (default-on, opt-out with `@Public()`), roles
  (`user`/`admin`), verified-email, all composable per route.
- **Validation** — a global `ValidationPipe` whitelists DTO fields, so clients
  can never set server-derived columns (e.g. `predictedValue`).
- **Rate limiting** — `@nestjs/throttler`: 200 req/60 s globally, 5/60 s on
  `POST /auth/login`.
- **Helmet** — security headers (CSP, HSTS when TLS is on, nosniff, frame
  options, etc.).
- **Swagger** — live OpenAPI at `/docs`.

### 2.3 Model service (`model-service/`)

A small **stateless** Flask app wrapping a trained scikit-learn **random
forest**. It has no database and no authentication — it is only ever reached by
the backend on the internal network.

| Endpoint | Purpose |
|---|---|
| `POST /predict` | Point estimate + low/high band for a vehicle's specs |
| `POST /analyze` | Estimate + value drivers + depreciation forecast |
| `POST /compare` | Head-to-head comparison of multiple vehicles |
| `GET /options` | The valid option sets for each spec field (single source of truth) |

The trained model lives in `model_artifacts.joblib` (~107 MB, shipped via **Git
LFS**). If the artifact is missing the service returns `503`; it can be retrained
with `python train_model.py`. `build_market_intel.py` / `market_intel.json`
provide market context used by `/analyze`.

### 2.4 Database (`backend/prisma/`)

PostgreSQL 16 accessed through **Prisma 6**. Schema in `schema.prisma`, evolved
through versioned migrations under `prisma/migrations/`, with an **idempotent
seed** (`seed.ts`) that creates 3 verified users, 12 valued listings, price
history and demo favourites. Full table-by-table rationale and the 1NF→3NF
normalisation argument live in [`db-design.md`](./db-design.md).

---

## 3. Key cross-service flows

### 3.1 Valuation-on-write (the core integration)

The defining decision of the system: a listing's valuation is computed **when it
is written**, not when it is read.

```
Client POST /listings (specs + askingPrice)
        │
        ▼
ListingsService.create()
        │  1. validate DTO (whitelist; derived fields stripped)
        │  2. map camelCase specs → snake_case model input
        ├─────────────▶ model-service POST /predict ──▶ { value, low, high }
        │  3. compute dealDeltaPct = (asking − value) / value × 100
        │  4. derive deal badge (Under / Fair / Over, ±10% threshold)
        ▼
  Postgres (single transaction):
     • INSERT Listing (specs + asking + predicted* + dealDeltaPct)
     • INSERT ListingPriceHistory (reason = 'created')
```

**Why cache the valuation on the row?** Browse and detail reads must not block on
a Python round-trip, and `dealDeltaPct` has to be **SQL-filterable/sortable** for
the deal badge and the `bestDeal` ordering. The derived columns
(`predictedValue/Low/High`, `dealDeltaPct`) are a deliberate, controlled
denormalisation — they are written **only** by `ListingsService`, recomputed on
every create and on every price/spec edit, and mirrored into
`ListingPriceHistory` in the **same transaction**, so the cache can never drift
from its inputs. (Full 3NF justification in `db-design.md`.)

The 13 spec columns are kept **1-to-1** with the model's `/predict` input, so the
mapping is a straight field rename with no translation table.

### 3.2 Authentication & session lifecycle

```
register ─▶ email verification token (hashed in DB) ─▶ verify-email
login ─▶ access JWT (15 min, response body, stored in memory)
       └─ refresh token (opaque 32B, httpOnly cookie; only SHA-256 hash in DB)

request ─▶ Authorization: Bearer <access>  ──▶  JWT guard
   401 ─▶ frontend single-flight refresh ─▶ POST /auth/refresh
            └─ rotates token (new issued, old revoked); family-reuse ⇒ revoke chain
```

- **Access token** — short-lived JWT, in the response body, held in frontend
  memory; sent as `Authorization: Bearer`.
- **Refresh token** — opaque, delivered via **httpOnly/Secure cookie** scoped to
  `/auth`; the DB stores only its SHA-256 hash. **Rotated on every use**;
  presenting a revoked token revokes the whole `familyId` chain (reuse-attack
  detection).
- **Silent restore** — on boot the frontend attempts a refresh to restore the
  session without a visible re-login; a 401 interceptor performs a **single-flight
  refresh-and-retry** so concurrent requests don't stampede.

See [`security.md`](./security.md) for the full control set (argon2id hashing,
TLS modes, AES-256-GCM at rest, audit log).

### 3.3 Recommendations

`GET /recommendations` blends two signals per candidate listing:

- **Deal score** — how far below model value the asking price sits
  (`dealDeltaPct`), already on the row.
- **Preference score** — derived from the user's **favourites** and
  **`search_history`** (the filters they've applied, stored as JSONB).

The two are combined into a ranked list, each item carrying a **"why"**
explanation. **Cold start** (no history/favourites) falls back to deal score
alone, so the rail is never empty for a new user.

---

## 4. Cross-cutting design decisions

| Decision | Rationale |
|---|---|
| **Single gateway (backend owns DB + model)** | One place for auth, validation, authz, rate limiting; the browser and model never touch each other or the DB directly. |
| **Relative URLs + Vite dev proxy** | No backend URL baked into the bundle; cookies stay same-origin; target is configurable per environment (`VITE_API_TARGET`). |
| **Access token in memory, refresh in httpOnly cookie** | Splits the XSS surface (no token in JS-readable storage) from the CSRF surface (cookie scoped + SameSite), instead of putting everything in one bucket. |
| **Valuation cached on the row** | Avoids a model round-trip on every read and makes the deal metric SQL-orderable; kept consistent by writing it in one service, in one transaction, with a history row. |
| **Spec columns 1:1 with model input** | Eliminates a translation layer between DB and model; new listings map straight to `/predict`. |
| **Stateless model service** | Inference scales horizontally and can be retrained/redeployed independently; no session or DB coupling. |
| **Contracts-first + mocks** | Typed API contracts are frozen early; mocks (e.g. `MOCK_OPTIONS`, marketplace mocks) let frontend and backend progress in parallel without blocking. |
| **Append-only history/audit tables** | Price history and the auth audit log are the literal record; never mutated, so they can't be silently rewritten. |

---

## 5. Repository layout

```
Assessment/
├── frontend/        React SPA (Studio + Marketplace + auth UI)
│   └── src/
│       ├── components/    views, fields, nav, shared UI
│       ├── context/       Auth / Favorites / MyListings / Studio / Garage providers
│       ├── lib/           api client, deal logic, formatters, mocks, types
│       └── pages/         Login / Register / VerifyEmail / ListingDetail
├── backend/         NestJS API (auth, listings, favorites, recommendations, admin)
│   ├── src/         one folder per feature module
│   └── prisma/      schema.prisma · migrations/ · seed.ts
├── model-service/   Flask random-forest valuation service
├── docs/            architecture.md · usability.md · db-design.md · security.md · API_CONTRACT.md
├── docker-compose.yml
└── .env.example
```

---

## 6. Build, run & deploy

Orchestrated with **Docker Compose** (Postgres + backend + model-service); the
frontend runs via Vite (`npm run dev`, port 5173) and proxies to the backend
(port 3000). The model service listens on 5050. Start order: **Postgres →
migrate + seed → backend + model-service → frontend**. Full setup, env vars and
troubleshooting are in the root [`README.md`](../README.md).

**Quality gates:** Jest (backend, ~180 tests), Vitest + Testing Library
(frontend components and lib logic), TypeScript type-check and ESLint. The team
works on feature branches with pull-request review; Docker gives dev/prod parity.
