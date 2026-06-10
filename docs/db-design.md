# Database Design

> Migrations: `20260609181917_auth_init` · `20260610033940_listings_init` · `20260610171233_listing_price_history`
> ORM: Prisma 6 · Provider: PostgreSQL 16

---

## Tables

### `User`

Stores the canonical identity record for every account.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (cuid) | Collision-resistant, URL-safe, no sequence lock contention |
| `email` | `TEXT UNIQUE` | Lowercased before insert at the service layer |
| `passwordHash` | `TEXT` | bcrypt hash; raw password never persisted |
| `role` | `Role` enum | `user` \| `admin`; stored as Postgres enum for constraint enforcement |
| `emailVerified` | `BOOLEAN` | Guards access to protected routes until email is confirmed |
| `createdAt` | `TIMESTAMP` | Immutable audit field |
| `updatedAt` | `TIMESTAMP` | Auto-maintained by Prisma on every write |

**Indexes:** unique index on `email` (also doubles as the B-tree index for login lookups).

---

### `RefreshToken`

Implements stateful refresh-token rotation with reuse-attack detection.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (cuid) | PK |
| `userId` | `TEXT` | FK → `User.id` `ON DELETE CASCADE` |
| `tokenHash` | `TEXT` | SHA-256 of the raw token — DB never stores cleartext |
| `familyId` | `TEXT` | Groups the full rotation chain for one login session |
| `expiresAt` | `TIMESTAMP` | Hard expiry; service rejects tokens past this date |
| `revokedAt` | `TIMESTAMP?` | Nullable — set when the token is consumed or invalidated |
| `createdAt` | `TIMESTAMP` | Issued-at reference |

**Why only hashes?** A stolen DB dump cannot be used to forge sessions — an attacker needs both the hash in the DB and the raw token the client holds.

**Why `familyId`?** RFC-recommended reuse-attack pattern: when a token that was already revoked is presented again (possible replay attack), the server invalidates the entire `familyId` chain, forcing the real user to log in again.

**Indexes:** `userId` (cascade queries), `familyId` (family-revocation queries), `tokenHash` (O(1) lookup on every refresh request).

---

### `EmailVerificationToken`

Single-use tokens sent by email to confirm account ownership.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (cuid) | PK |
| `userId` | `TEXT` | FK → `User.id` `ON DELETE CASCADE` |
| `tokenHash` | `TEXT` | SHA-256 of the raw token in the email link |
| `expiresAt` | `TIMESTAMP` | Short TTL (e.g. 24 h) to limit exposure window |
| `usedAt` | `TIMESTAMP?` | Set on first valid use; subsequent presentations rejected |
| `createdAt` | `TIMESTAMP` | Issued-at reference |

**Why `usedAt` instead of deleting the row?** Preserves an audit trail and prevents race conditions where two near-simultaneous clicks on the same link could both pass a simple "exists?" check before deletion commits.

**Index:** `tokenHash` — the only access pattern is a point lookup by hash on every click of the verification link.

---

### `Listing`

A marketplace vehicle listing. The first 13 columns (`manufacturer`…`state`) are the **exact** feature set the model-service `/predict` endpoint consumes — keeping them 1-to-1 with the model input means valuation-on-write is a straight field map (camelCase → snake_case) with no translation table. The `predicted*` / `dealDeltaPct` columns are **derived** values written by the service, never accepted from the client.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (cuid) | PK |
| `manufacturer` | `TEXT` | Spec. Free string — model-service maps unknowns to `other` rather than rejecting |
| `model` | `TEXT` | Spec. Free string (same reason) |
| `year` | `INTEGER` | Spec. Constrained 1990–2021 at the DTO |
| `odometer` | `INTEGER` | Spec. Miles |
| `cylinders` | `INTEGER?` | Spec. Nullable — model-service defaults to the dataset median |
| `condition` | `TEXT` | Spec. One of a fixed option set (DTO-validated) |
| `fuel` | `TEXT` | Spec. Fixed option set |
| `titleStatus` | `TEXT` | Spec. Fixed option set |
| `transmission` | `TEXT` | Spec. Fixed option set |
| `drive` | `TEXT` | Spec. Fixed option set |
| `type` | `TEXT` | Spec. Fixed option set (body style) |
| `paintColor` | `TEXT` | Spec. Fixed option set |
| `state` | `TEXT` | Spec. US state code |
| `askingPrice` | `INTEGER` | Marketplace. Seller's price |
| `description` | `TEXT?` | Marketplace. Free copy |
| `contactEmail` | `TEXT` | Marketplace. Buyer contact |
| `contactPhone` | `TEXT?` | Marketplace. Optional |
| `status` | `ListingStatus` enum | `draft` \| `active` \| `sold`. Publishing (`active`) requires a verified email |
| `predictedValue` | `INTEGER?` | **Derived.** Model-service point estimate; null if valuation was unavailable |
| `predictedLow` | `INTEGER?` | **Derived.** Lower bound of the estimate |
| `predictedHigh` | `INTEGER?` | **Derived.** Upper bound of the estimate |
| `dealDeltaPct` | `DOUBLE PRECISION?` | **Derived.** `(askingPrice − predictedValue) / predictedValue × 100`. Negative = below market |
| `userId` | `TEXT` | FK → `User.id` `ON DELETE CASCADE` (owner) |
| `createdAt` | `TIMESTAMP` | Immutable audit field |
| `updatedAt` | `TIMESTAMP` | Auto-maintained by Prisma |

