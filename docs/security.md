# Security Architecture — Rúbrica #3

This document covers every security control implemented across the NestJS backend.  
Controls are grouped by the layer they protect.

---

## 1. Password Storage — argon2id

**Implementation:** `backend/src/auth/auth.service.ts` (`register`)

Passwords are hashed with **argon2id** (hybrid of Argon2i + Argon2d) before being written to the database. The raw password never touches disk; the `passwordHash` column stores only the digest.

| Parameter | Value | Rationale |
|---|---|---|
| Algorithm | argon2id | Resistant to both side-channel (i) and GPU attacks (d) |
| Time cost | library default (3) | Tuned for ~300 ms on commodity hardware |
| Memory cost | library default (65536 KB) | Memory-hard: GPU parallelism becomes cost-prohibitive |
| Parallelism | library default (4) | Multi-core but bounded |

The `User.passwordHash` column is **never** included in API responses. `UsersService.toPublic()` strips it before returning data to callers.

---

## 2. Token Architecture — JWT + httpOnly Cookies

**Implementation:** `backend/src/auth/auth.service.ts`, `auth.controller.ts`, `jwt.strategy.ts`

### Access token
- Short-lived JWT (default 15 minutes), signed with `JWT_ACCESS_SECRET`.
- Delivered in the **response body** only.
- The frontend stores it **in memory** (not `localStorage`, not `sessionStorage`) to prevent XSS exfiltration.
- Sent as `Authorization: Bearer <token>` on subsequent requests.

### Refresh token
- Opaque 32-byte random token. Only the **SHA-256 hash** is stored in the database (`RefreshToken.tokenHash`). A stolen DB dump yields nothing usable.
- Delivered via a **httpOnly/Secure cookie** (`path=/auth`). JavaScript cannot read it.
- Cookie attributes are config-driven (`COOKIE_SAME_SITE`, `COOKIE_SECURE`).
- **Rotation on every use:** each `POST /auth/refresh` issues a new token and revokes the old one.
- **Reuse-attack detection:** tokens in the same `familyId` chain. Presenting a previously-revoked token immediately revokes the entire family and forces re-login.

### CORS
- `credentials: true` is required for the cookie to travel cross-origin.
- `CORS_ORIGIN` restricts the allowed origin (no wildcard in production).

---

## 3. Transport Security — TLS in Transit

**Implementation:** `backend/src/main.ts`

### App-level HTTPS (`TLS_MODE=direct`)

NestJS creates the HTTPS server itself using the certificate files at `TLS_KEY_PATH` / `TLS_CERT_PATH`.

- Default dev cert path: `backend/certs/server.key` + `backend/certs/server.crt`
- Default HTTPS port: `3443`
- A companion plain-HTTP server on `HTTP_REDIRECT_PORT` (default `3080`) issues **HTTP 301** redirects to the HTTPS URL. This ensures no client accidentally uses the unencrypted endpoint.

### Behind a TLS-terminating ingress (`TLS_MODE=proxy`)

When a cloud load balancer, Caddy, or nginx terminates TLS upstream, NestJS runs plain HTTP on `PORT` but:
- Sets **`trust proxy 1`** on the Express instance so `req.protocol` returns `'https'` from the `X-Forwarded-Proto` header.
- The ingress is responsible for HTTP→HTTPS redirection before requests reach the app.

### HSTS (HTTP Strict Transport Security)

Enabled via **Helmet** when `TLS_MODE` is `direct` or `proxy`:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

Not emitted when `TLS_MODE` is unset (local HTTP dev), which prevents browsers from permanently upgrading `localhost` to HTTPS.

### Security headers

**Helmet** is applied globally in `main.ts`. It sets:

| Header | Effect |
|---|---|
| `Content-Security-Policy` | Restricts resource origins |
| `X-Content-Type-Options: nosniff` | Prevents MIME sniffing |
| `X-Frame-Options: SAMEORIGIN` | Blocks clickjacking |
| `Referrer-Policy` | Limits referrer leakage |
| `Permissions-Policy` | Disables unused browser APIs |
| `X-DNS-Prefetch-Control: off` | Prevents DNS prefetch leakage |
| `HSTS` | See above (conditional) |

