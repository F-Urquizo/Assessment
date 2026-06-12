# High-Level Design — Bluebook

> Used-car marketplace and ML valuation platform. Three deployable services
> plus a database, orchestrated with Docker Compose.
> Companion docs: [`low-level-design.md`](./low-level-design.md),
> [`architecture.md`](./architecture.md), [`db-design.md`](./db-design.md),
> [`security.md`](./security.md), [`API_CONTRACT.md`](./API_CONTRACT.md).

---

## 1. What Bluebook Does

Bluebook solves one problem: **every used car listing shows whether the price
is fair**. A machine-learning model (random forest, trained on a large dataset
of US used-car sales) is embedded into the platform so that:

- **Buyers** see a deal badge — *Great deal / Good buy / Fair price / A bit
  high / Overpriced* — on every listing without any extra steps.
- **Sellers** can appraise their own car before listing, see value drivers and
  a 5-year depreciation forecast, then carry that appraisal into a pre-filled
  listing form.
- **The recommendation rail** surfaces listings that are both underpriced and
  match the user's browsing and favourites history.

---

## 2. System Overview

Bluebook is split into three deployable services plus a database.

```
              ┌──────────────┐    Vite proxy (dev)     ┌──────────────────────┐
  Browser ───▶│   Frontend   │ ── /auth /listings ───▶ │       Backend        │
   (SPA)      │ React + Vite │    /favorites           │   NestJS gateway     │
              │   port 5173  │    /recommendations      │      port 3000       │
              └──────────────┘                          └──────────┬───────────┘
                                                                   │
                                               Prisma ORM          │  HTTP (server-to-server)
                                        ┌──────────────────────────┼──────────────────────┐
                                        ▼                                                  ▼
                                 ┌─────────────┐                                 ┌─────────────────┐
                                 │ PostgreSQL  │◀── valuation written to row ───▶│  model-service  │
                                 │   port 5432 │    on every create / edit        │  Flask + RF     │
                                 └─────────────┘                                 │  port 5050      │
                                                                                  └─────────────────┘
```

**Boundary rule:** the browser never reaches PostgreSQL or the model service
directly. All traffic funnels through the NestJS gateway, which is where
authentication, validation, authorization, and rate-limiting live.

---

## 3. Services

### 3.1 Frontend

| Property | Value |
|---|---|
| Framework | React 19 + TypeScript 6 |
| Build tool | Vite 8 |
| Router | React Router 7 |
| Testing | Vitest 4 + Testing Library |
| Port (dev) | 5173 |

A single-page application. All API calls use **relative paths** forwarded by
the Vite dev proxy to `http://127.0.0.1:3000` — no backend URL is baked into
the bundle. The proxy target is overridable via `VITE_API_TARGET`.

**Seven routes:**

| Route | View | Auth required |
|---|---|---|
| `/` | Marketplace — listing grid, filters, recommendations rail | No |
| `/listings/:id` | Listing detail — valuation analysis, price history, seller contact, favourite | No |
| `/studio` | Valuation Studio — step-by-step appraisal wizard, garage, head-to-head compare | No |
| `/favorites` | Saved listings | **Yes** (redirects to `/login`) |
| `/login` | Login | No |
| `/register` | Registration | No |
| `/verify-email` | Email verification landing | No |

### 3.2 Backend

| Property | Value |
|---|---|
| Framework | NestJS 11 |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Auth | Passport-JWT, argon2id, httpOnly cookies |
| Security | Helmet, `@nestjs/throttler` |
| API docs | Swagger at `/docs` |
| Email | Nodemailer |
| Tests | 196 tests, 15 suites (Jest) |
| Port | 3000 |

The backend is the **single gateway**: it owns the database, issues and
validates tokens, and is the only service that calls the model. It is
organized into eleven feature modules (Auth, Listings, Favorites,
Recommendations, Model, Admin, Audit, Crypto, Mail, Users, Prisma).

### 3.3 Model Service

| Property | Value |
|---|---|
| Language | Python |
| Web framework | Flask 3.0.3 |
| ML library | scikit-learn 1.6.1 |
| Model type | Random forest |
| Model artifact | `model_artifacts.joblib` (~107 MB, via Git LFS) |
| Port | 5050 |

