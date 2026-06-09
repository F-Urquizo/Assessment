# Auth API Contract

> Status: **DRAFT — pending cookie topology decision (Cookie attributes)**
> Scope: `/auth/*` endpoints only. The existing `/analyze`, `/predict`,
> `/compare`, `/options` proxy routes are unchanged.

---

## Shared shapes

### `UserDto`

The canonical user object returned by every auth endpoint.
**`passwordHash` is never included.** Fields map 1-to-1 to the Prisma `User`
model — no synthetic fields (no `name`, no `displayName`).

```
{
  id:            string   // cuid, e.g. "clxyz..."
  email:         string   // always lowercase
  role:          "user" | "admin"
  emailVerified: boolean
}
```

### Error envelope

NestJS default shape. Clients must key on `statusCode`, not `error`.

```
{
  statusCode: number
  message:    string | string[]   // string[] when class-validator fires
  error:      string              // HTTP reason phrase, e.g. "Conflict"
}
```

### Validation rules (backend enforces, frontend mirrors)

| Field | Rule |
|---|---|
| `email` | Valid RFC-5322 email; normalized to **lowercase** before any DB operation |
| `password` | Minimum **8 characters** |

Both rules are enforced server-side via class-validator. The frontend should
validate with the same rules to avoid a round-trip on obvious errors, but
server-side is the source of truth.

---

## Endpoints

### `POST /auth/register`

Creates a new account. Sends a verification email (fire-and-forget; register
still succeeds if SMTP fails — the user can request a resend later).

**Request body**
```json
{ "email": "User@Example.com", "password": "hunter42!" }
```
`email` is normalized to lowercase before uniqueness check and storage.

**Response `201 Created`**
```json
{
  "user": {
    "id": "clxyz...",
    "email": "user@example.com",
    "role": "user",
    "emailVerified": false
  }
}
```
No tokens are issued at registration time. The user must log in separately.

**Errors**

| Status | `message` | Condition |
|---|---|---|
| `409 Conflict` | `"email already registered"` | `email` exists (case-insensitive) |
| `422 Unprocessable Entity` | `string[]` from class-validator | Malformed email or password < 8 chars |

---

### `POST /auth/login`

Authenticates an existing account. Issues a short-lived access token in the
response body and a long-lived refresh token in an httpOnly cookie.

**Request body**
```json
{ "email": "user@example.com", "password": "hunter42!" }
```

**Response `200 OK`**
```json
{
  "accessToken": "<signed JWT>",
  "user": {
    "id": "clxyz...",
    "email": "user@example.com",
    "role": "user",
    "emailVerified": true
  }
}
```

**Set-Cookie header** (see § Cookie attributes for SameSite details)
```
Set-Cookie: refresh=<token>; HttpOnly; Path=/auth/refresh; Max-Age=604800
```
`Path=/auth/refresh` scopes the cookie so it is only sent by the browser on
refresh calls, not on every request.

**Token lifetimes**

| Token | Storage | TTL |
|---|---|---|
| Access token (`accessToken`) | Frontend memory only | 15 minutes |
| Refresh token (cookie) | httpOnly cookie | 7 days |

**Errors**

| Status | `message` | Condition |
|---|---|---|
| `401 Unauthorized` | `"invalid credentials"` | Unknown email or wrong password (deliberately vague) |
| `403 Forbidden` | `"email not verified"` | Account exists but `emailVerified = false` |
| `422 Unprocessable Entity` | `string[]` | Malformed input |

---

### `POST /auth/refresh`

Exchanges a valid refresh-token cookie for a new access token. Implements
**token rotation**: the old refresh token is revoked and a new one is issued.
If a revoked token is replayed (reuse-attack), the entire token family is
invalidated and the user is logged out.

**Request body** — none. Token is read from the `refresh` cookie.

**Response `200 OK`**
```json
{ "accessToken": "<new signed JWT>" }
```

**Set-Cookie header** — same attributes as login, new token value.

**Errors**

| Status | `message` | Condition |
|---|---|---|
| `401 Unauthorized` | `"invalid refresh token"` | Cookie absent, token not in DB, expired, or whole family revoked after reuse-attack |

No `403` here — if the token is valid but the email is unverified, access tokens
are simply not issued with protected-route scopes. The refresh endpoint itself
does not gate on `emailVerified`.

---

### `POST /auth/logout`

Revokes the current refresh token and clears the cookie. Idempotent — returns
`204` even if no cookie was present.

**Request body** — none.

**Response `204 No Content`** — empty body.

