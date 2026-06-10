# Database Design

> Migration: `20260609181917_auth_init`
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

### Third Normal Form (3NF)

Every non-key attribute depends on the whole key and nothing but the key:
- `User`: all fields describe the user, no transitive dependency.
- `RefreshToken`: `tokenHash`, `familyId`, `expiresAt`, `revokedAt` all directly describe the token row, not the user.
- `EmailVerificationToken`: same pattern — no derived or repeated data.

No many-to-many join tables needed at this stage; relations are 1:N (User → tokens).

---

## Entity Relationship

```
User 1 ──< RefreshToken
User 1 ──< EmailVerificationToken
```

---

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
