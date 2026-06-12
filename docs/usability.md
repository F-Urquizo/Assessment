# Usability & Accessibility

> How **Bluebook** is designed to be used: the primary user journeys, the
> interaction patterns that make valuation legible, and the accessibility
> controls that satisfy rubric #6. Scope is the React frontend
> (`frontend/src`); the API contracts behind it live in
> [`architecture.md`](./architecture.md) and [`API_CONTRACT.md`](./API_CONTRACT.md).

---

## 1. Who uses it, and to do what

Bluebook serves two overlapping intents around the same model-driven valuation:

| Persona | Goal | Primary surface |
|---|---|---|
| **Buyer** | Find a used car and know instantly whether the price is fair | Marketplace, Listing detail, Recommendations |
| **Seller** | Price and publish their own car with model backing | Studio (appraise) → Sell / My Listings |
| **Returning user** | Pick up where they left off without re-logging-in | Silent session restore, Favorites |

The product's core promise is **legibility**: every price is shown next to what
the model thinks the car is worth, so the user never has to guess whether a deal
is good.

---

## 2. Primary user journeys

### 2.1 Browse and judge a deal (buyer)

1. Land on the **Marketplace** (`/`) — a grid of `ListingCard`s plus a filter bar
   and a "Recommended for you" rail.
2. Each card shows the asking price **side by side** with the model value and a
   **deal badge** — *Under / Fair / Over* with the percentage delta vs. model
   value.
3. Narrow with filters (maker, body type, state, price band) and sorting; results
   paginate.
4. Open a card → **Listing detail** (`/listings/:id`): a visual over/under-valued
   analysis (asking vs. model band), the deal verdict, **price history**, seller
   contact, and a **favourite** button.

### 2.2 Appraise and sell (seller)

1. Open **Studio** (`/studio`) → the **appraisal wizard**: one question per card,
   step by step, instead of a wall of inputs.
2. The model returns an estimate, a value range, a depreciation forecast and the
   value drivers. Save the car to the **garage**; compare cars head-to-head.
3. Bridge into a listing with **"List this car →"**, which carries the appraisal
   into a pre-filled **Sell** form.
4. Manage everything under **My Listings**: create, edit, delete, and toggle
   status (draft / active / sold). Publishing as *active* requires a verified
   email.

### 2.3 Account & session

Register → verify email → login. The access token is held **in memory only**;
on the next visit the app performs a **silent refresh** to restore the session
with no visible re-login. Protected areas (e.g. `/favorites`) redirect to
`/login` when there's no session, and the nav reflects auth state (account email
+ sign-out, or login/register links).

---

## 3. Interaction patterns that make valuation legible

### 3.1 The deal badge — never colour alone

The deal badge is the product's signature signal, and it is deliberately built so
it does **not** rely on colour to carry meaning
(`frontend/src/components/views/ListingCard.tsx`):

- A **text label** (`Under` / `Fair` / `Over`),
- a **symbol** (`badge-sym`), and
- a **colour** — three redundant channels, so the meaning survives colour
  blindness or a greyscale print.

The badge also exposes a full-sentence `aria-label` (e.g. *"Underpriced, -12
percent versus model value"*) so screen-reader users get the same verdict as
sighted users, while the decorative symbol is `aria-hidden`.

### 3.2 Buyer/seller verdict framing

The same valuation is narrated differently depending on intent
(`frontend/src/lib/deal.ts`). A price below the model's floor reads as a *"Great
deal"* to a buyer but a *"Quick-sale price — leaves money on the table"* to a
seller. Each verdict comes with an actionable **price guide** (open offer / fair
value / walk-away, or list-at / expect-to-net / quick-sale floor), turning a raw
number into a decision.

### 3.3 Honest empty/partial states

When a listing has no valuation yet, the card says **"Not valued yet"** rather
than rendering a misleading zero. The whole app **degrades gracefully**: if the
backend's `/options` is unreachable, the UI falls back to mock options so the
marketplace stays usable rather than showing a broken screen.

---

## 4. Accessibility (rubric #6)

Accessibility is treated as a baseline, not a retrofit. What's implemented on the
frontend:

### 4.1 Semantic structure & landmarks

- A **"Skip to main content"** link is the first focusable element, jumping past
  the nav straight to `<main id="main-content">` (`frontend/src/App.tsx`).
- Navigation is a real `<nav aria-label="App section">` with `NavLink`s that mark
  the active section (`ModeNav.tsx`); listings are `<article>`s with headings.

### 4.2 Keyboard operability

- Every interactive control is reachable and operable by keyboard. Clickable
  listing cards expose `role="button"`, `tabIndex={0}`, and handle **Enter /
  Space** to open detail — not just mouse clicks
  (`ListingCard.tsx`).
- Focus is visible, and focus order follows reading order.

### 4.3 Screen-reader support

- Meaningful `aria-label`s on compound controls (the deal badge spells out the
  verdict and delta; the account chip announces the active session).
- Decorative glyphs are `aria-hidden="true"` so they aren't double-announced.

### 4.4 Not-colour-alone & contrast

- The deal badge encodes meaning in **text + symbol + colour** (see §3.1), the
  canonical colour-blindness safeguard.
- The visual language targets **WCAG AA** contrast.

### 4.5 Motion sensitivity

- The stylesheet honours **`prefers-reduced-motion: reduce`**
  (`frontend/src/studio.css`), disabling non-essential animation for users who
  request it at the OS level.

### 4.6 Feedback states

Every async surface has **loading**, **empty** and **error** states — skeletons
while data loads, explicit empty copy ("Not valued yet", no-results), and
graceful fallbacks on failure — so the user is never left staring at a blank or
ambiguous screen.

---

## 5. Responsiveness & visual system

The marketplace grid and Studio wizard reflow across viewport sizes; the styling
lives in `frontend/src/studio.css`. The visual language is consistent across
Studio and Marketplace (shared cards, badges, value plates), so a user moving
between appraising and browsing stays in the same mental model.

---

## 6. How to evaluate the usability claims

| Claim | Where to verify |
|---|---|
| Deal badge is text + symbol + colour | `components/views/ListingCard.tsx`; inspect a badge in the grid |
| Buyer vs. seller verdict framing | `lib/deal.ts`; toggle modes on a listing |
| Skip link + landmarks | `App.tsx`; Tab once from page load |
| Keyboard-operable cards | `ListingCard.tsx`; Tab to a card, press Enter |
| Reduced motion | `studio.css`; enable "reduce motion" in OS settings |
| Graceful degradation | `App.tsx` `MOCK_OPTIONS` fallback; run the frontend with the backend down |
| Loading / empty / error states | Marketplace, Favorites, Listing detail views |

For the end-to-end demo script (login → marketplace → recommendations → detail →
appraisal), see the project presentation and the root [`README.md`](../README.md)
(demo login: `alice@demo.test` / `Password123!`).
