# Build Ownership Breakdown

The full build is broken into five ownership areas — one per person. Each owns a coherent vertical slice so work can proceed in parallel, with the dependency order called out at the end.

---

## ✅ Rubric coverage (must-haves)

Every item below is a graded requirement. This table maps each one to its owner(s) and where it's satisfied — check it against the slide before submission.

| #   | Requirement (rubric)                        | Owner(s)                    | Where it's covered                                                 |
| --- | ------------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| 1   | Autenticación                               | Beto + Ramiro               | AuthModule (register/login/verify/logout) + auth UI                |
| 2   | Base de datos                               | Beto + Paúl + Fran          | ORM + migrations; `users`, `listings`, `favorites`, history tables |
| 3   | Seguridad, certificados, tokens, encripción | Beto                        | argon2id, JWT, httpOnly cookies, HTTPS/TLS, encryption at rest     |
| 4   | Históricos                                  | Paúl + Fran + Beto          | `listing_price_history`, `search_history`, `auth_audit_log`        |
| 5   | Manejo de sesiones                          | Beto + Ramiro               | Refresh rotation/revoke + silent-refresh interceptor               |
| 6   | UIUX, accesibilidad, usabilidad             | Ramiro + Andrés             | Semantic HTML, ARIA, keyboard nav, contrast, focus mgmt            |
| 7   | Formas normales de base de datos            | Beto (lead) + schema owners | DB design doc — normalization to 3NF with justification            |
| 8   | Diseño de base de datos y justificación     | Beto (lead) + schema owners | ER diagram + design-rationale doc                                  |

---

## 🧱 Beto — Platform foundation, Auth/Sessions & Security

**Critical path — others build on this. Ship the auth contract + guards first.**

