# Listings, Favorites, Recommendations & Model Service API Contract

> Scope: `/listings/*`, `/favorites/*`, `/recommendations`, and the model
> service endpoints (`/predict`, `/analyze`, `/compare`, `/options`).
> Auth contract (`/auth/*`): [`API_CONTRACT.md`](./API_CONTRACT.md).
> All endpoints follow the same NestJS error envelope as the auth contract.

---

## Shared shapes

### `ListingView`

Returned by every endpoint that emits a listing. `passwordHash` is never
included. `dealBadge` and `dealDeltaPct` are server-computed and never
accepted from the client.

```
{
  id:             string        // cuid
  manufacturer:   string
  model:          string
  year:           number        // 1990–2021
  odometer:       number        // miles
  cylinders:      number | null
  condition:      string        // see Enum values below
  fuel:           string
  titleStatus:    string
  transmission:   string
  drive:          string
  type:           string        // body style
  paintColor:     string
  state:          string        // lowercase US state code, e.g. "ca"
  askingPrice:    number        // integer, dollars
  description:    string | null
  contactEmail:   string
  contactPhone:   string | null
  status:         "draft" | "active" | "sold"
  predictedValue: number | null // model-service estimate, null if unavailable
  predictedLow:   number | null // 10th-percentile bound
  predictedHigh:  number | null // 90th-percentile bound
  dealDeltaPct:   number | null // (askingPrice − predictedValue) / predictedValue × 100
  dealBadge:      "under" | "fair" | "over" | null
  userId:         string        // owner's cuid
  createdAt:      string        // ISO 8601
  updatedAt:      string
}
```

**Deal badge thresholds** (backend `src/listings/deal.ts`):

| `dealDeltaPct` | `dealBadge` |
|---|---|
| `≤ −10%` | `"under"` |
| `> −10%` and `< +10%` | `"fair"` |
| `≥ +10%` | `"over"` |
| `null` (no valuation) | `null` |

### `ListingDetailView`

`ListingView` plus its price/valuation trail:

```
{
  ...ListingView,
  priceHistory: PriceHistoryRow[]   // oldest → newest
}
```

### `PriceHistoryRow`

```
{
  id:                string
  listingId:         string
  oldAskingPrice:    number | null   // null on the initial "created" row
  newAskingPrice:    number
  oldPredictedValue: number | null
  newPredictedValue: number | null
  oldPredictedLow:   number | null
  newPredictedLow:   number | null
  oldPredictedHigh:  number | null
  newPredictedHigh:  number | null
  reason:            "created" | "asking_price_change" | "revaluation"
  changedAt:         string          // ISO 8601
}
```

### `BrowseResult`

```
{
  items:    ListingView[]
  total:    number   // total matching rows (for pagination)
  page:     number
  pageSize: number
}
```

### Enum values

| Field | Allowed values |
|---|---|
| `condition` | `excellent` `fair` `good` `like new` `new` `salvage` `unknown` |
| `fuel` | `diesel` `electric` `gas` `hybrid` `other` |
| `titleStatus` | `clean` `lien` `missing` `parts only` `rebuilt` `salvage` |
| `transmission` | `automatic` `manual` `other` |
| `drive` | `4wd` `fwd` `rwd` `unknown` |
| `type` | `SUV` `bus` `convertible` `coupe` `hatchback` `mini-van` `offroad` `other` `pickup` `sedan` `truck` `unknown` `van` `wagon` |
| `paintColor` | `black` `blue` `brown` `custom` `green` `grey` `orange` `purple` `red` `silver` `unknown` `white` `yellow` |
| `state` | 51 lowercase US state codes (`ak` … `wy`, including `dc`) |
| `cylinders` | `3` `4` `5` `6` `8` `10` `12` |
| `year` | `1990` – `2021` |

---

## Listings endpoints

### `POST /listings`

Creates a new listing. Immediately calls the model service to compute
`predictedValue / Low / High` and `dealDeltaPct`, then writes both the
listing and a `created` price-history row in one transaction.

**Auth:** Bearer token required. `status: active` additionally requires
`emailVerified = true`.

**Request body** (`CreateListingDto`)

```json
{
  "manufacturer": "ford",
  "model": "f-150",
  "year": 2015,
  "odometer": 60000,
  "cylinders": 8,
  "condition": "good",
  "fuel": "gas",
  "titleStatus": "clean",
  "transmission": "automatic",
  "drive": "4wd",
  "type": "pickup",
  "paintColor": "white",
  "state": "ca",
  "askingPrice": 18500,
  "description": "One owner, garage kept.",
  "contactEmail": "seller@example.com",
  "contactPhone": "555-0100",
  "status": "draft"
}
```

