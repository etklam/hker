# HKER Project Review

Date: 2026-06-18

## Executive Summary

HKER is a real product-shaped application, not a starter repo. The implemented surface area is meaningful:

- App pages across the App Router tree covering Monthly Bills (flagship), Spaces, Collections, Marketplace (Beta), Admin, and a Tools hub
- API route handlers for auth, collections, marketplace, spaces, monthly bills, admin, and telegram webhook
- Server-side service modules grouped by domain
- React components for collections, marketplace, links, members, invites, todos, bills, and shared UI primitives

The product scope is coherent. Monthly Bills is the flagship MVP surface. Spaces and Collections support it. Marketplace is present but Beta. Everyday Tools (mortgage, resignation, cheque amount) are short-term, client-side utilities.

Maintainability has improved since the last review: automated tests are wired up, a standalone typecheck script exists, and the lint script no longer relies on the deprecated `next lint` path.

Current maintainability score: `7.5 / 10`

## Functional Coverage

### 1. Auth and app shell

- Password registration and login
- Session validation and logout
- Theme switching with persisted local preference
- `zh-HK` / `en` localization
- Admin-only navigation and admin API protection

Key files:

- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/api/auth/*`
- `src/lib/auth.tsx`
- `src/server/services/auth-service.ts`
- `src/server/services/session-service.ts`

### 2. Monthly Bills (flagship)

- Bill list CRUD (private or shared with a Space)
- Bill item CRUD (name, due day, amount, note)
- Monthly check / uncheck with paid-by tracking
- Paid / overdue / due today / upcoming status derivation
- Family-space access model (owner / admin / member)
- Summary tiles: month, paid count, unpaid amount, overdue count

Key files:

- `src/app/(main)/bills/page.tsx`
- `src/app/api/monthly-bills/**`
- `src/server/services/monthly-bill-service.ts`
- `src/lib/tools/monthly-bills.ts`

The `/tools/monthly-bills` path now 301-redirects to `/bills`. Nav and homepage both point at `/bills`.

### 3. Spaces with todo board

- Space CRUD and rename
- Owner, admin, and member role model with invite links
- List CRUD and reorder
- Todo CRUD, reorder, move, and complete
- `@dnd-kit` for board interactions

Key files:

- `src/app/(main)/spaces/*`
- `src/app/api/spaces/**`
- `src/server/services/space-service.ts`
- `src/server/services/family-todo-service.ts`
- `src/server/services/family-todo-board-service.ts`

### 4. Link Collections

- Collection CRUD
- Visibility updates
- Link CRUD and reorder
- Member listing, role changes, removal
- Invite creation, listing, revocation, and join flow

Key files:

- `src/app/(main)/me/collections/*`
- `src/app/api/me/collections/**`
- `src/server/services/collection-service.ts`
- `src/server/services/link-service.ts`
- `src/server/services/member-service.ts`
- `src/server/services/invite-service.ts`

### 5. Marketplace (Beta)

- Publish and unpublish collections
- Browse, search, and sort listings
- Listing detail pages
- Subscribe / unsubscribe
- Fork into a private collection copy
- Featured homepage content sourced from admin public collections

Key files:

- `src/app/(main)/marketplace/*`
- `src/app/api/marketplace/**`
- `src/app/api/featured/route.ts`
- `src/app/api/me/subscriptions/route.ts`
- `src/server/services/marketplace-service.ts`
- `src/server/services/subscription-service.ts`

### 6. Admin

- Dashboard stats
- Paginated user listing
- User ban / unban and role management (admin+)
- Collection management
- Marketplace pin / unpin

Key files:

- `src/app/(main)/admin/*`
- `src/app/api/admin/*`

### 7. Everyday Tools

- Mortgage calculator (down-payment → monthly, or monthly → down payment)
- Resignation Last Day calculator
- Cheque amount converter (HKD to Chinese / English cheque format)

All three are client-side only. Monthly Bills used to live under `/tools` and has been promoted to its own top-level route.

Key files:

- `src/app/(main)/tools/page.tsx` (hub)
- `src/app/(main)/tools/{mortgage,resignation-last-day,cheque-amount}/page.tsx`
- `src/lib/tools/{mortgage,resignation-last-day,cheque-amount}.ts`

## What Is Good

### Clear domain separation

The service layer is split by domain. Auth, collections, marketplace, membership, invites, family todo, and monthly bills each have their own service file. Route handlers stay thin.

### Permission checks are centralized

Collection and space access levels are handled in one place through `src/server/services/permission-service.ts`.

### Security basics are present

- password hashing with `scrypt`
- HMAC-hashed session tokens stored in the `auth_sessions` table
- CSRF origin / referer checks for non-GET routes
- DB-backed sliding-window rate limiting (`rate_limit_entries`)
- DB-backed login lockout (`login_failures`)
- URL validation against private IP targets for stored links
- Security headers applied at the edge in `src/middleware.ts`

### Testable product model

Collections feed the marketplace. Marketplace feeds subscriptions and forks. Spaces expose a board endpoint that bundles lists and todos. Monthly bills share access via Spaces. Domain boundaries make each surface testable in isolation.

### Automated verification baseline

`package.json` now ships scripts for typecheck, lint, unit/integration tests, coverage, and end-to-end tests:

```json
{
  "typecheck": "tsc --noEmit -p tsconfig.typecheck.json",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:e2e": "playwright test"
}
```

## Findings

### 1. Standalone TypeScript verification is in place

Status: Resolved

`npm run typecheck` runs `tsc --noEmit` against `tsconfig.typecheck.json`, which avoids the generated `.next/types/**/*.ts` includes that previously made the standalone check flaky.

### 2. Automated test harness is in place

Status: Resolved

`npm run test` runs Vitest. The repo has 488 passing tests across 101 files covering locale parity, lib helpers, API routes, middleware, and React component behaviour. Coverage is collected via `@vitest/coverage-v8`.

Playwright end-to-end tests live in `e2e/` and are wired up via `npm run test:e2e`. Existing specs cover homepage, auth, monthly bills MVP smoke, marketplace, spaces, tools, and API shapes.

### 3. Lint script uses ESLint CLI directly

Status: Resolved

`npm run lint` invokes `eslint .` against the flat config in `eslint.config.mjs`. The deprecated `next lint` path is no longer used.

### 4. Rate limiting and login lockout are DB-backed

Status: Resolved

Sliding-window rate limiting lives in `rate_limit_entries` and login lockout in `login_failures`. Both are durable across restarts and work across multiple app instances. A future move to Redis would make sense only if sub-millisecond accounting becomes necessary.

### 5. Reorder operations are implemented as N sequential updates

Severity: Medium

Evidence:

- `src/server/services/link-service.ts`
- `src/server/services/family-todo-service.ts`

Why it matters:

This works, but it does not scale well with bigger boards or collections. A batch update or transaction-based bulk reorder would age better.

### 6. Marketplace query shaping is duplicated

Severity: Low

`listingSelect`, `baseQuery`, and DTO shaping logic are split between the service layer and the server-component pages. Consolidating these into one shared server-side module would reduce drift risk the next time marketplace fields change.

### 7. Build passes, but the codebase is carrying warning debt

Severity: Low

Observed during `npm run build`:

- unused variables in a few pages and API routes
- several raw `<img>` usages where Next recommends `next/image`

Why it matters:

This is not a ship blocker, but it is how a clean codebase becomes noisy and harder to trust.

## Validation Run

### Commands run

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

### Results

- `npm run typecheck`: clean (deterministic standalone typecheck via `tsconfig.typecheck.json`)
- `npm run lint`: 0 errors, ~20 pre-existing warnings
- `npm run test`: green across 101 test files / 488 tests
- `npm run build`: succeeds and emits all app routes
- `npm run test:e2e`: requires a running PostgreSQL instance

## Recommended Next Steps

1. Add high-leverage tests for the remaining stateful flows:
   - collection visibility downgrade → marketplace auto-unpublish
   - space member role change (admin demotion)
   - admin user ban / unban lifecycle

2. Consolidate duplicated marketplace query shaping into one shared server-side module.

3. Replace sequential reorder loops with a transaction-backed bulk update pattern before boards and collections grow.

4. Move raw `<img>` usages to `next/image` where it matters (favicons in featured collections, marketplace cards) to silence build warnings and improve loading.

5. Watch for opportunity to surface Monthly Bills reminders (e.g. upcoming-due notification) without introducing a notification backend too early.
