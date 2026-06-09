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

*This document will be extended as new tables are added (saved appraisals, audit log, etc.).*