**Set-Cookie header** (cookie deletion)
```
Set-Cookie: refresh=; HttpOnly; Path=/auth/refresh; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

**Errors** — none beyond `5xx`. A missing or invalid cookie is silently ignored.

---

### `GET /auth/verify-email?token=<raw-token>`

Validates a single-use email verification link. Sets `emailVerified = true` on
the `User` row and marks the token as used.

**Query param**

| Param | Type | Description |
|---|---|---|
| `token` | `string` | Raw (unhashed) token from the email link |

**Response `200 OK`**
```json
{ "message": "email verified" }
```
Alternatively the backend may redirect to a frontend route (e.g.
`/verified?success=true`). The exact behavior is a pending implementation
decision; the contract guarantees at least a `200` before any redirect.

**Errors**

| Status | `message` | Condition |
|---|---|---|
| `400 Bad Request` | `"invalid token"` | Token not found in DB after hashing |
| `410 Gone` | `"token expired"` | Token found but `expiresAt` has passed |
| `410 Gone` | `"token already used"` | Token found but `usedAt` is set |

`410 Gone` is preferred over `400` for the expired/used cases so the client can
display a specific "request a new link" prompt rather than a generic error.

---

## Cookie attributes

⚠️ **Pending decision** — confirm deploy topology before finalising.

The `SameSite` value depends on whether the frontend and backend share the same
registrable domain (e.g. both under `example.com`).

### Case A — Same registrable domain (recommended)

Example: frontend at `app.example.com`, backend at `api.example.com`.

```
Set-Cookie: refresh=<token>;
  HttpOnly;
  Secure;
  SameSite=Lax;
  Path=/auth/refresh;
  Domain=.example.com;
  Max-Age=604800
```

- `SameSite=Lax` allows the cookie on top-level navigations and same-site
  requests. No extra CORS configuration required for the cookie.
- `Domain=.example.com` makes the cookie available to all subdomains.

### Case B — Different domains (e.g. Vercel frontend + Render backend)

```
Set-Cookie: refresh=<token>;
  HttpOnly;
  Secure;
  SameSite=None;
  Path=/auth/refresh;
  Max-Age=604800
```

**Required backend changes:**
- `CORS_ORIGIN` must be the exact frontend origin (no `*`).
- CORS must be configured with `credentials: true`.

**Required frontend change:**
- Every `fetch` call to auth endpoints must include `credentials: 'include'`.

`SameSite=None` requires `Secure` (HTTPS-only). The cookie will not work in
plain HTTP development unless the browser has `chrome://flags` exceptions
enabled.

---

## Access token: memory-only storage

The frontend receives `accessToken` in the JSON response body. It **must not**
be written to `localStorage` or `sessionStorage` — both are accessible to any
JS on the page (XSS vector). The token lives in a React context or module-level
variable and is lost on page refresh, which is expected: `/auth/refresh` silently
renews it on startup if the cookie is still valid.

---

## Frontend integration

These are **extensions** to the existing [frontend/src/lib/api.ts](../frontend/src/lib/api.ts),
not a replacement. The current `request<T>()` and `postJson<T>()` helpers are
reused. See [frontend/src/lib/auth-types.ts](../frontend/src/lib/auth-types.ts)
for the TypeScript shapes.

```ts
// Additions to frontend/src/lib/api.ts (not yet implemented)

export function register(email: string, password: string): Promise<RegisterResponse> {
  return postJson<RegisterResponse>('/auth/register', { email, password });
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return postJson<LoginResponse>('/auth/login', { email, password });
  // credentials: 'include' required if Case B cookie topology
}

export function refreshAccessToken(): Promise<RefreshResponse> {
  return postJson<RefreshResponse>('/auth/refresh', {});
  // credentials: 'include' required if Case B cookie topology
}

export function logout(): Promise<void> {
  return postJson<void>('/auth/logout', {});
}

export function verifyEmail(token: string): Promise<VerifyEmailResponse> {
  return request<VerifyEmailResponse>(`/auth/verify-email?token=${encodeURIComponent(token)}`);
}
```

The `credentials: 'include'` option on refresh/logout must be added to the
underlying `fetch` call if the cookie topology is Case B. This is a one-line
change in `request<T>()` (or a separate `credentialRequest<T>()` wrapper if
only auth routes need it).

---

## What is NOT in this contract

- Password reset / forgot-password flow (future step)
- OAuth / social login (future step)
- Admin-only endpoints
- Rate limiting / lockout behaviour (implementation detail, not a contract)
