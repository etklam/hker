# HKER Project Review

Date: 2026-04-21

## Executive Summary

HKER is already a real product-shaped application, not a starter repo. The implemented surface area is meaningful:

- 13 app pages
- 45 API route handlers
- 13 server-side service modules
- 17 React components

The product scope is coherent. Collections, marketplace, family todo, invite flows, admin tooling, theme switching, and localization all exist in the current codebase.

Maintainability is decent but not yet disciplined. The biggest issues are missing automated tests, a broken standalone TypeScript check, a deprecated lint script, and a few patterns that will become painful once traffic or team size grows.

Current maintainability score: `6.5 / 10`

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

### 2. Link collections

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

### 3. Marketplace

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

### 4. Family Todo

- Space CRUD
- Space membership and invite flow
- Board fetch endpoint
- List CRUD and reorder
- Todo CRUD, reorder, move, and complete

Key files:

- `src/app/(main)/family-todo/*`
- `src/app/api/family-todo/**`
- `src/server/services/family-todo-space-service.ts`
- `src/server/services/family-todo-service.ts`
- `src/server/services/family-todo-board-service.ts`

### 5. Admin

- Dashboard stats
- Paginated user listing

Key files:

- `src/app/(main)/admin/*`
- `src/app/api/admin/*`

## What Is Good

### Clear domain separation

The service layer is sensibly split by domain. Auth, collections, marketplace, membership, invites, and family todo each have their own service file. That keeps route handlers thin and makes the product easier to reason about.

### Permission checks are centralized

Collection and space access levels are handled in one place through `src/server/services/permission-service.ts`. That is the right shape for a growing API surface.

### Security basics are present

There is concrete work here, not just intention:

- password hashing with `scrypt`
- HMAC-hashed session tokens
- CSRF origin / referer checks for non-GET routes
- per-endpoint rate limiting
- login lockout after repeated failures
- URL validation against private IP targets for stored links

### The product model is coherent

Collections feed the marketplace. Marketplace feeds subscriptions and forks. Admin public collections feed the homepage. Family todo is separate but follows the same invite-and-membership pattern. This is good product architecture.

## Findings

### 1. Standalone TypeScript verification is currently broken

Severity: High

Evidence:

- `tsconfig.json:31-37` includes `.next/types/**/*.ts` and `.next/dev/types/**/*.ts`
- running `npx tsc --noEmit` fails with many `TS6053` missing-file errors when those generated files are absent or stale

Why it matters:

The repo does not currently have a stable CI-friendly typecheck command outside `next build`. That slows down local feedback and makes tooling brittle.

### 2. There is no automated test harness in the repo

Severity: High

Evidence:

- `package.json:5-13` contains no `test` script
- there is no `test/` or `tests/` tree

Why it matters:

This app has a lot of stateful behavior: auth, invites, permission gates, subscriptions, fork logic, and kanban moves. Without tests, regressions will show up in flows users actually care about.

### 3. The lint script is on a deprecated path

Severity: Medium

Evidence:

- `package.json:9` uses `next lint`
- `npm run lint` reports that `next lint` is deprecated and will be removed in Next.js 16

Why it matters:

This is the kind of issue that quietly becomes upgrade friction. Not fatal today, annoying later.

### 4. Rate limiting and login lockout are instance-local only

Severity: Medium

Evidence:

- `src/server/api-helpers.ts:12`
- `src/server/api-helpers.ts:103`

Why it matters:

The current approach resets on restart and does not coordinate across multiple app instances. Fine for a single container, weak for scaled deployments.

### 5. Reorder operations are implemented as N sequential updates

Severity: Medium

Evidence:

- `src/server/services/link-service.ts:114-120`
- `src/server/services/family-todo-service.ts:45-52`
- `src/server/services/family-todo-service.ts:175-180`

Why it matters:

This works, but it does not scale well with bigger boards or collections. A batch update or transaction-based bulk reorder would age better.

### 6. Marketplace query shaping is duplicated in three places

Severity: Medium

Evidence:

- `src/server/services/marketplace-service.ts:23`
- `src/server/services/marketplace-service.ts:65`
- `src/app/(main)/marketplace/page.tsx:10`
- `src/app/(main)/marketplace/[listingId]/page.tsx:12`

Why it matters:

`listingSelect`, `baseQuery`, and DTO shaping logic are duplicated between the service layer and server component pages. That creates drift risk the next time marketplace fields change.

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
npx tsc --noEmit
npm run lint
AUTH_SESSION_SECRET=dev-secret \
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app \
APP_BASE_URL=http://localhost:3000 \
npm run build
```

### Results

- `npx tsc --noEmit`: failed because generated `.next/types` entries referenced by `tsconfig.json` were missing
- `npm run lint`: completed, but flagged deprecated `next lint`
- `npm run build`: passed and generated all app routes successfully

## Recommended Next Steps

1. Add a stable verification baseline:
   - replace `next lint` with ESLint CLI
   - make standalone typecheck deterministic

2. Add high-value tests first:
   - auth login / register / logout
   - collection invite join
   - family todo invite join
   - marketplace subscribe / fork

3. Consolidate duplicated marketplace query shaping into one shared server-side module.

4. Move rate limiting and lockout storage to Redis or another shared store if this app will run on more than one instance.

5. Replace sequential reorder loops with a transaction-backed bulk update pattern before boards and collections grow.