- `cylinders`, `description`, `contactPhone` are optional.
- `status` is optional; defaults to `draft`. Only `draft` or `active` are
  accepted at creation — a listing cannot be created as `sold`.
- Derived fields (`predictedValue`, `dealDeltaPct`, `dealBadge`, `userId`)
  are **stripped by the `ValidationPipe`** if supplied; the service sets them.
- If the model service is unreachable, the listing is still saved with
  `predictedValue = null` and `dealBadge = null`.

**Response `201 Created`** — `ListingView`

**Errors**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Missing or invalid Bearer token |
| `403 Forbidden` | `status: active` with `emailVerified = false` |
| `422 Unprocessable Entity` | Validation failure (unknown enum, out-of-range year, etc.) |

---

### `GET /listings`

Paginated, filtered, sorted browse of **active** listings only.

**Auth:** Public. If a valid Bearer token is present, the applied filters are
recorded to `SearchHistory` (used by the recommendations engine).

**Query parameters** (`BrowseListingsDto`) — all optional

| Param | Type | Default | Description |
|---|---|---|---|
| `q` | string (≤ 80 chars) | — | Keyword: case-insensitive substring match on `manufacturer` OR `model` |
| `make` | string | — | Exact match on `manufacturer` |
| `type` | enum (see above) | — | Body style filter |
| `state` | string (state code) | — | State filter |
| `minPrice` | integer ≥ 0 | — | Lower bound on `askingPrice` |
| `maxPrice` | integer ≥ 0 | — | Upper bound on `askingPrice` |
| `minYear` | integer 1900–2100 | — | Lower bound on `year` |
| `maxYear` | integer 1900–2100 | — | Upper bound on `year` |
| `minMiles` | integer ≥ 0 | — | Lower bound on `odometer` |
| `maxMiles` | integer ≥ 0 | — | Upper bound on `odometer` |
| `sort` | `newest` `priceAsc` `priceDesc` `bestDeal` | `newest` | Sort order |
| `page` | integer ≥ 1 | `1` | Page number |
| `pageSize` | integer 1–100 | `20` | Results per page |

`bestDeal` sort surfaces the most underpriced listings first (lowest
`dealDeltaPct`); listings with no valuation (`null`) appear last.

**Response `200 OK`** — `BrowseResult`

```json
{
  "items": [ ...ListingView ],
  "total": 84,
  "page": 1,
  "pageSize": 20
}
```

**Errors**

| Status | Condition |
|---|---|
| `422 Unprocessable Entity` | Invalid sort value, `pageSize` > 100, unknown `type`, negative price, etc. |

---

### `GET /listings/mine`

Returns all listings owned by the authenticated user, any status (including
`draft` and `sold`), newest first.

**Auth:** Bearer token required.

**Response `200 OK`** — `ListingView[]`

**Errors**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Missing or invalid Bearer token |

---

### `GET /listings/:id`

Returns a single listing with its full price/valuation history. Works for any
status — the buyer-facing listing detail page uses this for `active` listings,
but the seller's "My Listings" edit view also uses it for `draft`/`sold`.

**Auth:** Public.

**Response `200 OK`** — `ListingDetailView`

**Errors**

| Status | Condition |
|---|---|
| `404 Not Found` | No listing with that `id` |

---

### `PATCH /listings/:id`

Partial update of a listing. Only the fields supplied in the body are changed.

- If any of the 13 **spec fields** changed, the model service is re-called and
  `predictedValue / Low / High` and `dealDeltaPct` are recomputed.
- If only `askingPrice` changed (no spec change), the stored valuation is
  reused and only `dealDeltaPct` is recomputed.
- A `ListingPriceHistory` row is written **only if** `askingPrice` or any
  valuation field actually changed (reason: `asking_price_change` or
  `revaluation`).

**Auth:** Bearer token required. Only the listing's owner or an `admin` may
update. `status: active` requires `emailVerified = true`.

**Request body** (`UpdateListingDto`) — all fields optional, same enum
constraints as `CreateListingDto`; `status` additionally accepts `sold`.

**Response `200 OK`** — `ListingView`

**Errors**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Missing or invalid Bearer token |
| `403 Forbidden` | Not the owner (and not admin), or `status: active` with unverified email |
| `404 Not Found` | No listing with that `id` |
| `422 Unprocessable Entity` | Validation failure |

