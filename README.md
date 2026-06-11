# Bluebook — Used-Car Marketplace & Valuation Platform

A full-stack used-car platform that combines a **machine-learning vehicle
appraisal studio** with a **peer-to-peer marketplace**. Sellers list cars, the
model values every listing on write, and buyers browse, get personalised
recommendations, and see at a glance whether each car is **under-, fairly-, or
over-priced**.

---

## What it does

- **Valuation Studio** — enter a vehicle's specs through a step-by-step card
  wizard and a random-forest model returns an estimate, value range, depreciation
  forecast, value drivers and market context. Save cars to a garage and compare
  them head-to-head.
- **Marketplace** — browse community listings with filters (maker, body type,
  state, price band) and sorting; each card shows a **deal badge** (Under / Fair /
  Over priced) derived from the model.
- **Listing detail** — a visual over/under-valued analysis (asking vs. model
  value), deal verdict, price history, seller contact and a favourite button.
- **Recommendations** — a "Recommended for you" rail combining a deal score with
  a preference score (favourites + search history).
- **Sell / My Listings** — create, edit, delete and toggle the status of your own
  listings; "List this car →" bridges a saved appraisal into a new listing.
- **Favourites** — save listings to a per-user, protected favourites view.
- **Accounts & sessions** — register, email verification, login, silent session
  restore, refresh-token rotation, logout, protected routes and a session-aware
  nav.
- **Accessibility** — keyboard-operable controls, ARIA, colour-blind-safe deal
  badges (text + symbol, not colour alone), WCAG-AA contrast, reduced-motion
  support and a **dark mode**.

---

## Architecture

```
            ┌─────────────┐      proxy       ┌──────────────────┐
 Browser ──▶│  Frontend   │ ───────────────▶ │     Backend      │
            │ React + Vite│  /listings /auth │  NestJS gateway  │
            └─────────────┘  /recommendations└────────┬─────────┘
                                                       │ Prisma
                                          ┌────────────┼─────────────┐
                                          ▼            ▼             ▼
                                   ┌────────────┐ ┌─────────┐ ┌─────────────┐
                                   │ PostgreSQL │ │  /pred. │ │ model-service│
                                   │   (Prisma) │ │ /analyze│ │ Flask + RF   │
                                   └────────────┘ └─────────┘ └─────────────┘
```

| Layer | Tech |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 8, React Router 7, Vitest + Testing Library |
| **Backend** | NestJS 11, Prisma 6, PostgreSQL 16, Passport-JWT, argon2, class-validator, Helmet, Throttler, Swagger, Nodemailer |
| **Model service** | Python, Flask, scikit-learn (random forest), pandas/NumPy, joblib |
| **Infra** | Docker Compose (Postgres + backend + model-service), Git LFS (model artifact) |

---

## Repository layout

```
Assessment/
├── frontend/        React app (Studio + Marketplace + auth UI)
├── backend/         NestJS API (auth, listings, favorites, recommendations, admin)
├── model-service/   Flask random-forest valuation service
├── docs/            API_CONTRACT.md · db-design.md · security.md
├── docker-compose.yml
├── .env.example
└── build-ownership-breakdown (1).md   (WBS / team ownership)
```

---

## Prerequisites

- **Node ≥ 22.12** (required by Vite 8 / Vitest 4)
- **Docker Desktop** (recommended path) — or **PostgreSQL + Python 3** for native
- **Git LFS** — the trained model (`model-service/model_artifacts.joblib`, ~107 MB)
  ships via LFS. After cloning:
  ```bash
  git lfs install && git lfs pull
  ```
- A `.env` in the repo root — copy and fill it:
  ```bash
  cp .env.example .env
  # generate the 64-hex encryption key:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Set `ENCRYPTION_KEY` (64 hex) and `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
  (≥ 32 chars).

---

## Running the app

### Option A — Docker (recommended)

```bash
# 1. Postgres + backend (auto-migrates) + model-service
docker compose up -d --build

# 2. Seed demo data (not auto-run)
docker compose exec backend npx prisma db seed

# 3. Frontend (not in compose) — separate terminal
cd frontend && npm install && npm run dev      # http://localhost:5173
```

### Option B — Native

```bash
# 0. Postgres running (local, or: docker compose up -d postgres)
#    backend/.env must point DATABASE_URL at localhost:5432

# 1. Model service
cd model-service && pip install -r requirements.txt && python service.py   # :5050

# 2. Backend
cd backend && npm install
npx prisma migrate deploy && npx prisma db seed
npm run start:dev                                                          # :3000

# 3. Frontend
cd frontend && npm install && npm run dev                                  # :5173
```

> **Start order:** Postgres → migrate + seed → backend + model-service → frontend.

### Verify

| Check | URL |
|---|---|
| Backend health | http://localhost:3000/health |
| **API docs (Swagger)** | http://localhost:3000/docs |
| Frontend | http://localhost:5173 |

**Demo login:** `alice@demo.test` / `Password123!`

---

## Seed data

`backend/prisma/seed.ts` (idempotent) creates **3 verified users**
(`alice/bob/carol@demo.test`, password `Password123!`), **12 active listings**
with pre-computed valuations + deal badges, price history, and demo favourites.
Run it with `npx prisma db seed`. Without it the database has no users and login
returns `401`.

---

## Testing

```bash
# Backend (NestJS / Jest)
cd backend && npm test

# Frontend (Vitest)
cd frontend && npm run test:run

# Type-check + lint
cd frontend && npx tsc -b && npm run lint
```

---

## Documentation

| Doc | Contents |
|---|---|
| **Swagger** `/docs` | Live, interactive OpenAPI for every endpoint |
| `docs/API_CONTRACT.md` | Auth API contract (shapes, status codes, cookies) |
| `docs/db-design.md` | ER diagram + normalisation (1NF→3NF) rationale |
| `docs/security.md` | Security model (hashing, tokens, TLS, encryption) |
| `backend/README.md` · `frontend/README.md` | Per-package setup |
| `build-ownership-breakdown (1).md` | Work-breakdown structure / ownership |

---

## Team & ownership (WBS)

| Member | Area |
|---|---|
| **Beto** | Platform foundation, Auth/Sessions, Security, DB design & normalisation |
| **Paúl** | Listings & Marketplace backend (CRUD, valuation-on-write, browse, history) |
| **Fran** | Recommendations, Favourites & the model-service |
| **Ramiro** | Frontend auth, sessions & app shell (routing, login, protected routes) |
| **Andrés** | Frontend Marketplace, listings, favourites & recommendations UI |

---

## Troubleshooting

- **Frontend not reaching the backend?** The Vite proxy is read **only at
  startup** — after `git pull`, **restart `npm run dev`**. The proxy also only
  exists in dev (`npm run dev`), not in `vite preview`/builds.
- **Backend on a different port?** The proxy targets `http://127.0.0.1:3000`;
  override with `VITE_API_TARGET` (e.g. `https://127.0.0.1:3443` under TLS).
- **Model service returns 503?** The `.joblib` is missing — run `git lfs pull`
  or retrain with `cd model-service && python train_model.py`.
- **Login returns 401?** Run the seeder (`npx prisma db seed`); a freshly
  registered user must verify their email (the dev backend logs the link).