- ✅ docker-compose for Postgres + backend + model-service; `.env` config (DB URL, JWT secrets, SMTP, model-service URL)
- ✅ Add ORM (Prisma or TypeORM) to NestJS; migration tooling
- ✅ Schema + migrations for `users`, `refresh_tokens`, `email_verification_tokens`
- [ ] AuthModule: register, login, `/auth/refresh` (rotate + revoke), logout, verify-email **(rubric #1)**
- ✅ Password hashing (argon2id); access JWT (short TTL) + refresh token in httpOnly/SameSite cookie **(rubric #3, #5)**
- [ ] Email verification flow + SMTP adapter (dev: console-log the link)
- ✅ Guards: JWT auth guard, role guard (user/admin); rate-limiter + class-validator pipe wired globally
- [ ] **Security/encripción (rubric #3):** HTTPS/TLS in front of the API (self-signed cert for dev, real cert for deploy); enforce HTTPS redirect + HSTS; encrypt sensitive columns at rest (e.g. contact info) and document the TLS-in-transit story
- [ ] **Históricos (rubric #4):** `auth_audit_log` (login attempts, token rotations, role changes) with a read endpoint for admin
- ✅ **DB design docs (rubric #7, #8):** own the ER diagram + the normalization (1NF→3NF) write-up with justification; collect schema input from Paúl/Fran
- [ ] **Reduce model input fields (field inference):** shrink the form the user fills out by deriving fields instead of asking for them — e.g. infer engine/cylinders from `model` + `year`, and infer the powertrain type (electric / gas / hybrid) from `model` + `year`. User enters fewer fields; the rest are looked up (reference table keyed on make/model/year) or defaulted, with an override option. Coordinates with Paúl (SpecForm + `listings` fields) and Fran (model-service inputs).
- ✅ Publish the API contract (endpoints + DTOs) so frontend/others aren't blocked
- [ ] Own the end-to-end integration test (register → verify → list → browse → recommend)

## 🚗 Paúl — Listings & Marketplace backend

**Depends on Beto's DB + auth guards.**

- ✅ Schema + migration for `listings` (13 spec fields, asking_price, description, contact, status, predicted_value/low/high, deal_delta_pct)
- ✅ ListingsModule CRUD; ownership guard (only owner/admin edits); verified-user-only to publish
- ✅ Valuation-on-write: call model-service once on create/update, store predicted value/low/high + compute deal_delta_pct
- ✅ Deal-badge logic (Under / Fair / Over priced) derived from stored values
- ✅ **Históricos (rubric #4):** `listing_price_history` — append a row on every asking_price / valuation change (timestamp, old/new); detail endpoint exposes the trend
- ✅ Marketplace browse endpoint: filters (make, type, price band, state), sort, pagination
- ✅ Listing-detail endpoint (full specs + valuation + seller contact + price history)
- ✅ Contribute `listings` table design + normalization notes to Beto's DB design doc **(rubric #7, #8)**
- ✅ Unit tests: CRUD, ownership rules, deal_delta computation, price-history append

## 🎯 Fran — Recommendations + Favorites + model-service

**Depends on listings & favorites tables.**

- ✅ Schema + migration for `favorites`; FavoritesModule (add/remove/list)
- ✅ **Históricos (rubric #4):** persist `search_history` (filters + timestamp per user); reuse it as the recency signal for recommendations
- ✅ Preference-profile builder from favorites + `search_history` (make, body, year proximity, price band, drivetrain/fuel)
- ✅ RecommendationsModule: deal_score, preference_score, combined = 0.5·deal + 0.5·pref, cold-start → deal only
- ✅ GET `/recommendations`: top-N active listings, exclude own, attach "why" string
- ✅ model-service: add a batch valuation endpoint if per-listing `/predict` proves chatty; otherwise confirm existing endpoints suffice
- ✅ Contribute `favorites` + `search_history` design + normalization notes to Beto's DB design doc **(rubric #7, #8)**
- ✅ Unit tests: scoring on fixtures (deterministic), cold-start path, "why" strings

## 🔐 Ramiro — Frontend: Auth, sessions & app shell

**Depends on Beto's auth contract.**

- [ ] Register / login / verify-email landing pages
- [ ] API client auth: attach access token, silent refresh interceptor on 401, cookie handling **(rubric #5)**
- [ ] Auth context/provider + protected routes; account menu (logout, role-aware admin link)
- [ ] Nav integration: add Marketplace + Sell + account entry points alongside existing Studio
- [ ] **Accesibilidad/usabilidad (rubric #6):** semantic HTML, ARIA labels on forms/nav, full keyboard navigation, visible focus states, WCAG AA color contrast; establish the shared a11y baseline the rest of the UI inherits
- [ ] Component tests: auth forms (validation, error states), refresh flow, basic a11y checks

## 🛒 Andrés — Frontend: Marketplace, listings, favorites & recs UI

**Depends on Paúl + Fran endpoints and Ramiro's shell.**

- [ ] Marketplace view: filter bar, listing grid, ListingCard with deal badge
- [ ] "Recommended for you" rail (consumes `/recommendations`, shows "why" text)
- [ ] Listing detail: reuse existing analysis views (valuation vs asking, deal verdict, depreciation, price history) + seller contact + ♥ favorite button
- [ ] Sell / My Listings: create/edit/delete (reuse SpecForm + asking price + contact), status toggle, shows model valuation
- [ ] Favorites view; "List this car →" bridge from a garage card to a new listing
- [ ] **Accesibilidad/usabilidad (rubric #6):** follow Ramiro's a11y baseline — keyboard-operable filters/cards/favorite toggle, ARIA on interactive controls, accessible deal-badge labels (not color-only), responsive/usable layout
- [ ] Component tests: deal-badge logic, listing card, favorite toggle, a11y of interactive controls

---

## 🔗 Shared / cross-cutting (whole team)

- **Contracts-first:** agree on DTO/type shapes in a shared types file early — frontend (Ramiro/Andrés) mocks against them so they don't wait on backend.
- **DB design doc (rubric #7, #8):** Beto owns the consolidated ER diagram + normalization write-up; Paúl and Fran each hand over their table designs and rationale. This is a single graded artifact — don't leave it to the night before.
- **Out of scope for v1** (everyone holds the line): in-app messaging, offers, payments, ratings, real photo upload (single image-URL field only).
- Each person tests their own slice; Beto owns the integration e2e that proves the seam.

---

## 🌟 Nice to haves (prioritized by complexity)

Not required by the rubric. Ordered so you can grab the cheap wins first and stop wherever time runs out. Complexity = rough effort/risk, not value.

### 🟢 Low complexity — cheap polish, grab these first

- [ ] **Dark/light theme toggle** — mostly CSS variables; low risk, good demo value.
- [ ] **Empty/loading/error states** across views — skeleton loaders, "no results" messaging. Improves the usabilidad story (#6) for almost no architectural cost.
- [ ] **Saved-search shortcuts** — let a user re-apply a past `search_history` entry with one click (data already exists).
- [ ] **Listing share link** — copy-to-clipboard of the public detail URL.
- [ ] **Basic admin dashboard counts** — total users / listings / favorites (simple aggregate queries).

### 🟡 Medium complexity — solid additions if time allows

- [ ] **Password reset flow** — reuses the email/token infrastructure from verification; new endpoints + UI.
- [ ] **Image upload to storage** (replacing the single image-URL field) — needs storage (S3/local) + validation; touches both back and front.
- [ ] **Pagination + infinite scroll** on the marketplace beyond basic page params.
- [ ] **Price-drop notifications** — leverage `listing_price_history` to flag favorited cars whose price fell (in-app badge, no email needed).
- [ ] **Seller profile page** — public view of a seller's active listings.
- [ ] **Saved/compare listings** — side-by-side spec + valuation comparison.

### 🔴 High complexity — only with real time buffer

- [ ] **In-app messaging** between buyer and seller (was explicitly out of scope for v1 — non-trivial: threads, read state, sockets).
- [ ] **Offers/negotiation flow** — state machine, notifications, authorization edges.
- [ ] **Real-time recommendation re-ranking** as the user browses (websocket + online scoring).
- [ ] **OAuth / social login** — third-party provider integration on top of the existing auth.
- [ ] **Analytics dashboard with charts** — event tracking pipeline + aggregation + visualization.

**Rule of thumb if short on time:** ship the 🟢 row first (each is a few hours and most reinforce rubric #6), then cherry-pick from 🟡. Leave 🔴 unless the must-haves are fully done and tested.

---

## ⏱️ Suggested sequencing

1. Beto lands DB + auth contract + guards + TLS/security baseline (unblocks everyone).
2. Paúl (listings) and Ramiro (auth UI + a11y baseline) start in parallel against Beto's contract.
3. Fran (recs/favorites/search-history) starts once listings schema exists; Andrés starts against mocked endpoints, then wires to real ones as Paúl/Fran land them.
4. Beto consolidates the ER diagram + normalization doc as schemas stabilize (don't leave for the end).
5. Pick up 🟢 nice-to-haves only once every rubric item is green.