### Database TLS (`sslmode=require`)

In production, append `?sslmode=require` to `DATABASE_URL`:

```
DATABASE_URL=postgresql://user:pass@db.prod:5432/appraisal?schema=public&sslmode=require
```

This instructs the Prisma/pg driver to require a TLS handshake with the database server and reject plain-text connections. Managed PostgreSQL services (AWS RDS, Supabase, Neon, Railway) enforce TLS server-side; `sslmode=require` ensures the client validates it.

---

## 4. Encryption at Rest — AES-256-GCM

**Implementation:** `backend/src/crypto/crypto.service.ts`

`CryptoService` provides **symmetric authenticated encryption** using the Node.js built-in `crypto` module — no external dependencies.

### Algorithm: AES-256-GCM

| Property | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key size | 256 bits (32 bytes) from `ENCRYPTION_KEY` env var |
| IV | 12 bytes, randomly generated per encryption |
| Auth tag | 16 bytes (GCM default) |
| Output format | `base64(iv):base64(authTag):base64(ciphertext)` |

**Why GCM (authenticated encryption)?** GCM provides both confidentiality and integrity. The authentication tag detects any modification to the ciphertext, IV, or associated data after encryption — a tampered field cannot be silently decrypted. A mode like CBC or CTR without an HMAC would not detect tampering.

**Why random IV per call?** Reusing an IV with the same key under GCM is catastrophic (it breaks confidentiality). Generating `crypto.randomBytes(12)` per call guarantees IV uniqueness and means two encryptions of the same plaintext produce different ciphertexts (no leakage of equality).

**Key material:** `ENCRYPTION_KEY` must be a 64-character hexadecimal string (32 raw bytes). The constructor validates length and throws on startup if misconfigured — fail fast before any data is processed.

### Usage

`CryptoService` is a `@Global()` NestJS module. Any module can inject it to encrypt a column before writing to the database and decrypt after reading:

```typescript
constructor(private readonly crypto: CryptoService) {}

// Before insert:
const encrypted = this.crypto.encrypt(sensitiveValue);

// After read:
const plaintext = this.crypto.decrypt(row.encryptedColumn);
```

### Column-level encryption (coordination note)

The `listings` table has a `contact` column that should be encrypted at rest. `CryptoService` is already available globally. The owner of `ListingsService` should apply `encrypt()` on write and `decrypt()` on read for that column — no schema migration is needed since the column type remains `TEXT`.

### Disk-level encryption (managed Postgres)

All major managed PostgreSQL providers (RDS, Supabase, Neon, Railway, Cloud SQL) encrypt data files at rest using AES-256 transparently. Column-level encryption adds a second layer: even if the disk encryption is compromised at the provider level, individual field values remain unreadable without the application's `ENCRYPTION_KEY`.

---

## 5. Rate Limiting

**Implementation:** `backend/src/app.module.ts`, `auth.controller.ts`

`@nestjs/throttler` is applied globally:

| Scope | Limit | Window |
|---|---|---|
| Global default | 200 requests | 60 s per IP |
| `POST /auth/login` | 5 requests | 60 s per IP |

The per-route `@Throttle` override on login is the primary brute-force defence for the authentication endpoint.

---

## 6. Audit Log

**Implementation:** `backend/src/audit/audit.service.ts`, `audit_log` table

Every significant auth event is written to `auth_audit_log` with IP, User-Agent, and structured metadata. The table is append-only (no updates, no deletes by the application). `userId` is nullable with `ON DELETE SET NULL` so audit rows survive account deletion.

Events logged: `register`, `login_success`, `login_failure`, `logout`, `token_rotated`, `refresh_reuse_detected`, `email_verified`, `role_changed`.

---

## Generating a Self-Signed Certificate for Development

See `backend/README.md § TLS / HTTPS in Development`.