A **stateless** inference service — no database, no authentication. It
exposes six HTTP endpoints and is only ever called by the NestJS backend on
the internal Docker network.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness check |
| `GET /options` | Valid option sets for every spec dropdown |
| `GET /api/intel` | Pre-computed market intelligence (segment medians, percentiles) |
| `POST /predict` | Point estimate + 10th/90th-percentile interval for one vehicle |
| `POST /analyze` | Full appraisal: estimate, value drivers, depreciation forecast, market context |
| `POST /compare` | Slim analysis for up to 4 vehicles with best-value and holds-value awards |

### 3.4 Database

PostgreSQL 16 accessed through Prisma 6. Eight tables: `User`, `Listing`,
`ListingPriceHistory`, `RefreshToken`, `EmailVerificationToken`, `Favorite`,
`SearchHistory`, `AuditLog`. Schema and normalization rationale in
[`db-design.md`](./db-design.md).

---

## 4. Key Design Decisions

### Valuation on write, not on read

When a listing is created or edited, the backend immediately calls
`POST /predict` and stores the result (`predictedValue`, `predictedLow`,
`predictedHigh`, `dealDeltaPct`) on the `Listing` row. Browse and detail reads
never block on a Python round-trip, and `dealDeltaPct` is SQL-filterable and
sortable for deal badges and "best deal" ordering.

### Single gateway

The browser and the model service never communicate directly. One place for
auth, validation, authorization, and rate-limiting.

### Access token in memory, refresh token in httpOnly cookie

Splits the XSS surface (no token in JS-readable storage) from the CSRF surface
(cookie is scoped and SameSite-controlled). The access token lives in React
state and is lost on refresh; a silent `/auth/refresh` call restores it on
boot if the cookie is still valid.

### Contracts-first with mocks

`/options` (the dropdown data) is fetched once at app boot. If it is
unreachable, `MOCK_OPTIONS` keeps the marketplace usable, allowing frontend
development to proceed without a live backend.

### Append-only history and audit

`ListingPriceHistory` and `AuditLog` are never mutated by the application.
They are the literal record of what happened.

---

## 5. Authentication Flow

```
Register  ──▶  argon2id hash stored  ──▶  verification email sent
                                                │
                                          verify-email link
                                                │
Login  ──▶  access JWT (15 min, in response body, held in memory)
       └──  refresh token (httpOnly cookie, 7 days, path=/auth)
                                                │
             every /auth/refresh  ──▶  token rotation
             revoked token replayed ──▶  entire familyId chain revoked
```

---

## 6. Recommendations

1. Pull 200 candidate active listings (excluding the requester's own).
2. Score each by **deal score** (normalized `dealDeltaPct`) and **preference
   score** (last 90 days of favourites + search history across make, type,
   fuel, drivetrain).
3. Combine: `0.5 × deal + 0.5 × preference`.
4. **Cold start** (no history) → deal score only; the rail is never empty.
5. Each result carries a human-readable "why" explanation.

---

## 7. Team Ownership

| Member | Area |
|---|---|
| **Beto** | Platform foundation, Auth/Sessions, Security, DB design & normalisation |
| **Paúl** | Listings & Marketplace backend (CRUD, valuation-on-write, browse, price history) |
| **Fran** | Recommendations, Favourites & model service |
| **Ramiro** | Frontend auth, sessions & app shell (routing, login, protected routes) |
| **Andrés** | Frontend Marketplace, listings, favourites & recommendations UI |

---

## 8. Repository Layout

```
Assessment/
├── frontend/          React SPA (Studio + Marketplace + auth UI)
├── backend/           NestJS API (auth, listings, favorites, recommendations, admin)
│   └── prisma/        schema.prisma · migrations/ · seed.ts
├── model-service/     Flask random-forest valuation service
├── docs/              architecture · high-level-design · low-level-design ·
│                      db-design · security · usability · API_CONTRACT
├── docker-compose.yml
└── .env.example
```

---

## 9. Infrastructure & Quality Gates

- **Docker Compose** orchestrates Postgres + backend + model-service. Frontend
  runs via `npm run dev` (Vite, port 5173).
- **Start order**: Postgres → migrate + seed → backend + model-service → frontend.
- **Seed data**: 3 verified demo users (`alice/bob/carol@demo.test`,
  password `Password123!`), 12 active listings with pre-computed valuations.
- **Quality gates**: Jest 196 tests (backend), Vitest + Testing Library
  (frontend), TypeScript type-check, ESLint.
- **Live API docs**: Swagger at `http://localhost:3000/docs`.
