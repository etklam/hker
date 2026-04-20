# HKER

HKER is a Next.js 15 app for personal knowledge curation and lightweight collaboration. It combines three product surfaces in one codebase:

- personal link collections
- a public marketplace for sharing and forking collections
- a family-style kanban todo board

The current implementation is not a scaffold. The repo contains 13 app pages, 45 API route handlers, 13 service modules, and 17 React components across auth, collections, marketplace, family todo, featured content, and admin tooling.

## What The App Does

### Auth and app shell

- Email/password registration and login
- Cookie-backed sessions with HMAC-hashed session tokens
- Theme switching: `light`, `dark`, `eye`
- Built-in `zh-HK` and `en` UI localization
- Admin role gate for dashboard pages and admin APIs

### Link collections

- Create, edit, and delete collections
- Set visibility to `private`, `unlisted`, or `public`
- Add, edit, delete, and reorder links inside a collection
- Invite collaborators as `viewer` or `editor`
- Manage collection members and roles
- Share invite links and join collections via public invite pages

### Marketplace

- Publish a collection to the marketplace
- Optional anonymous publishing
- Browse marketplace listings with pagination
- Search by title and description
- Sort by newest or most subscribed
- View listing detail pages rendered on the server
- Subscribe to other users' listings
- Fork a listing into a private copy in your own workspace
- View your current subscriptions
- Show featured public collections on the homepage

### Family Todo

- Create and rename todo spaces
- Owner / admin / member role model
- Invite people into a space with shareable invite links
- Create, edit, delete, reorder, and move kanban lists
- Create, edit, delete, reorder, move, and complete todos
- Track assignee, priority, due date, creator, and completer
- Render full board data through a dedicated board endpoint

### Admin

- Dashboard with counts for users, collections, and links
- Paginated user list
- Homepage curation via the admin user's public collections

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
  server/services/      Domain services and permission logic
docs/
  design.md             UI design system
  caprover-deploy.md    CapRover deployment runbook
  dev-plan.md           Original product / engineering planning document
  implementation-plan.md Initial implementation breakdown
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

### 4. Bootstrap the schema

This repo currently ships Drizzle schema files and config, but does not check in generated `drizzle/` migration SQL yet. For local development, the simplest path is:

```bash
npm run db:push
```

If you want migration files, generate them first:

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
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
```

## Current Verification Status

Verified against the current workspace on 2026-04-21:

- `npm run build` passes when the required env vars are set
- `npm run lint` runs, but the script still uses deprecated `next lint`
- `npx tsc --noEmit` is not currently clean because `tsconfig.json` includes generated `.next/types` paths that may not exist in a fresh or stale workspace

The detailed review is in [docs/project-review.md](docs/project-review.md).

## Operational Notes

- Admin pages require `users.role = 'admin'`
- Homepage featured content comes from the first admin user's public collections
- The build path touches server modules, so missing env vars can fail builds even before runtime
- Rate limiting and login lockouts are currently in-memory, which is acceptable for a single instance but not durable across restarts or multiple app instances

## Documentation

- [Current project review](docs/project-review.md)
- [CapRover deployment runbook](docs/caprover-deploy.md)
- [Design system](docs/design.md)
- [Original dev plan](docs/dev-plan.md)
- [Initial implementation plan](docs/implementation-plan.md)