**Why store the derived valuation columns?** They are cached results of an expensive, out-of-band call to the Python model-service. Browse and detail reads must not block on a model round-trip, and the deal badge / `bestDeal` sort need `dealDeltaPct` to be filterable and orderable in SQL. They are a deliberate, controlled denormalization — see the 3NF note below.

**Indexes:** `userId` (owner's listings, cascade), `status` (browse filters to `active`), `manufacturer` (a common browse filter).

---

### `ListingPriceHistory`

Append-only audit trail: one row every time a listing's `askingPrice` **or** its valuation (`predictedValue`, `predictedLow`, or `predictedHigh`) changes — including the initial create. Written **in the same transaction** as the `Listing` write, so a price never exists without the row that explains it.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (cuid) | PK |
| `listingId` | `TEXT` | FK → `Listing.id` `ON DELETE CASCADE` |
| `oldAskingPrice` | `INTEGER?` | Null on the initial `created` row |
| `newAskingPrice` | `INTEGER` | Asking price after the change |
| `oldPredictedValue` | `INTEGER?` | Point estimate before the change (nullable) |
| `newPredictedValue` | `INTEGER?` | Point estimate after the change (nullable) |
| `oldPredictedLow` | `INTEGER?` | Lower valuation bound before the change (nullable) |
| `newPredictedLow` | `INTEGER?` | Lower valuation bound after the change (nullable) |
| `oldPredictedHigh` | `INTEGER?` | Upper valuation bound before the change (nullable) |
| `newPredictedHigh` | `INTEGER?` | Upper valuation bound after the change (nullable) |
| `reason` | `PriceChangeReason` enum | `created` \| `asking_price_change` \| `revaluation` |
| `changedAt` | `TIMESTAMP` | When the change was recorded |

**Why append-only?** The trend shown on the listing detail page is the literal sequence of these rows; mutating or deleting them would corrupt the history. The current price always lives on `Listing` — this table is the log of how it got there.

**`reason` semantics:** `created` on insert; `asking_price_change` when only the seller's price moved; `revaluation` when a spec edit changed any valuation field (`predictedValue`, `predictedLow`, or `predictedHigh`). When price and valuation both move in one update, a single `revaluation` row is written (the more informative of the two).

**Indexes:** `listingId` (fetch a listing's trend), `changedAt` (chronological ordering / range scans).

---

## Design Rationale

### Token storage: hashes only

Storing `tokenHash = SHA-256(rawToken)` follows the same principle as password hashing: a compromised database does not immediately yield valid credentials. The raw token travels only over TLS in the HTTP response / email link and is never written to disk on the server side.

### Foreign keys with `ON DELETE CASCADE`

When a `User` row is deleted, all associated `RefreshToken` and `EmailVerificationToken` rows are removed atomically by the DB engine — no application-layer cleanup code required and no orphan rows.

### Primary keys: cuid over autoincrement

`cuid()` keys are:
- **Non-sequential** — IDs in URLs/JWTs don't leak insertion order or row count.
- **No sequence lock** — distributed inserts never contend on a single counter.
- **URL-safe** — no escaping needed in tokens or route params.

### Normalization (1NF → 3NF)

**1NF — atomic columns, no repeating groups.** Every column holds a single scalar. The 13 spec fields are individual columns rather than a serialized blob, so they can be filtered/indexed and fed straight to `/predict`. A listing's price history is *not* a repeating group stuffed into the `Listing` row — it is factored out into its own `ListingPriceHistory` table, one row per change.

**2NF — every non-key attribute depends on the whole PK.** All tables use a single-column surrogate PK (`cuid`), so there are no composite keys and therefore no partial-dependency risk: each attribute depends on that one id.

**3NF — no transitive dependencies, with one documented exception.**
- `User`, `RefreshToken`, `EmailVerificationToken`, `ListingPriceHistory`: every non-key column directly describes its own row, with no derived or transitively-dependent data.
- `Listing` **intentionally caches derived values** — `predictedValue`, `predictedLow`, `predictedHigh`, and `dealDeltaPct` are functions of the spec fields and `askingPrice`, so in strict 3NF they would be recomputed rather than stored. They are denormalized on purpose because:
  - the inputs come from an **external service** (the Python valuation model), not from columns in the same row, so this is a cached cross-system result rather than a classic intra-row transitive dependency;
  - browse/detail reads would otherwise pay a model round-trip on every request, and `dealDeltaPct` must be SQL-filterable/sortable for the deal badge and `bestDeal` ordering.

  **The consistency rule that makes this safe:** these columns are written **only** by `ListingsService`, recomputed on every create and on every price/spec change, and **mirrored into `ListingPriceHistory` in the same transaction**. The client can never set them (the validation pipe whitelists them out and the service overwrites them), so the cache cannot drift from its inputs.

Relations remain 1:N (`User` → listings/tokens, `Listing` → price history); no many-to-many join tables are needed at this stage.

---

## Entity Relationship

```
User 1 ──< RefreshToken
User 1 ──< EmailVerificationToken
User 1 ──< Listing
Listing 1 ──< ListingPriceHistory
```

---

*This document will be extended as new tables are added (favorites, search history, etc.).*
---

### `AuditLog` (table: `auth_audit_log`)

Append-only event store for authentication and authorization events. Designed for forensic analysis and compliance, not application state.

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT` (cuid) | PK |
| `userId` | `TEXT?` | Nullable FK → `User.id` `ON DELETE SET NULL` |
| `event` | `AuditEvent` enum | One of 8 event types (see enum) |
| `ip` | `TEXT?` | Client IP extracted by the controller layer |
| `userAgent` | `TEXT?` | `User-Agent` header value |
| `metadata` | `JSONB?` | Per-event context (e.g. attempted email on login_failure, familyId on reuse) |
| `createdAt` | `TIMESTAMP` | Immutable insert-time |

**Why `ON DELETE SET NULL` (not Cascade)?** Audit rows must survive user deletion — they are part of the security record. A deleted user's login history and anomaly events should remain readable for compliance and forensic investigation. `SET NULL` preserves the row while removing the FK reference; a row with `userId = null` simply indicates the associated account no longer exists.

**Why nullable `userId`?** Some events have no associated user — specifically `login_failure` for an email that doesn't exist in the database. Forcing a `NOT NULL` constraint would prevent logging these events, which are among the most security-relevant (brute-force probing).

**Why `metadata: JSONB`?** Different events carry structurally different context (`email` for `login_failure`, `familyId` for `refresh_reuse_detected`, `newRole` for `role_changed`). A single JSONB column per row avoids a sparse multi-column design or a separate polymorphic key-value table. All scalar columns (`event`, `ip`, `userAgent`, `createdAt`) remain 3NF — metadata is contextual payload, not a derived or repeated fact.

**Append-only pattern**: rows are never updated or deleted by the application. `revokedAt`-style mutations don't exist here — an audit log that can be rewritten isn't an audit log.

**Indexes:** `userId` (filter/paginate by user), `event` (filter by event type), `createdAt` (newest-first pagination, the default read pattern).

---

## Entity Relationship

```
User 1 ──< RefreshToken
User 1 ──< EmailVerificationToken
User 1 ──< AuditLog   (userId nullable; row survives user deletion)
```

---

*This document will be extended as new tables are added (saved appraisals, etc.).*
