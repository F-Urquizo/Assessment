# Vehicle Appraisal — NestJS Backend

REST API for the vehicle appraisal platform. Handles authentication, session management, and proxies prediction requests to the Python model service.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in secrets
cp ../.env.example .env

# 3. Generate a self-signed TLS cert for local HTTPS (see § TLS below)
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout certs/server.key -out certs/server.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# 4. Apply Prisma migrations (requires Postgres running)
npx prisma migrate dev

# 5. Start in watch mode
npm run start:dev
```

The server starts at **https://localhost:3443** (TLS_MODE=direct, default).  
A plain HTTP server on :3080 issues 301 → https://localhost:3443.

---

## TLS / HTTPS in Development

The backend supports three modes, controlled by `TLS_MODE` in `.env`:

| `TLS_MODE` | What runs | HSTS emitted? | Use when |
|---|---|---|---|
| `direct` | NestJS creates HTTPS server | Yes | Local dev, small VPS as the edge |
| `proxy` | NestJS runs plain HTTP | Yes | Behind nginx / Caddy / cloud LB |
| *(unset)* | Plain HTTP, no HSTS | No | CI, unit tests, legacy |

### Generating the self-signed certificate

```bash
mkdir -p backend/certs
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout backend/certs/server.key -out backend/certs/server.crt \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

**The `certs/` directory is in `.gitignore` — never commit key material.**

When Chrome shows the "Your connection is not private" warning for a self-signed cert, click **Advanced → Proceed to localhost**. Alternatively, use [mkcert](https://github.com/FiloSottile/mkcert) to generate a locally-trusted cert:

```bash
brew install mkcert
mkcert -install
mkcert -key-file backend/certs/server.key -cert-file backend/certs/server.crt localhost 127.0.0.1
```

### Generating the encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output into `ENCRYPTION_KEY` in `.env`. It must be exactly 64 hex characters.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma connection string. Add `?sslmode=require` in production. |
| `JWT_ACCESS_SECRET` | Yes | ≥32-char secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | ≥32-char secret for refresh token HMAC |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token TTL (default `15m`) |
| `COOKIE_SAME_SITE` | No | `lax` / `none` (default `lax`) |
| `COOKIE_SECURE` | No | `true` / `false` (default `false`) |
| `TLS_MODE` | No | `direct` / `proxy` / unset |
| `TLS_KEY_PATH` | When direct | Path to TLS private key (default `certs/server.key`) |
| `TLS_CERT_PATH` | When direct | Path to TLS certificate (default `certs/server.crt`) |
| `PORT` | No | HTTPS/HTTP port (default `3443` direct, `3000` proxy/off) |
| `HTTP_REDIRECT_PORT` | No | HTTP→HTTPS redirect port (default `3080`, direct only) |
| `ENCRYPTION_KEY` | Yes | 64-char hex AES-256 key |
| `CORS_ORIGIN` | No | Allowed CORS origin (default `true` = any) |
| `FRONTEND_URL` | Yes | Base URL for email verification links |
| `MODEL_SERVICE_URL` | Yes | Flask model service URL |
| `SMTP_HOST` | No | SMTP hostname; if unset, links are logged to console |
| `SMTP_PORT` | No | SMTP port (default `587`) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address for outgoing email |

---

## Running Tests

```bash
npm run test          # unit tests
npm run test:cov      # coverage report
npm run test:e2e      # end-to-end (requires running Postgres)
```

---

## Database

Migrations are managed by Prisma. To apply all pending migrations:

```bash
npx prisma migrate deploy    # production (no shadow DB)
npx prisma migrate dev       # development (creates shadow DB, runs seed)
```

See `docs/db-design.md` for the full schema and design rationale.