---

### `DELETE /listings/:id`

Permanently deletes a listing. Cascades to `ListingPriceHistory` and
`Favorite` rows via DB foreign keys.

**Auth:** Bearer token required. Owner or admin only.

**Response `204 No Content`** — empty body.

**Errors**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Missing or invalid Bearer token |
| `403 Forbidden` | Not the owner (and not admin) |
| `404 Not Found` | No listing with that `id` |

---

## Favorites endpoints

All three endpoints require a valid Bearer token — favorites are per-user and
protected.

### `POST /favorites/:listingId`

Saves a listing to the authenticated user's favorites.

**Response `201 Created`** — empty body.

**Errors**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Missing or invalid Bearer token |
| `404 Not Found` | No listing with that `listingId` |
| `409 Conflict` | Already favorited by this user |

---

### `DELETE /favorites/:listingId`

Removes a listing from favorites. **Idempotent** — returns `204` even if the
favorite did not exist (uses `deleteMany`, not `delete`).

**Response `204 No Content`** — empty body.

**Errors**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Missing or invalid Bearer token |

---

### `GET /favorites`

Returns the authenticated user's saved listings, newest-favorited first.
Each item is a full `ListingView` (including the current `dealBadge`).

**Response `200 OK`** — `ListingView[]`

**Errors**

| Status | Condition |
|---|---|
| `401 Unauthorized` | Missing or invalid Bearer token |

---

## Recommendations endpoint

### `GET /recommendations`

Returns a ranked list of active listings tailored to the requesting user.

**Auth:** Public. When called with a valid Bearer token, the user's last 90
days of favorites and search history are used to build a preference profile.
Without a token (or with a new account with no history), the ranking falls
back to deal score only.

**Query parameters**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `limit` | integer | `10` | 1–50 |

**Response `200 OK`** — `RecommendationItem[]`

`RecommendationItem` extends `ListingView` with two additional fields:

```
{
  ...ListingView,
  score: number   // combined score [0,1]; higher is better
  why:   string   // human-readable explanation, e.g.
                  // "Matches your preferred manufacturer (Toyota) · 18% below market price"
}
```

**Scoring algorithm:**

- `dealScore = max(0, min(1, (-dealDeltaPct + 30) / 60))`
  — maps −30% → 1.0, 0% → 0.5, +30% → 0.0
- `prefScore` — frequency of `manufacturer`, `type`, `fuel`, `drive` in the
  last 90 days of the user's favorites and search history, normalized and
  averaged across the four dimensions.
- `combined = 0.5 × dealScore + 0.5 × prefScore`
- Cold start (no history): `combined = dealScore`

Own listings are excluded from the candidate pool.

---

## Model service endpoints

The model service runs on port **5050** and is only ever called by the NestJS
backend. These shapes are documented here for completeness; the frontend never
calls them directly.

### `GET /options`

Returns the valid option sets for every spec dropdown. The backend fetches
this at boot; the frontend fetches it via `GET /options` (proxied by Vite in
dev, or passed through the NestJS proxy in prod).

**Response `200 OK`**

```json
{
  "conditions":    ["excellent", "fair", "good", "like new", "new", "salvage", "unknown"],
  "fuels":         ["diesel", "electric", "gas", "hybrid", "other"],
  "title_statuses":["clean", "lien", "missing", "parts only", "rebuilt", "salvage"],
  "transmissions": ["automatic", "manual", "other"],
  "drives":        ["4wd", "fwd", "rwd", "unknown"],
  "types":         ["SUV", "bus", "convertible", ...],
  "paint_colors":  ["black", "blue", ...],
  "cylinders":     [3, 4, 5, 6, 8, 10, 12]
}
```

---

### `POST /predict`

Point estimate + 10th/90th-percentile interval for one vehicle.

**Request body** — 13 spec fields in **snake_case**

```json
{
  "manufacturer": "ford",
  "model": "f-150",
  "year": 2015,
  "odometer": 60000,
  "cylinders": 8,
  "condition": "good",
  "fuel": "gas",
  "title_status": "clean",
  "transmission": "automatic",
  "drive": "4wd",
  "type": "pickup",
  "paint_color": "white",
  "state": "ca"
}
```

`cylinders` is optional — the model defaults to the training-set median.
Unknown `manufacturer`/`model` values are mapped to `"other"` (not rejected).

**Response `200 OK`**

```json
{
  "price":       14200,
  "low":         11800,
  "high":        17100,
  "model_group": "f-150",
  "known_model": true
}
```

