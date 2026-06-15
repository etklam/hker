# HKER

HKER is a Next.js 15 app that serves as a family and personal operations hub. It combines three product surfaces in one codebase:

- **Monthly Bills** (flagship) - bill checklists you can share with a space, monthly check and uncheck, paid and overdue summary
- **Spaces** with a todo board - kanban-style todos with owner, admin, and member roles, plus invite links
- **Link Collections** - personal and unlisted CRUD for keeping links organized

The current implementation is not a scaffold. The repo contains the full App Router page tree, API route handlers, Drizzle schema, Zod validation schemas, domain services, and React components across bills, spaces, collections, and admin tooling.

The **Marketplace** is present but marked BETA. The API routes remain intact, and the UI surfaces a "Beta" badge to set expectations. Marketplace features are not part of the current MVP scope.

## What The App Does

### Auth and app shell

- Email/password registration and login
- Cookie-backed sessions with HMAC-hashed session tokens stored in the `auth_sessions` table, 30-day TTL by default
- Theme switching: `light`, `dark`, `eye`
- Built-in `zh-HK` and `en` UI localization via `react-i18next`
- Admin role gate for dashboard pages and admin APIs

### Monthly Bills

- Create bill checklists and share them with a space
- Mark bills as paid or unpaid each month
- Paid and overdue summary at a glance

### Spaces with todo board

- Create and rename todo spaces
- Owner, admin, and member role model
- Invite people into a space with shareable invite links
- Create, edit, delete, reorder, and move kanban lists
- Create, edit, delete, reorder, move, and complete todos
- Track assignee, priority, due date, creator, and completer
- Render full board data through a dedicated board endpoint
- Uses `@dnd-kit` for board interactions

### Link Collections

- Create, edit, and delete collections
- Set visibility to `private` or `unlisted`
- Add, edit, delete, and reorder links inside a collection
- Manage collection members and roles
- Share invite links and join collections via invite pages

Public visibility and collaborator roles exist in the schema and API, but are outside the current MVP scope.

### Marketplace (Beta)

- Publish a collection to the marketplace
- Optional anonymous publishing
- Browse, search, sort, and view listings
- Subscribe to other users' listings
- Fork a listing into a private copy
- View current subscriptions

The marketplace UI is marked Beta and is not part of the MVP surface. The API routes are kept intact for future iteration.

### Admin

- Dashboard with counts for users, collections, and links
- Paginated user list
- Homepage curation via the first admin user's public collections

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Drizzle ORM
- PostgreSQL
- `@dnd-kit` for board interactions
- `react-i18next` for client-side localization

## Project Layout

```text
src/
  app/                  App Router pages and API route handlers
  components/           UI and feature components
  db/schema/            Drizzle schema definitions
  lib/                  Client helpers, auth context, theme, shared types
  schemas/              Zod validation schemas
  server/services/      Domain services and permission logic
drizzle/                Committed Drizzle migrations
e2e/                    Playwright end-to-end tests
docs/
  design.md             UI design system
  dev-plan.md           Original product / engineering planning document
  k3s-deploy.md         k3s deployment runbook
  project-review.md     Current feature and maintainability review
```

## Local Setup

### Prerequisites

- Node.js 20+
- npm
- PostgreSQL 16+, or Docker with `docker compose`

### 1. Install dependencies

```bash
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL`
- `APP_BASE_URL`
- `AUTH_SESSION_SECRET`

`AUTH_SESSION_SECRET` must be a long random secret in any shared environment.

### 3. Start PostgreSQL

Using Docker:

```bash
docker compose up -d db
```

### 4. Apply migrations

This repo ships committed Drizzle migrations in `drizzle/`. The single migration `0000_initial_schema.sql` covers all current tables. The fresh clone path is:

```bash
docker compose up -d db
npm ci
cp .env.example .env
npm run db:migrate
```

For local schema iteration during development, you can push the schema directly:

```bash
npm run db:push
```

Or generate a new migration after editing the Drizzle schema:

```bash
npm run db:generate
```

### 5. Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev          # dev server with Turbopack
npm run build        # production build
npm run start        # run production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint . (flat config)
npm run test         # vitest unit/integration tests
npm run test:watch
npm run test:coverage
npm run test:e2e     # Playwright end-to-end tests
npm run db:generate  # generate Drizzle migration from schema
npm run db:migrate   # apply migrations
npm run db:push      # push schema directly (dev only)
npm run db:studio    # Drizzle Studio
```

## Rate Limiting

Rate limiting is DB-backed and durable across restarts and multiple app instances. A sliding window implementation uses the `rate_limit_entries` table, and account lockout state is tracked in `login_failures`.

## Current Verification Status

Verified against the current workspace on 2026-06-15:

- `npm run typecheck` is clean
- `npm run lint` reports 0 errors (20 pre-existing warnings)
- `npm run test` is all green (101 test files, 488 tests)
- `npm run build` succeeds
- `npm run test:e2e` requires a running PostgreSQL instance

The detailed review is in [docs/project-review.md](docs/project-review.md).

## Operational Notes

- Admin pages require `users.role = 'admin'`
- Homepage featured content comes from the first admin user's public collections
- Rate limiting is DB-backed: sliding window in `rate_limit_entries`, login lockouts in `login_failures`
- Session cookies are HMAC-hashed, stored in the `auth_sessions` table, with a 30-day TTL by default

## Documentation

- [Design system](docs/design.md)
- [Original dev plan](docs/dev-plan.md)
- [k3s deployment runbook](docs/k3s-deploy.md)
- [Current project review](docs/project-review.md)