`low`/`high` are the 10th/90th percentiles across all trees in the forest.
`known_model: false` means the model group was not seen in training; the
estimate is still returned but may be less precise.

**Errors**

| Status | Condition |
|---|---|
| `400 Bad Request` | Missing required field or invalid value (`"error": "invalid input: ..."`) |

---

### `POST /analyze`

Full appraisal for one vehicle. Used by the Valuation Studio.

**Request body** — same 13 spec fields as `/predict`, plus optional
`annual_miles` (integer, default `12000`).

**Response `200 OK`**

```json
{
  "appraisal": {
    "estimate":    14200,
    "low":         11800,
    "high":        17100,
    "spread_pct":  37.3,
    "model_group": "f-150",
    "known_model": true
  },
  "drivers": [
    {
      "key": "condition", "label": "Condition", "desc": "...",
      "current": "good", "swing": 3200,
      "upside": 1800, "downside": -1400,
      "best":  { "value": "like new", "price": 16000, "delta": 1800, "is_current": false },
      "worst": { "value": "salvage",  "price": 12800, "delta": -1400, "is_current": false },
      "options": [ ... ]
    }
  ],
  "recommendations": [
    { "kind": "condition", "label": "Recondition to \"like new\"", "detail": "...", "delta": 1800 }
  ],
  "forecast": {
    "annual_miles": 12000, "years": 5,
    "total_loss": 4200, "retained_pct": 70.4, "avg_annual_loss": 840, "value_in_3yr": 11900,
    "points": [
      { "year_offset": 0, "age": 6, "odometer": 60000, "value": 14200 },
      ...
    ]
  },
  "mileage_curve": [
    { "odometer": 20000, "value": 17800 },
    ...
  ],
  "market": {
    "scope": "segment",
    "segment_label": "ford pickup",
    "comparable_count": 4820,
    "segment_median": 13400,
    "segment_low": 8200,
    "segment_high": 22100,
    "percentile": 54,
    "vs_median": 800,
    "depreciation": { ... },
    "popular_models": ["f-150", "f-250", "ranger", "maverick"]
  },
  "vehicle": { "manufacturer": "ford", "model": "f-150", ... }
}
```

**`drivers`** — up to 9 factors (condition, title_status, odometer, cylinders,
drive, fuel, transmission, paint_color, type), sorted by `swing`
(highest price range first).

**`recommendations`** — up to 3 actionable suggestions: condition upgrade,
clean title, lower mileage. Only included when the projected delta > $50.

**`forecast`** — 5-year depreciation at `annual_miles` per year, 6 data
points (year 0 through year 5).

**`mileage_curve`** — 13 data points spanning ±60k–120k miles around the
current odometer.

---

### `POST /compare`

Slim analysis for up to **4 vehicles** simultaneously. Used by the Studio's
head-to-head compare view.

**Request body**

```json
{
  "vehicles": [
    { "manufacturer": "ford", "model": "f-150", ..., "_label": "My F-150" },
    { "manufacturer": "toyota", "model": "tacoma", ... }
  ]
}
```

`_label` is optional; if omitted, the service builds a label from
`year manufacturer model`.

**Response `200 OK`**

```json
{
  "results": [
    {
      "label":           "My F-150",
      "estimate":        14200,
      "low":             11800,
      "high":            17100,
      "known_model":     true,
      "retained_3yr_pct": 83.7,
      "value_in_3yr":    11880,
      "avg_annual_loss": 780,
      "percentile":      54,
      "segment_median":  13400,
      "vs_median":       800,
      "top_driver":      { "label": "Condition", "swing": 3200 },
      "top_rec":         { "kind": "condition", "label": "Recondition...", "delta": 1800 },
      "award_cheapest":  true,
      "award_holds_value": false
    },
    ...
  ]
}
```

`award_cheapest` — true for the vehicle with the lowest estimate.
`award_holds_value` — true for the vehicle with the highest `retained_3yr_pct`.

**Errors**

| Status | Condition |
|---|---|
| `400 Bad Request` | `vehicles` array is empty or contains invalid input |

---

## What is NOT in this contract

- Admin-only endpoints (`/admin/*`) — role-gated, not part of the public API surface.
- `GET /api/intel` (model service) — internal market intelligence data used
  by `/analyze`; not consumed directly by any frontend component.
- `GET /health` (model service) — liveness probe only.
- Pagination on `/favorites` and `/recommendations` — not currently implemented;
  `/favorites` returns all results, `/recommendations` is capped at 50 via `limit`.
