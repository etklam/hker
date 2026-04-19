# HKER — Next.js Rebuild Specification

> **Version**: 1.0 · **Date**: 2026-04-19
> This document is the sole reference for rebuilding HKER from scratch as a Next.js monolith.
> It is self-contained — no other source should be needed.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project File Structure](#3-project-file-structure)
4. [Database Schema](#4-database-schema)
5. [Permission System](#5-permission-system)
6. [Authentication](#6-authentication)
7. [API Specification](#7-api-specification)
8. [Shared DTO Types](#8-shared-dto-types)
9. [Pages Reference](#9-pages-reference)
10. [Components Reference](#10-components-reference)
11. [Styling System](#11-styling-system)
12. [Internationalization](#12-internationalization)
13. [Environment Variables](#13-environment-variables)
14. [Docker and Deployment](#14-docker-and-deployment)
15. [package.json Dependencies](#15-packagejson-dependencies)
16. [drizzle.config.ts](#16-drizzleconfigts)
17. [Implementation Phases](#17-implementation-phases)
18. [Critical Implementation Notes](#18-critical-implementation-notes)

---

## 1. Project Overview

**HKER** (formerly `hker-java`) is a personal productivity and link management web application. The project is being rewritten from a Spring Boot (Kotlin) + React (Vite) monorepo into a single Next.js application.

### Primary Product Areas

#### Link Collections
Create, organise, and manage curated link collections. Each collection has configurable visibility:

| Visibility | Who can view |
|------------|-------------|
| `private`  | Owner and explicit members only |
| `unlisted` | Anyone with the direct link |
| `public`   | Publicly discoverable; eligible for marketplace |

Collaborative editing via invite links with **role-based permissions**: `owner` / `editor` / `viewer`.

#### Marketplace
Publish public link collections for community discovery. Features:
- Browse and search published collections
- Subscribe to collections for updates
- Fork a collection into your own account
- Subscriber and fork counts shown on each listing
- Optional anonymous publishing (publisher identity hidden)

#### Family Todo
Kanban-style collaborative task management. Hierarchy:

```
Space (workspace)
└── Lists (columns)
    └── Tasks (cards)
```

- Drag-and-drop reordering of both lists and tasks
- Cross-list task moves
- Role-based space access: `owner` / `admin` / `member`
- Task metadata: priority, due date, assignee, completion tracking

#### Authentication
- **Email/password login** for alpha and beta
- **Provider-neutral identity model** from day one: user accounts are separate from login methods
- Future SSO/OIDC providers can be added by attaching new identities to existing users

---

## 2. Tech Stack

### New Stack (Next.js)

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | Next.js 15+ (App Router) | Hybrid SSR/CSR |
| Language | TypeScript 5.8+ | Strict mode |
| ORM | Drizzle ORM + drizzle-kit | SQL-like API, migration tooling |
| Database | PostgreSQL 16 | Via `postgres` (pg) driver |
| Auth (client) | Custom `AuthProvider` + `/api/auth/session` | Same-origin cookie session |
| Auth (server) | Node `crypto` + Next.js cookies API | Password hashing + session issuance |
| Styling | Tailwind CSS v4 + `@tailwindcss/postcss` | CSS custom properties for themes |
| i18n | `i18next` + `react-i18next` | zh-HK default, English secondary |
| Drag and Drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Kanban board |
| Deployment | Docker (standalone output) + CapRover | |

### Key Architectural Decisions

**Drizzle over Prisma**
Lighter weight, SQL-like API, better for complex custom queries without heavy abstraction overhead.

**Provider-neutral auth model**
Use first-party email/password login now, but model identities separately from users:
- `users` stores the application user
- `auth_identities` stores login methods (`password`, future `google`, `oidc`, etc.)
- `auth_sessions` stores hashed session tokens for HttpOnly cookie auth

This keeps domain tables tied only to `user.id`, so future SSO does not require rewriting permissions, invites, memberships, or ownership.

**Hybrid SSR strategy**
- Marketplace listing and detail pages: **Server Components** (SEO-critical, publicly indexable)
- All authenticated user pages: **Client Components** (interactive, auth-gated)

**Tests deferred**
No test suite in initial rebuild. Add after stabilisation.

**Standalone Docker output**
Required for CapRover deployment. Set in `next.config.ts`.

**API route prefix convention**
All API routes live under `/api/*` — matches the previous Spring Boot convention.

---

## 3. Project File Structure

```
/
├── src/
│   ├── app/
│   │   ├── layout.tsx                          # Root layout — wraps with Providers
│   │   ├── globals.css                         # Tailwind + CSS custom properties (3 themes)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx                  # Email/password login page
│   │   │   └── register/page.tsx               # Email/password registration page
│   │   ├── (main)/
│   │   │   ├── layout.tsx                      # MainLayout: nav, theme/lang switcher
│   │   │   ├── page.tsx                        # Home page
│   │   │   ├── me/collections/
│   │   │   │   ├── page.tsx                    # My Collections list
│   │   │   │   └── [id]/page.tsx               # Collection detail
│   │   │   ├── marketplace/
│   │   │   │   ├── page.tsx                    # Marketplace listing (Server Component)
│   │   │   │   └── [listingId]/page.tsx        # Marketplace detail (Server Component)
│   │   │   ├── family-todo/
│   │   │   │   ├── page.tsx                    # Family Todo spaces list
│   │   │   │   └── spaces/[sid]/page.tsx       # Kanban board
│   │   │   ├── invite/[token]/page.tsx         # Collection invite join page
│   │   │   └── family-todo/invite/[token]/page.tsx  # Family Todo invite join page
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── auth/
│   │       │   ├── session/route.ts
│   │       │   ├── register/route.ts
│   │       │   ├── login/route.ts
│   │       │   └── logout/route.ts
│   │       ├── me/
│   │       │   ├── collections/route.ts
│   │       │   ├── collections/[id]/route.ts
│   │       │   ├── collections/[id]/visibility/route.ts
│   │       │   ├── collections/[id]/links/route.ts
│   │       │   ├── collections/[id]/links/[linkId]/route.ts
│   │       │   ├── collections/[id]/links/reorder/route.ts
│   │       │   ├── collections/[id]/invites/route.ts
│   │       │   ├── collections/[id]/invites/[inviteId]/route.ts
│   │       │   ├── collections/[id]/members/route.ts
│   │       │   ├── collections/[id]/members/[memberId]/route.ts
│   │       │   └── subscriptions/route.ts
│   │       ├── invites/
│   │       │   └── [token]/
│   │       │       ├── route.ts
│   │       │       └── join/route.ts
│   │       ├── marketplace/
│   │       │   ├── route.ts
│   │       │   ├── search/route.ts
│   │       │   ├── [listingId]/route.ts
│   │       │   ├── publish/[collectionId]/route.ts
│   │       │   ├── unpublish/[collectionId]/route.ts
│   │       │   ├── [listingId]/subscribe/route.ts
│   │       │   └── [listingId]/fork/route.ts
│   │       └── family-todo/
│   │           ├── spaces/route.ts
│   │           ├── spaces/[sid]/route.ts
│   │           ├── spaces/[sid]/board/route.ts
│   │           ├── spaces/[sid]/lists/route.ts
│   │           ├── spaces/[sid]/lists/[lid]/route.ts
│   │           ├── spaces/[sid]/lists/reorder/route.ts
│   │           ├── spaces/[sid]/invites/route.ts
│   │           ├── spaces/[sid]/members/route.ts
│   │           ├── spaces/[sid]/members/[mid]/route.ts
│   │           ├── invites/[token]/route.ts
│   │           ├── invites/[token]/join/route.ts
│   │           ├── lists/[lid]/todos/route.ts
│   │           ├── lists/[lid]/todos/reorder/route.ts
│   │           ├── todos/[tid]/route.ts
│   │           ├── todos/[tid]/complete/route.ts
│   │           └── todos/[tid]/move/route.ts
│   ├── components/
│   │   ├── providers.tsx                       # Client: AuthProvider + i18n init
│   │   ├── ToastHost.tsx                       # Global toast notifications (client)
│   │   ├── CollectionCard.tsx
│   │   ├── CollectionFormModal.tsx
│   │   ├── LinkCard.tsx
│   │   ├── LinkFormModal.tsx
│   │   ├── InviteManagePanel.tsx
│   │   ├── MemberList.tsx
│   │   ├── MarketplaceCard.tsx
│   │   ├── SearchBar.tsx
│   │   ├── ui/
│   │   │   ├── CollectionAvatar.tsx
│   │   │   └── Glyphs.tsx
│   │   └── todo/
│   │       ├── TodoBoard.tsx
│   │       ├── TodoColumn.tsx
│   │       ├── TodoCard.tsx
│   │       ├── TodoFormModal.tsx
│   │       └── AddListButton.tsx
│   ├── db/
│   │   └── schema/
│   │       ├── users.ts
│   │       ├── auth.ts
│   │       ├── collections.ts
│   │       ├── marketplace.ts
│   │       ├── collaboration.ts
│   │       └── familyTodo.ts
│   ├── server/
│   │   ├── db.ts                               # Drizzle client singleton
│   │   ├── auth.ts                             # Session resolution + cookie helpers
│   │   ├── api-helpers.ts                      # withAuth(), error helpers, rate limiting
│   │   └── services/
│   │       ├── user-service.ts                 # createUser, findByEmail, profile updates
│   │       ├── auth-service.ts                 # register/login + identity linking
│   │       ├── session-service.ts              # createSession, destroySession
│   │       ├── permission-service.ts           # RBAC access checks
│   │       ├── collection-service.ts
│   │       ├── link-service.ts                 # includes SSRF validation
│   │       ├── marketplace-service.ts
│   │       ├── subscription-service.ts
│   │       ├── invite-service.ts
│   │       ├── family-todo-space-service.ts
│   │       ├── family-todo-service.ts
│   │       └── family-todo-board-service.ts
│   ├── lib/
│   │   ├── auth.tsx                            # AuthProvider (client, session bootstrap)
│   │   ├── api-client.ts                       # Client-side fetch wrapper
│   │   ├── types.ts                            # Shared DTO types
│   │   ├── errors.ts                           # Error types and helpers
│   │   ├── toast.ts                            # Event-based toast system
│   │   └── theme.ts                            # Theme store (useSyncExternalStore)
│   ├── hooks/
│   │   └── useCollectionAccess.ts
│   └── i18n/
│       ├── index.ts
│       └── locales/
│           ├── zh-HK.json
│           └── en.json
├── drizzle/                                    # Generated migrations (committed)
├── drizzle.config.ts
├── next.config.ts
├── postcss.config.mjs
├── Dockerfile
├── captain-definition
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 4. Database Schema

The database has **15 tables** spread across 6 schema files under `src/db/schema/`. All use `pgTable` from `drizzle-orm/pg-core`. Use `npm run db:generate` to produce migrations after any schema change.

### 4.1 Users (`src/db/schema/users.ts`)

```typescript
import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueEmail: uniqueIndex('users_email_unique').on(table.email),
}))
```

`users` is the application-level identity used by collections, spaces, invites, subscriptions, and permissions. It is intentionally independent from any login provider.

### 4.2 Authentication (`src/db/schema/auth.ts`)

```typescript
import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

export const authIdentities = pgTable('auth_identities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),                 // 'password', future 'google', 'oidc', etc.
  providerSubject: text('provider_subject').notNull(), // email for password, external sub for SSO
  passwordHash: text('password_hash'),
  email: text('email'),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => ({
  uniqueProviderSubject: uniqueIndex('auth_identities_provider_subject_unique')
    .on(table.provider, table.providerSubject),
}))

export const authSessions = pgTable('auth_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
})
```

Initial implementation creates one `auth_identities` row with `provider='password'`. Future SSO adds more rows for the same `user_id`; the rest of the product continues to reference only `users.id`.

### 4.3 Collections and Links (`src/db/schema/collections.ts`)

```typescript
import { pgTable, serial, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const visibilityEnum = pgEnum('collection_visibility', ['private', 'unlisted', 'public'])

export const collections = pgTable('collections', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  icon: text('icon'),
  visibility: visibilityEnum('visibility').notNull().default('private'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const links = pgTable('links', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  faviconUrl: text('favicon_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### 4.4 Marketplace (`src/db/schema/marketplace.ts`)

```typescript
import { pgTable, serial, integer, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'
import { collections } from './collections'

export const marketplaceListings = pgTable('marketplace_listings', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').notNull().unique().references(() => collections.id, { onDelete: 'cascade' }),
  publisherId: integer('publisher_id').notNull().references(() => users.id),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  subscriberCount: integer('subscriber_count').notNull().default(0),
  forkCount: integer('fork_count').notNull().default(0),
  publisherAnonymous: boolean('publisher_anonymous').notNull().default(false),
})

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  listingId: integer('listing_id').notNull().references(() => marketplaceListings.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueUserListing: uniqueIndex('subscriptions_user_listing_unique').on(table.userId, table.listingId),
}))

export const forks = pgTable('forks', {
  id: serial('id').primaryKey(),
  sourceCollectionId: integer('source_collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  forkedCollectionId: integer('forked_collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  forkedBy: integer('forked_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**Note on denormalized counters**: `subscriber_count` and `fork_count` are maintained manually — see [Section 18](#18-critical-implementation-notes).

### 4.5 Collaboration (`src/db/schema/collaboration.ts`)

```typescript
import { pgTable, serial, integer, text, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'
import { collections } from './collections'

export const collectionMemberRoleEnum = pgEnum('collection_member_role', ['viewer', 'editor'])

export const collectionMembers = pgTable('collection_members', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  role: collectionMemberRoleEnum('role').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueCollectionUser: uniqueIndex('collection_members_collection_user_unique').on(table.collectionId, table.userId),
}))

export const collectionInviteLinks = pgTable('collection_invite_links', {
  id: serial('id').primaryKey(),
  collectionId: integer('collection_id').notNull().references(() => collections.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  role: collectionMemberRoleEnum('role').notNull(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### 4.6 Family Todo (`src/db/schema/familyTodo.ts`)

```typescript
import { pgTable, serial, integer, text, boolean, timestamp, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'

export const familyTodoSpaceRoleEnum = pgEnum('family_todo_space_role', ['owner', 'admin', 'member'])
export const todoPriorityEnum = pgEnum('todo_priority', ['low', 'medium', 'high', 'urgent'])

export const familyTodoSpaces = pgTable('family_todo_spaces', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: integer('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const familyTodoSpaceMembers = pgTable('family_todo_space_members', {
  id: serial('id').primaryKey(),
  spaceId: integer('space_id').notNull().references(() => familyTodoSpaces.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id),
  role: familyTodoSpaceRoleEnum('role').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueSpaceUser: uniqueIndex('space_members_space_user_unique').on(table.spaceId, table.userId),
}))

export const familyTodoLists = pgTable('family_todo_lists', {
  id: serial('id').primaryKey(),
  spaceId: integer('space_id').notNull().references(() => familyTodoSpaces.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const familyTodos = pgTable('family_todos', {
  id: serial('id').primaryKey(),
  listId: integer('list_id').notNull().references(() => familyTodoLists.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  assignedTo: integer('assigned_to').references(() => users.id),
  priority: todoPriorityEnum('priority').notNull().default('medium'),
  dueDate: timestamp('due_date', { withTimezone: true }),
  completed: boolean('completed').notNull().default(false),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  completedBy: integer('completed_by').references(() => users.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: integer('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const familyTodoInviteLinks = pgTable('family_todo_invite_links', {
  id: serial('id').primaryKey(),
  spaceId: integer('space_id').notNull().references(() => familyTodoSpaces.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  maxUses: integer('max_uses'),
  useCount: integer('use_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

## 5. Permission System

### Collection Access Levels

Access levels are ordered ascending:

```
NONE  <  VIEW  <  EDIT  <  OWNER
  0       1       2        3
```

| Condition | Resolved Level |
|-----------|---------------|
| User is the collection `owner_id` | `OWNER` |
| User is a `collection_member` with role `editor` | `EDIT` |
| User is a `collection_member` with role `viewer` | `VIEW` |
| Collection visibility is `public`, user not a member | `VIEW` |
| Collection visibility is `unlisted` or `private`, user not a member | `NONE` |

### Family Todo Space Access Levels

```
NONE  <  MEMBER  <  ADMIN  <  OWNER
  0        1          2        3
```

| Condition | Resolved Level |
|-----------|---------------|
| User is the space `owner_id` | `OWNER` |
| User is a `family_todo_space_member` with role `admin` | `ADMIN` |
| User is a `family_todo_space_member` with role `member` | `MEMBER` |
| User has no membership | `NONE` |

Spaces are **never publicly accessible**. Authentication is always required.

### Implementation Pattern (`src/server/services/permission-service.ts`)

```typescript
type CollectionAccess = 'none' | 'view' | 'edit' | 'owner'
type SpaceAccess = 'none' | 'member' | 'admin' | 'owner'

const collectionAccessOrder: Record<CollectionAccess, number> = {
  none: 0, view: 1, edit: 2, owner: 3,
}
const spaceAccessOrder: Record<SpaceAccess, number> = {
  none: 0, member: 1, admin: 2, owner: 3,
}

export function requireAtLeast(actual: CollectionAccess, required: CollectionAccess): void {
  if (collectionAccessOrder[actual] < collectionAccessOrder[required]) {
    throw new Error('FORBIDDEN')
  }
}

export function requireSpaceAtLeast(actual: SpaceAccess, required: SpaceAccess): void {
  if (spaceAccessOrder[actual] < spaceAccessOrder[required]) {
    throw new Error('FORBIDDEN')
  }
}

// Queries the DB and resolves the effective access level for a user + collection
export async function getCollectionAccess(userId: number, collectionId: number): Promise<CollectionAccess>

// Queries the DB and resolves the effective access level for a user + space
export async function getSpaceAccess(userId: number, spaceId: number): Promise<SpaceAccess>
```

---

## 6. Authentication

### Client-Side (`src/lib/auth.tsx`)

The client uses a first-party `AuthProvider` backed by same-origin cookie sessions.

**Context shape**:

```typescript
interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (input: { email: string; password: string }) => Promise<void>
  register: (input: { email: string; password: string; displayName?: string }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}
```

Bootstrap flow:

```typescript
// Runs once on app mount
const session = await fetch('/api/auth/session', {
  method: 'GET',
  credentials: 'include',
}).then(r => r.json())

setUser(session.user)
```

All authenticated client requests use `credentials: 'include'` so the browser sends the session cookie automatically. No bearer token plumbing is needed inside the app.

### Server-Side Session Auth (`src/server/auth.ts`)

```typescript
// Reads the HttpOnly session cookie, hashes/compares it against auth_sessions,
// loads the linked user, and returns AuthUser | null.
//
// Login/register flow:
// 1. Normalize email (trim + lowercase)
// 2. Verify or create a 'password' identity in auth_identities
// 3. Create a random session token
// 4. Store only tokenHash in auth_sessions
// 5. Set secure HttpOnly cookie
//
// Future SSO flow:
// 1. Complete OAuth/OIDC callback with provider SDK later
// 2. Upsert auth_identities(provider, providerSubject)
// 3. Reuse the exact same session creation logic
```

### `withAuth` Middleware Pattern (`src/server/api-helpers.ts`)

```typescript
export function withAuth(
  handler: (req: NextRequest, user: AuthUser) => Promise<Response>
): (req: NextRequest) => Promise<Response>

export function withOptionalAuth(
  handler: (req: NextRequest, user: AuthUser | null) => Promise<Response>
): (req: NextRequest) => Promise<Response>
```

Usage in route handlers:

```typescript
// src/app/api/me/collections/route.ts
export const GET = withAuth(async (req, user) => {
  const collections = await collectionService.listForUser(user.id)
  return Response.json(collections)
})
```

### Future SSO Extension

SSO is intentionally deferred from alpha/beta, but the data model is ready for it:

- Keep all business tables referencing only `users.id`
- Add one or more new `auth_identities` rows for the same user when SSO is introduced
- Reuse the existing `auth_sessions` table and cookie issuance flow
- Link accounts by verified email or explicit account-linking UI; do not create duplicate users for the same human unless intentionally separate

### Error Response Format

**ALL API errors must follow this shape**:

```json
{ "code": "ERROR_CODE_STRING", "message": "Human readable message" }
```

Standard error codes:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `NOT_FOUND` | 404 | Resource does not exist |
| `FORBIDDEN` | 403 | Authenticated but insufficient access |
| `UNAUTHORIZED` | 401 | No or invalid authentication |
| `INVALID_CREDENTIALS` | 401 | Email/password mismatch |
| `INVALID_REQUEST` | 400 | Validation failure |
| `CONFLICT` | 409 | Unique constraint or idempotency conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### Rate Limiting

Implemented in `src/server/api-helpers.ts` as **in-memory, per-IP, 60-second sliding windows**.

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/login` | 20 req/min |
| `POST /api/auth/register` | 10 req/min |
| `GET /api/marketplace/search` | 60 req/min |
| `GET /api/marketplace` | 90 req/min |
| `GET /api/family-todo/invites/:token` | 60 req/min |
| `POST /api/family-todo/invites/:token/join` | 30 req/min |
| `POST /api/invites/:token/join` | 30 req/min |
| `GET /api/invites/:token` | 60 req/min |
| All other endpoints | 120 req/min |

**Trusted proxy support**: Read `X-Forwarded-For` only when the request's direct IP is listed in the `TRUSTED_PROXIES` env var (comma-separated). Never trust `X-Forwarded-For` from unknown IPs.

---

## 7. API Specification

All routes are under `/api/`. Request bodies are JSON. Responses are JSON unless stated otherwise.

### 7.1 Health

```
GET /api/health
Auth:     Public
Response: { status: "ok", service: "hker", time: "<ISO8601>" }
```

### 7.2 Authentication

#### `GET /api/auth/session`
- **Auth**: Optional
- **Response**: `SessionResponse` — `{ authenticated: boolean, user: AuthUser | null }`
- Used by the client `AuthProvider` to hydrate auth state on page load.

#### `POST /api/auth/register`
- **Auth**: Public
- **Body**: `{ email: string, password: string, displayName?: string }`
- **Response**: `SessionResponse`
- Normalizes email to lowercase.
- Creates `users` row + `auth_identities(provider='password')` row + session cookie in one transaction.
- Validation: email required, password length 8–128.

#### `POST /api/auth/login`
- **Auth**: Public
- **Body**: `{ email: string, password: string }`
- **Response**: `SessionResponse`
- Verifies the password identity and creates a fresh session.
- Returns `INVALID_CREDENTIALS` on mismatch.

#### `POST /api/auth/logout`
- **Auth**: Optional
- **Response**: `204 No Content`
- Deletes the current session row (if present) and clears the cookie.

SSO is intentionally not part of the initial implementation. When added later, it should create or link `auth_identities` rows and then reuse the same session issuance path as `login`.

### 7.3 Collections

#### `GET /api/me/collections`
- **Auth**: Required
- **Response**: `CollectionResponse[]`
- Returns owned collections AND collections where the user is a member, sorted by `updatedAt DESC`.
- Each item includes: `id`, `title`, `description`, `icon`, `visibility`, `sortOrder`, `linkCount`, `access` (`"owner"|"editor"|"viewer"`), `createdAt`, `updatedAt`.

#### `POST /api/me/collections`
- **Auth**: Required
- **Body**: `{ title: string, description?: string, icon?: string }`
- **Response**: `CollectionResponse`
- Creates with `visibility=private`, `sortOrder=0`.

#### `GET /api/me/collections/:id`
- **Auth**: Required (VIEW+)
- **Response**: `CollectionResponse`

#### `PATCH /api/me/collections/:id`
- **Auth**: Required (OWNER only)
- **Body**: `{ title?: string, description?: string, icon?: string, sortOrder?: number }`
- **Response**: `CollectionResponse`

#### `PATCH /api/me/collections/:id/visibility`
- **Auth**: Required (OWNER only)
- **Body**: `{ visibility: "private" | "unlisted" | "public" }`
- **Response**: `CollectionResponse`

#### `DELETE /api/me/collections/:id`
- **Auth**: Required (OWNER only)
- **Response**: `204 No Content`

### 7.4 Links

#### `GET /api/me/collections/:id/links`
- **Auth**: Required (VIEW+)
- **Response**: `LinkResponse[]`
- Each item: `id`, `collectionId`, `title`, `url`, `description`, `faviconUrl`, `sortOrder`, `createdAt`, `updatedAt`.

#### `POST /api/me/collections/:id/links`
- **Auth**: Required (EDIT+)
- **Body**: `{ title: string, url: string, description?: string }`
- **Response**: `LinkResponse`
- **SSRF protection**: Block private/loopback/link-local/multicast IPs and non-HTTP(S) schemes. See [Section 18](#18-critical-implementation-notes).

#### `PATCH /api/me/collections/:id/links/:linkId`
- **Auth**: Required (EDIT+)
- **Body**: `{ title?: string, url?: string, description?: string }`
- **Response**: `LinkResponse`
- URL validation applies if `url` is present in the body.

#### `DELETE /api/me/collections/:id/links/:linkId`
- **Auth**: Required (EDIT+)
- **Response**: `204 No Content`

#### `PATCH /api/me/collections/:id/links/reorder`
- **Auth**: Required (EDIT+)
- **Body**: `{ ids: number[] }`
- **Response**: `204 No Content`
- `ids` must contain **all** link IDs for the collection. Updates `sort_order` to match the array index.

### 7.5 Invites and Members

#### `GET /api/me/collections/:id/invites`
- **Auth**: Required (OWNER only)
- **Response**: `InviteLinkResponse[]`
- Each item: `id`, `token`, `role`, `maxUses`, `useCount`, `expiresAt`, `url` (full invite URL).

#### `POST /api/me/collections/:id/invites`
- **Auth**: Required (OWNER only)
- **Body**: `{ role: "viewer" | "editor", maxUses?: number, expiresInHours?: number }`
- **Validation**: `maxUses` must be 1–10000 if provided. `expiresInHours` must be 1–8760 if provided.
- **Response**: `InviteLinkResponse`
- Token: 64-char cryptographically random base64url string.

#### `DELETE /api/me/collections/:id/invites/:inviteId`
- **Auth**: Required (OWNER only)
- **Response**: `204 No Content`

#### `GET /api/invites/:token`
- **Auth**: Public
- **Response**: `{ collection, role, maxUses, useCount, expiresAt, isValid: boolean }`
- `isValid` is `false` if expired or at max uses.

#### `POST /api/invites/:token/join`
- **Auth**: Required
- **Response**: `{ collection: CollectionResponse, role: string }`
- Transactional. See [Section 18](#18-critical-implementation-notes) for the atomic join pattern.
- Rate limit: **30 req/min**.
- If user is already the owner → `200` (no change).
- If user is already a member → return existing membership.

#### `GET /api/me/collections/:id/members`
- **Auth**: Required (OWNER only)
- **Response**: `MemberResponse[]`
- Each item: `id`, `userId`, `role`, `joinedAt`, `displayName`, `avatarUrl`, `email`.

#### `DELETE /api/me/collections/:id/members/:memberId`
- **Auth**: Required (OWNER only)
- **Response**: `204 No Content`
- Cannot remove a record that represents the owner.

### 7.6 Marketplace

#### `GET /api/marketplace`
- **Auth**: Public
- **Query**: `page` (0-based), `size` (max 100), `sort` (`"newest"` | `"most_subscribed"`)
- **Response**: `PageResponse<MarketplaceListingResponse>`
- `PageResponse`: `{ content: T[], page, size, totalElements, totalPages }`
- Rate limit: **90 req/min**.

#### `GET /api/marketplace/search`
- **Auth**: Public
- **Query**: `q`, `page`, `size`
- **Response**: `PageResponse<MarketplaceListingResponse>`
- Uses `ILIKE` on collection `title` and `description`.
- Rate limit: **60 req/min**.

#### `GET /api/marketplace/:listingId`
- **Auth**: Public
- **Response**: `{ listing: MarketplaceListingResponse, links: LinkResponse[] }`

#### `POST /api/marketplace/publish/:collectionId`
- **Auth**: Required (OWNER only)
- **Query**: `anonymous=true|false`
- **Response**: `MarketplaceListingResponse`
- Sets collection `visibility` to `public`. Upserts listing.

#### `DELETE /api/marketplace/unpublish/:collectionId`
- **Auth**: Required (OWNER only)
- **Response**: `204 No Content`
- Deletes the listing. Sets collection `visibility` to `unlisted`.

#### `POST /api/marketplace/:listingId/subscribe`
- **Auth**: Required
- **Response**: `204 No Content`
- Prevents self-subscription. Idempotent. Increments `subscriber_count`.

#### `DELETE /api/marketplace/:listingId/subscribe`
- **Auth**: Required
- **Response**: `204 No Content`
- Decrements `subscriber_count` (floor at 0).

#### `POST /api/marketplace/:listingId/fork`
- **Auth**: Required
- **Response**: `CollectionResponse` (the new forked collection)
- Deep copy: new collection row + all links copied.
- Prevents self-fork and duplicate fork. Increments `fork_count`.

#### `GET /api/me/subscriptions`
- **Auth**: Required
- **Response**: `MarketplaceListingResponse[]`

### 7.7 Family Todo — Spaces, Lists, Members

#### `GET /api/family-todo/spaces`
- **Auth**: Required
- **Response**: `SpaceResponse[]` — `{ id, name, ownerId, role: "owner"|"admin"|"member", createdAt, updatedAt }`

#### `POST /api/family-todo/spaces`
- **Auth**: Required
- **Body**: `{ name: string }`
- **Response**: `SpaceResponse`
- Creator automatically becomes the owner.

#### `PATCH /api/family-todo/spaces/:sid`
- **Auth**: Required (ADMIN+)
- **Body**: `{ name?: string }`
- **Response**: `SpaceResponse`

#### `DELETE /api/family-todo/spaces/:sid`
- **Auth**: Required (ADMIN+)
- **Response**: `204 No Content`

#### `GET /api/family-todo/spaces/:sid/board`
- **Auth**: Required (MEMBER+)
- **Response**: `{ space: SpaceResponse, lists: TodoListWithItems[] }`
- Implementation: 2 DB queries (all lists + all todos for space) + 1 batch user lookup. Assemble in memory.

#### `POST /api/family-todo/spaces/:sid/lists`
- **Auth**: Required (ADMIN+)
- **Body**: `{ title: string }`
- **Response**: `TodoListResponse`

#### `PATCH /api/family-todo/spaces/:sid/lists/:lid`
- **Auth**: Required (ADMIN+)
- **Body**: `{ title?: string }`
- **Response**: `TodoListResponse`

#### `DELETE /api/family-todo/spaces/:sid/lists/:lid`
- **Auth**: Required (ADMIN+)
- **Response**: `204 No Content`

#### `PATCH /api/family-todo/spaces/:sid/lists/reorder`
- **Auth**: Required (ADMIN+)
- **Body**: `{ ids: number[] }`
- **Response**: `204 No Content`

#### `POST /api/family-todo/spaces/:sid/invites`
- **Auth**: Required (ADMIN+)
- **Body**: `{ maxUses?: number (1-10000), expiresInHours?: number (1-8760) }`
- **Response**: `{ id, spaceId, token, maxUses, useCount, expiresAt, createdAt, url }`

#### `GET /api/family-todo/invites/:token`
- **Auth**: Public
- **Response**: `{ space, maxUses, useCount, expiresAt, isValid: boolean }`
- `isValid` is `false` if expired or at max uses.

#### `POST /api/family-todo/invites/:token/join`
- **Auth**: Required
- **Response**: `{ space: SpaceResponse }`
- Same transactional join pattern as collection invites. Rate limit: **30 req/min**.

#### `GET /api/family-todo/spaces/:sid/members`
- **Auth**: Required (ADMIN+)
- **Response**: `SpaceMemberResponse[]` — `{ id, userId, role, joinedAt, displayName, avatarUrl, email }`

#### `DELETE /api/family-todo/spaces/:sid/members/:mid`
- **Auth**: Required (ADMIN+)
- **Response**: `204 No Content`

### 7.8 Family Todo — Tasks

#### `POST /api/family-todo/lists/:lid/todos`
- **Auth**: Required (MEMBER+ in parent space)
- **Body**: `{ title: string, description?: string, priority?: "low"|"medium"|"high"|"urgent", dueDate?: string, assignedTo?: number }`
- **Response**: `TodoResponse`

#### `PATCH /api/family-todo/todos/:tid`
- **Auth**: Required (MEMBER+)
- **Body**: `{ title?: string, description?: string, priority?: string, dueDate?: string|null, assignedTo?: number|null }`
- **Response**: `TodoResponse`

#### `DELETE /api/family-todo/todos/:tid`
- **Auth**: Required (MEMBER+)
- **Response**: `204 No Content`

#### `PATCH /api/family-todo/todos/:tid/complete`
- **Auth**: Required (MEMBER+)
- **Body**: `{ completed: boolean }`
- **Response**: `TodoResponse`
- Sets `completedAt` + `completedBy` when `true`. Clears both when `false`.

#### `PATCH /api/family-todo/todos/:tid/move`
- **Auth**: Required (MEMBER+)
- **Body**: `{ targetListId: number }`
- **Response**: `TodoResponse`
- Cross-list moves within the **same space only**.

#### `PATCH /api/family-todo/lists/:lid/todos/reorder`
- **Auth**: Required (MEMBER+)
- **Body**: `{ ids: number[] }`
- **Response**: `204 No Content`
- `ids` must contain all todo IDs for the list.

---

## 8. Shared DTO Types

Complete TypeScript types in `src/lib/types.ts`.

```typescript
export interface AuthUser {
  id: number
  email: string | null
  displayName: string | null
  avatarUrl: string | null
}

export interface SessionResponse {
  authenticated: boolean
  user: AuthUser | null
}

export interface Collection {
  id: number
  title: string
  description: string | null
  icon: string | null
  visibility: 'private' | 'unlisted' | 'public'
  sortOrder: number
  linkCount: number
  access: 'owner' | 'editor' | 'viewer' | 'none'
  createdAt: string
  updatedAt: string
}

export interface Link {
  id: number
  collectionId: number
  title: string
  url: string
  description: string | null
  faviconUrl: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface PublisherInfo {
  id: number
  displayName: string | null
  avatarUrl: string | null
}

export interface MarketplaceListing {
  id: number
  collection: Collection
  publisher: PublisherInfo | null
  publishedAt: string
  subscriberCount: number
  forkCount: number
}

export interface MarketplaceDetail {
  listing: MarketplaceListing
  links: Link[]
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface InviteLink {
  id: number
  token: string
  role: 'viewer' | 'editor'
  maxUses: number | null
  useCount: number
  expiresAt: string | null
  url: string
}

export interface InviteInfo {
  collection: Collection
  role: string
  maxUses: number | null
  useCount: number
  expiresAt: string | null
  isValid: boolean
}

export interface InviteJoinResponse {
  collection: Collection
  role: string
}

export interface FamilyTodoInviteInfo {
  space: FamilyTodoSpace
  maxUses: number | null
  useCount: number
  expiresAt: string | null
  isValid: boolean
}

export interface Member {
  id: number
  userId: number
  role: string
  joinedAt: string
  displayName: string | null
  avatarUrl: string | null
  email: string | null
}

export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface UserBrief {
  id: number
  displayName: string | null
  avatarUrl: string | null
  email: string | null
}

export interface FamilyTodoSpace {
  id: number
  name: string
  ownerId: number
  role: string
  createdAt: string
  updatedAt: string
}

export interface TodoListResponse {
  id: number
  spaceId: number
  title: string
  sortOrder: number
  createdAt: string
}

export interface TodoResponse {
  id: number
  listId: number
  title: string
  description: string | null
  assignedTo: UserBrief | null
  priority: TodoPriority
  dueDate: string | null
  completed: boolean
  completedAt: string | null
  completedBy: UserBrief | null
  sortOrder: number
  createdBy: UserBrief
  createdAt: string
  updatedAt: string
}

export interface TodoListWithItems extends TodoListResponse {
  todos: TodoResponse[]
}

export interface BoardResponse {
  space: FamilyTodoSpace
  lists: TodoListWithItems[]
}
```

---

## 9. Pages Reference

### 9.1 Login

| | |
|--|--|
| File | `src/app/(auth)/login/page.tsx` |
| Type | Client Component |
| Route | `/login` |
| Auth | Public |

Purpose: Email/password login form.
Data: `POST /api/auth/login`.
Query params: `returnTo` (optional) — defaults to `/`.
Success: refresh auth state, then `router.replace(sanitizeReturnTo(returnTo))`.

---

### 9.2 Register

| | |
|--|--|
| File | `src/app/(auth)/register/page.tsx` |
| Type | Client Component |
| Route | `/register` |
| Auth | Public |

Purpose: Create a new HKER account using email/password.
Data: `POST /api/auth/register`.
Query params: `returnTo` (optional) — defaults to `/`.
Success: user is auto-signed-in, then `router.replace(sanitizeReturnTo(returnTo))`.

---

### 9.3 Home Page

| | |
|--|--|
| File | `src/app/(main)/page.tsx` |
| Type | Client Component |
| Route | `/` |
| Auth | Not required |

Purpose: Landing page with hero section, backend health check (`GET /api/health`), feature overview cards, theme switcher.
State: `loading`, `healthData`, `error` via `useState` + `useEffect`.

---

### 9.4 My Collections

| | |
|--|--|
| File | `src/app/(main)/me/collections/page.tsx` |
| Type | Client Component |
| Route | `/me/collections` |
| Auth | Required |

Purpose: List all user collections (owned + shared). Create/edit/delete owned collections.
Data: `GET /api/me/collections`. Mutations: `DELETE /api/me/collections/:id`.
Components: `CollectionCard`, `CollectionFormModal`.

---

### 9.5 Collection Detail

| | |
|--|--|
| File | `src/app/(main)/me/collections/[id]/page.tsx` |
| Type | Client Component |
| Route | `/me/collections/:id` |
| Auth | Required |

Purpose: View links, add/edit/delete links, publish/unpublish to marketplace, manage invites and members.
Data: `GET /api/me/collections/:id` + `GET /api/me/collections/:id/links`.
Hook: `useCollectionAccess(id)` → derives `canEdit` and `canManage` booleans.
Components: `LinkCard`, `LinkFormModal`, `InviteManagePanel`, `MemberList`, `CollectionAvatar`.

---

### 9.6 Marketplace

| | |
|--|--|
| File | `src/app/(main)/marketplace/page.tsx` |
| Type | Server Component (initial) + Client Component (interactions) |
| Route | `/marketplace` |
| Auth | Not required |

Purpose: Paginated marketplace browser with search. SEO-friendly server-rendered initial content.
Server data: Direct Drizzle query — no HTTP roundtrip.
Components: `MarketplaceCard`, `SearchBar`.

---

### 9.7 Marketplace Detail

| | |
|--|--|
| File | `src/app/(main)/marketplace/[listingId]/page.tsx` |
| Type | Server Component + Client interactive section |
| Route | `/marketplace/:listingId` |
| Auth | Not required to view; required to subscribe/fork |

Purpose: View listing with all links. Subscribe/unsubscribe. Fork to own collections.
Server data: Direct Drizzle query.
`generateMetadata()`: Dynamic `<title>` and Open Graph tags.

---

### 9.8 Family Todo Spaces

| | |
|--|--|
| File | `src/app/(main)/family-todo/page.tsx` |
| Type | Client Component |
| Route | `/family-todo` |
| Auth | Required |

Purpose: List all spaces the user belongs to. Create/edit/delete spaces.
Data: `GET /api/family-todo/spaces`.

---

### 9.9 Family Todo Board

| | |
|--|--|
| File | `src/app/(main)/family-todo/spaces/[sid]/page.tsx` |
| Type | Client Component (DnD requires client) |
| Route | `/family-todo/spaces/:sid` |
| Auth | Required (MEMBER+) |

Purpose: Full Kanban board with drag-and-drop. Optimistic updates with rollback on error.
Data: `GET /api/family-todo/spaces/:sid/board`.
Role-aware: `canManageLists = role === 'owner' || role === 'admin'`.
Components: `TodoBoard`, `TodoFormModal`.

---

### 9.10 Collection Invite Join

| | |
|--|--|
| File | `src/app/(main)/invite/[token]/page.tsx` |
| Type | Client Component |
| Route | `/invite/:token` |
| Auth | Public (requires login to join) |

Purpose: Display invite metadata. Allow authenticated user to join.
Data: `GET /api/invites/:token`.
Mutation: `POST /api/invites/:token/join` → navigate to `/me/collections/:id`.
Unauthenticated: Show "Login to join" button linking to `/login?returnTo=/invite/:token`.

---

### 9.11 Family Todo Invite Join

| | |
|--|--|
| File | `src/app/(main)/family-todo/invite/[token]/page.tsx` |
| Type | Client Component |
| Route | `/family-todo/invite/:token` |
| Auth | Public (requires login to join) |

Purpose: Display Family Todo invite metadata. Allow authenticated user to join the space.
Data: `GET /api/family-todo/invites/:token`.
Mutation: `POST /api/family-todo/invites/:token/join` → navigate to `/family-todo/spaces/:sid`.
Unauthenticated: Show "Login to join" button linking to `/login?returnTo=/family-todo/invite/:token`.

---

## 10. Components Reference

### `CollectionCard`
```typescript
{ collection: Collection, onEdit: () => void, onDelete: () => void }
```
Shows title, icon/avatar, link count, visibility badge. "Shared" badge when `access !== 'owner'`. Edit/delete visible to owner only.

### `CollectionFormModal`
```typescript
{ collection?: Collection, onClose: () => void, onSuccess: (c: Collection) => void }
```
Create (POST) or edit (PATCH). Fields: `title` (required), `description`, `icon` (emoji hint).

### `LinkCard`
```typescript
{ link: Link, onEdit: () => void, onDelete: () => void, readOnly?: boolean }
```
Displays link with external `href` (`rel="noopener noreferrer"`). Edit/delete hidden when `readOnly`.

### `LinkFormModal`
```typescript
{ collectionId: number, link?: Link, onClose: () => void, onSuccess: (l: Link) => void }
```
Create or edit a link. Fields: `title` (required), `url` (required), `description`.

### `InviteManagePanel`
```typescript
{ collectionId: number }
```
Lists invite links with usage stats. Create new invite (role, maxUses, expiresInHours). Copy URL. Delete links.

### `MemberList`
```typescript
{ collectionId: number }
```
Lists members with avatar, name, role. Remove button for non-owners (visible to owner only).

### `MarketplaceCard`
```typescript
{ listing: MarketplaceListing }
```
Shows collection avatar, title, description, publisher name (or "Anonymous" when `publisher === null`), subscriber/fork counts.

### `SearchBar`
```typescript
{ value: string, placeholder?: string, onChange: (v: string) => void, onSearch: () => void }
```
Text input + search button. Calls `onSearch` on Enter or button click.

### `ToastHost`
Props: none. `'use client'` component. Listens for `CustomEvent('push-toast')` on `window`.
Event detail: `{ message: string, type: 'success' | 'error' | 'info' }`.

```typescript
// src/lib/toast.ts
export function pushToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  window.dispatchEvent(new CustomEvent('push-toast', { detail: { message, type } }))
}
```

### `CollectionAvatar` (ui/)
```typescript
{ title: string, className?: string }
```
First character of `title` in a styled circle.

### `Glyphs` (ui/)
SVG icons, all accept `{ className?: string }`:
`CollectionGlyph`, `MarketplaceGlyph`, `TodoGlyph`, `SearchGlyph`, `UsersGlyph`, `ForkGlyph`, `ArrowRightGlyph`, `SparkGlyph`

### `TodoBoard`
```typescript
{
  lists: TodoListWithItems[]
  canManageLists: boolean
  onReorderLists: (ids: number[]) => void
  onReorderTodos: (listId: number, ids: number[]) => void
  onMoveTodo: (todoId: number, targetListId: number) => void
  onAddTodo: (listId: number, data: CreateTodoData) => void
  onAddList: (title: string) => void
  onEditTodo: (todo: TodoResponse) => void
  onToggleTodo: (todoId: number, completed: boolean) => void
  onDeleteList: (listId: number) => void
  onUpdateListTitle: (listId: number, title: string) => void
}
```
`'use client'` required. `@dnd-kit/core` `DndContext` wraps entire board. Handles list reorder, todo reorder within column, cross-column todo move.

### `TodoColumn`
```typescript
{
  list: TodoListWithItems
  canManageLists: boolean
  onAddTodo: (data: CreateTodoData) => void
  onEditTodo: (todo: TodoResponse) => void
  onToggleTodo: (todoId: number, completed: boolean) => void
  onDeleteList: () => void
  onUpdateListTitle: (title: string) => void
}
```
Sortable + droppable column. Inline title editing. Add/delete buttons.

### `TodoCard`
```typescript
{ todo: TodoResponse, onToggle: (completed: boolean) => void, onEdit: () => void }
```
Sortable draggable card. Checkbox, priority badge, due date, assignee avatar.

### `TodoFormModal`
```typescript
{ todo?: TodoResponse, onClose: () => void, onSave: (data) => void, onDelete?: () => void }
```
Create or edit. Fields: `title` (required), `description`, `priority` (select), `dueDate`, `assignedTo` (user ID). Delete button visible in edit mode.

### `AddListButton`
```typescript
{ onAdd: (title: string) => void }
```
Expands inline to text input on click. Submits on Enter or blur.

---

## 11. Styling System

### Tailwind CSS v4 with PostCSS

```js
// postcss.config.mjs
export default {
  plugins: { '@tailwindcss/postcss': {} },
}
```

No `tailwind.config.js` needed for v4.

### CSS Custom Properties — 3 Themes

Applied via `html[data-theme='light|dark|eye']` attribute in `src/app/globals.css`.

#### Light Theme (default)

```css
html[data-theme='light'] {
  --bg:             #f7f4ee;
  --bg-elevated:    #fdfbf7;
  --text:           #403b35;
  --muted:          #756d65;
  --accent:         #7c9a86;
  --accent-hover:   #6b8875;
  --accent-strong:  #516558;
  --accent-soft:    #edf3ee;
  --cta:            #d49a6a;
  --cta-hover:      #bf8250;
  --surface:        rgba(255, 252, 247, 0.86);
  --surface-strong: #fffdfa;
  --border:         rgba(182, 173, 160, 0.28);
  --border-strong:  rgba(145, 171, 153, 0.55);
}
```

#### Dark Theme

```css
html[data-theme='dark'] {
  --bg:             #262421;
  --bg-elevated:    #312f2b;
  --text:           #f5f0e8;
  --muted:          #c3b8aa;
  --accent:         #9ab5a2;
  --accent-hover:   #acc2b2;
  --accent-strong:  #eef5ef;
  --accent-soft:    rgba(154, 181, 162, 0.14);
  --cta:            #e2a36f;
  --cta-hover:      #ce8e58;
  --surface:        rgba(56, 53, 48, 0.86);
  --surface-strong: #403d39;
  --border:         rgba(201, 187, 167, 0.14);
  --border-strong:  rgba(151, 179, 159, 0.45);
}
```

#### Eye / Mint Theme

```css
html[data-theme='eye'] {
  --bg:             #eef6f1;
  --bg-elevated:    #f7fcf8;
  --text:           #35443a;
  --muted:          #65746a;
  --accent:         #7ca382;
  --accent-hover:   #698f70;
  --accent-strong:  #47604b;
  --accent-soft:    #e7f2e9;
  --cta:            #d9a56f;
  --cta-hover:      #c48953;
  --surface:        rgba(248, 253, 250, 0.88);
  --surface-strong: #fcfffd;
  --border:         rgba(153, 176, 162, 0.28);
  --border-strong:  rgba(114, 156, 126, 0.5);
}
```

#### Font Tokens

```css
:root {
  --font-sans:    'Zen Kaku Gothic New', 'Segoe UI', 'Noto Sans TC', sans-serif;
  --font-heading: 'M PLUS Rounded 1c', 'Zen Kaku Gothic New', sans-serif;
}
```

#### Google Fonts via `next/font`

Load fonts through `next/font/google` in the root layout — **do not use CSS `@import`**:

| Font | Weights | Usage |
|------|---------|-------|
| M PLUS Rounded 1c | 400, 500, 700, 800 | Headings (`--font-heading`) |
| Zen Kaku Gothic New | 400, 500, 700 | Body text (`--font-sans`) |

#### Body Background Gradient

```css
body {
  background-image:
    radial-gradient(circle at top left,  rgba(124, 154, 134, 0.10), transparent 26%),
    radial-gradient(circle at top right, rgba(212, 154, 106, 0.08), transparent 22%),
    linear-gradient(180deg, var(--bg-elevated), var(--bg));
}
```

### Theme System (`src/lib/theme.ts`)

```typescript
export const THEMES = ['dark', 'light', 'eye'] as const
export type Theme = typeof THEMES[number]
export const DEFAULT_THEME: Theme = 'light'
const STORAGE_KEY = 'hker-theme'

let currentTheme: Theme = DEFAULT_THEME
const listeners = new Set<() => void>()

export function setTheme(theme: Theme) {
  currentTheme = theme
  if (typeof window !== 'undefined') {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(STORAGE_KEY, theme) } catch {}
  }
  listeners.forEach(fn => fn())
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb) },
    () => currentTheme,
    () => DEFAULT_THEME,  // server snapshot
  )
  return [theme, setTheme]
}
```

### Theme Anti-Flicker

Add to `<head>` in `src/app/layout.tsx`:

```tsx
<script
  dangerouslySetInnerHTML={{
    __html: `try{document.documentElement.dataset.theme=localStorage.getItem('hker-theme')||'light'}catch(e){}`,
  }}
/>
```

Add `suppressHydrationWarning` to `<html>`:

```tsx
<html lang="zh-HK" suppressHydrationWarning>
```

---

## 12. Internationalization

### Setup (`src/i18n/index.ts`)

```typescript
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zhHK from './locales/zh-HK.json'
import en from './locales/en.json'

const storedLanguage = (() => {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem('lang') } catch { return null }
})()

i18n.use(initReactI18next).init({
  resources: { 'zh-HK': { translation: zhHK }, en: { translation: en } },
  lng: storedLanguage ?? 'zh-HK',
  fallbackLng: 'zh-HK',
  interpolation: { escapeValue: false },
})

export default i18n
```

**Important**: Import i18n only inside `src/components/providers.tsx` (`'use client'`). Never import in Server Components.

### Language Switcher

```typescript
function changeLanguage(lang: 'zh-HK' | 'en') {
  i18n.changeLanguage(lang)
  try { localStorage.setItem('lang', lang) } catch {}
}
```

### `zh-HK.json` (complete)

```json
{
  "nav": {
    "myCollections": "我的收藏",
    "marketplace": "市集",
    "familyTodo": "家庭待辦"
  },
  "collections": {
    "title": "我的收藏",
    "create": "新增收藏",
    "empty": "尚未有收藏，立即建立一個！",
    "delete_confirm": "確定要刪除「{{title}}」？",
    "count": "{{count}} 個收藏",
    "shared": "共享",
    "linksCount": "{{count}} 個連結",
    "addLink": "新增連結",
    "linksTitle": "連結",
    "linksEmpty": "尚未有連結，立即新增一個！",
    "link_delete_confirm": "確定要刪除此連結？",
    "marketplace": {
      "title": "市集",
      "subtitle": "將此收藏公開給其他人探索",
      "anonymous": "隱藏發布者資料",
      "publish": "發布",
      "publishing": "發布中...",
      "unpublish": "取消發布",
      "unpublishing": "取消發布中...",
      "confirmUnpublish": "確定要取消發布？",
      "publishSuccess": "已發布至市集",
      "unpublishSuccess": "已取消發布",
      "publishError": "發布失敗",
      "unpublishError": "取消發布失敗"
    },
    "notFound": "找不到收藏",
    "errors": {
      "load": "載入收藏失敗",
      "delete": "刪除收藏失敗",
      "save": "儲存收藏失敗，請重試",
      "requiredTitle": "標題為必填"
    },
    "form": {
      "createTitle": "新增收藏",
      "editTitle": "編輯收藏",
      "iconHint": "可以使用 emoji (例如：📚, 🎨, 🛠)",
      "fields": {
        "title": "標題",
        "description": "描述",
        "icon": "圖示"
      }
    }
  },
  "marketplace": {
    "title": "市集",
    "links": "連結",
    "anonymous": "匿名",
    "search": "搜尋收藏...",
    "subscribe": "訂閱",
    "unsubscribe": "取消訂閱",
    "fork": "複製到我的收藏",
    "fork_confirm": "確定要複製這個收藏嗎？",
    "description": "探索公開收藏，訂閱更新或 Fork 你的版本。",
    "empty": "目前沒有符合的收藏",
    "notFound": "找不到該收藏",
    "errors": {
      "load": "載入市集失敗",
      "loadDetail": "載入收藏詳情失敗",
      "loadSubscriptions": "載入訂閱資訊失敗",
      "toggleSubscribe": "更新訂閱狀態失敗",
      "fork": "複製收藏失敗"
    }
  },
  "familyTodo": {
    "spacesCount": "{{count}} 個 spaces",
    "createSpace": "新增 Space",
    "editSpace": "編輯 Space",
    "newSpace": "新增 Space",
    "spaceName": "名稱",
    "empty": "尚未有 space，立即建立一個！",
    "role": "角色：{{role}}",
    "enterBoard": "進入看板 →",
    "backSpaces": "← 返回 spaces",
    "invalidSpaceId": "無效的 space id",
    "deleteSpaceConfirm": "確定要刪除此 space？",
    "errors": {
      "saveSpace": "儲存 space 失敗",
      "deleteSpace": "刪除失敗",
      "loadSpaces": "載入 space 失敗"
    }
  },
  "todo": {
    "board": "看板",
    "assignee": "指派給",
    "addTodo": "新增待辦",
    "addList": "新增列表",
    "dragOrAdd": "拖曳或新增待辦",
    "editListTitle": "列表標題",
    "priority": {
      "low": "低",
      "medium": "中",
      "high": "高",
      "urgent": "緊急"
    },
    "editTodo": "編輯待辦",
    "createTodo": "新增待辦",
    "delete_confirm": "確定要刪除此待辦？",
    "labels": {
      "title": "標題",
      "description": "描述",
      "priority": "優先度",
      "dueDate": "到期日",
      "assignTo": "指派給（User ID）",
      "save": "儲存",
      "cancel": "取消",
      "delete": "刪除"
    },
    "deleteListConfirm": "確定要刪除此列表？",
    "errors": {
      "loadBoard": "載入看板失敗",
      "addList": "新增列表失敗",
      "updateList": "更新列表失敗",
      "deleteList": "刪除列表失敗",
      "saveTodo": "儲存待辦失敗",
      "deleteTodo": "刪除待辦失敗",
      "toggleTodo": "更新待辦狀態失敗",
      "reorderLists": "列表重排失敗",
      "reorderTodos": "待辦重排失敗",
      "moveTodo": "移動待辦失敗"
    }
  },
  "common": {
    "save": "儲存",
    "cancel": "取消",
    "delete": "刪除",
    "edit": "編輯",
    "search": "搜尋",
    "loading": "載入中...",
    "saving": "儲存中...",
    "update": "更新",
    "create": "新增",
    "back": "← 返回",
    "backTo": "← 返回 {{target}}",
    "previous": "上一頁",
    "next": "下一頁",
    "page": "第 {{current}} / {{total}} 頁",
    "loadFailed": "載入失敗",
    "anonymous": "匿名",
    "login": "登入",
    "logout": "登出",
    "signingIn": "正在登入...",
    "signInFailed": "登入失敗，請再試一次。",
    "language": "語言",
    "languageZh": "繁體中文",
    "languageEn": "English"
  },
  "theme": {
    "dark": "黑",
    "light": "白",
    "eye": "淡綠"
  },
  "home": {
    "brand": "HKER",
    "title": "系統主題切換器",
    "loadingHealth": "載入健康檢查中...",
    "healthFailed": "健康檢查失敗：{{error}}",
    "errors": {
      "loadHealth": "載入健康檢查失敗"
    }
  },
  "links": {
    "create": "新增連結",
    "edit": "編輯連結",
    "fields": {
      "title": "標題",
      "url": "URL",
      "description": "描述"
    },
    "errors": {
      "required": "標題和 URL 為必填",
      "save": "儲存連結失敗，請重試",
      "delete": "刪除連結失敗"
    }
  },
  "invites": {
    "title": "Invite Links",
    "subtitle": "建立分享連結給協作者",
    "roleLabel": "角色",
    "role": {
      "viewer": "Viewer",
      "editor": "Editor"
    },
    "maxUsesLabel": "最大使用次數",
    "maxUsesPlaceholder": "不限",
    "expiresLabel": "有效時數",
    "expiresPlaceholder": "永不過期",
    "create": "建立 Invite Link",
    "loading": "載入中...",
    "empty": "目前沒有 invite links",
    "unlimited": "∞",
    "usage": "{{role}} · 使用 {{useCount}}/{{maxUses}}",
    "copy": "複製",
    "delete": "刪除",
    "confirmDelete": "確定要刪除此 invite link？",
    "copySuccess": "Invite link 已複製。",
    "errors": {
      "load": "載入 invite links 失敗",
      "create": "建立 invite link 失敗",
      "delete": "刪除 invite link 失敗",
      "copy": "複製 invite link 失敗",
      "maxUses": "最大使用次數需在 1 至 10000 之間",
      "expires": "有效時數需在 1 至 8760 之間"
    }
  },
  "members": {
    "title": "Members",
    "subtitle": "管理協作者",
    "loading": "載入中...",
    "empty": "目前沒有成員",
    "remove": "移除",
    "confirmRemove": "確定要移除此成員？",
    "userFallback": "User {{id}}",
    "errors": {
      "load": "載入成員失敗",
      "remove": "移除成員失敗"
    }
  },
  "inviteJoin": {
    "title": "Join Collection Invite",
    "subtitle": "你被邀請加入：{{title}}",
    "invalid": "此邀請連結無效或已超過使用次數上限。",
    "joinNow": "立即加入",
    "loginToJoin": "登入以加入",
    "loading": "載入中...",
    "notFound": "找不到邀請連結",
    "errors": {
      "load": "載入邀請失敗",
      "join": "加入邀請失敗",
      "forbidden": "你沒有權限加入此邀請"
    }
  },
  "familyTodoInviteJoin": {
    "title": "Join Space Invite",
    "subtitle": "你被邀請加入 space：{{title}}",
    "invalid": "此 space 邀請連結無效或已超過使用次數上限。",
    "joinNow": "立即加入 space",
    "loginToJoin": "登入以加入",
    "loading": "載入中...",
    "notFound": "找不到邀請連結",
    "errors": {
      "load": "載入 space 邀請失敗",
      "join": "加入 space 失敗",
      "forbidden": "你沒有權限加入此 space 邀請"
    }
  },
  "auth": {
    "loginTitle": "登入 HKER",
    "registerTitle": "建立 HKER 帳號",
    "email": "Email",
    "password": "密碼",
    "displayName": "顯示名稱",
    "submitLogin": "登入",
    "submitRegister": "建立帳號",
    "loginSuccess": "登入成功",
    "registerSuccess": "帳號建立成功",
    "errors": {
      "emailRequired": "Email 為必填",
      "passwordRequired": "密碼為必填",
      "passwordLength": "密碼長度需介於 8 到 128 字元",
      "invalidCredentials": "Email 或密碼錯誤",
      "emailTaken": "此 Email 已被使用",
      "register": "建立帳號失敗",
      "login": "登入失敗"
    }
  }
}
```

### `en.json` (complete)

```json
{
  "nav": {
    "myCollections": "My Collections",
    "marketplace": "Marketplace",
    "familyTodo": "Family Todo"
  },
  "collections": {
    "title": "My Collections",
    "create": "New Collection",
    "empty": "No collections yet — create your first one!",
    "delete_confirm": "Are you sure you want to delete \"{{title}}\"?",
    "count": "{{count}} collections",
    "shared": "Shared",
    "linksCount": "{{count}} links",
    "addLink": "Add Link",
    "linksTitle": "Links",
    "linksEmpty": "No links yet — add your first one!",
    "link_delete_confirm": "Are you sure you want to delete this link?",
    "marketplace": {
      "title": "Marketplace",
      "subtitle": "Make this collection publicly discoverable",
      "anonymous": "Publish anonymously",
      "publish": "Publish",
      "publishing": "Publishing...",
      "unpublish": "Unpublish",
      "unpublishing": "Unpublishing...",
      "confirmUnpublish": "Are you sure you want to unpublish?",
      "publishSuccess": "Published to marketplace",
      "unpublishSuccess": "Unpublished successfully",
      "publishError": "Failed to publish",
      "unpublishError": "Failed to unpublish"
    },
    "notFound": "Collection not found",
    "errors": {
      "load": "Failed to load collections",
      "delete": "Failed to delete collection",
      "save": "Failed to save collection, please try again",
      "requiredTitle": "Title is required"
    },
    "form": {
      "createTitle": "New Collection",
      "editTitle": "Edit Collection",
      "iconHint": "You can use an emoji (e.g. 📚, 🎨, 🛠)",
      "fields": {
        "title": "Title",
        "description": "Description",
        "icon": "Icon"
      }
    }
  },
  "marketplace": {
    "title": "Marketplace",
    "links": "links",
    "anonymous": "Anonymous",
    "search": "Search collections...",
    "subscribe": "Subscribe",
    "unsubscribe": "Unsubscribe",
    "fork": "Fork to My Collections",
    "fork_confirm": "Are you sure you want to fork this collection?",
    "description": "Explore public collections, subscribe for updates or fork your own version.",
    "empty": "No collections found",
    "notFound": "Collection not found",
    "errors": {
      "load": "Failed to load marketplace",
      "loadDetail": "Failed to load collection details",
      "loadSubscriptions": "Failed to load subscriptions",
      "toggleSubscribe": "Failed to update subscription",
      "fork": "Failed to fork collection"
    }
  },
  "familyTodo": {
    "spacesCount": "{{count}} spaces",
    "createSpace": "New Space",
    "editSpace": "Edit Space",
    "newSpace": "New Space",
    "spaceName": "Name",
    "empty": "No spaces yet — create your first one!",
    "role": "Role: {{role}}",
    "enterBoard": "Enter Board →",
    "backSpaces": "← Back to spaces",
    "invalidSpaceId": "Invalid space ID",
    "deleteSpaceConfirm": "Are you sure you want to delete this space?",
    "errors": {
      "saveSpace": "Failed to save space",
      "deleteSpace": "Failed to delete",
      "loadSpaces": "Failed to load spaces"
    }
  },
  "todo": {
    "board": "Board",
    "assignee": "Assigned to",
    "addTodo": "Add Todo",
    "addList": "Add List",
    "dragOrAdd": "Drag or add todos",
    "editListTitle": "List title",
    "priority": {
      "low": "Low",
      "medium": "Medium",
      "high": "High",
      "urgent": "Urgent"
    },
    "editTodo": "Edit Todo",
    "createTodo": "New Todo",
    "delete_confirm": "Are you sure you want to delete this todo?",
    "labels": {
      "title": "Title",
      "description": "Description",
      "priority": "Priority",
      "dueDate": "Due Date",
      "assignTo": "Assign to (User ID)",
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete"
    },
    "deleteListConfirm": "Are you sure you want to delete this list?",
    "errors": {
      "loadBoard": "Failed to load board",
      "addList": "Failed to add list",
      "updateList": "Failed to update list",
      "deleteList": "Failed to delete list",
      "saveTodo": "Failed to save todo",
      "deleteTodo": "Failed to delete todo",
      "toggleTodo": "Failed to update todo status",
      "reorderLists": "Failed to reorder lists",
      "reorderTodos": "Failed to reorder todos",
      "moveTodo": "Failed to move todo"
    }
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search",
    "loading": "Loading...",
    "saving": "Saving...",
    "update": "Update",
    "create": "Create",
    "back": "← Back",
    "backTo": "← Back to {{target}}",
    "previous": "Previous",
    "next": "Next",
    "page": "Page {{current}} of {{total}}",
    "loadFailed": "Failed to load",
    "anonymous": "Anonymous",
    "login": "Log In",
    "logout": "Log Out",
    "signingIn": "Signing in...",
    "signInFailed": "Sign-in failed, please try again.",
    "language": "Language",
    "languageZh": "繁體中文",
    "languageEn": "English"
  },
  "theme": {
    "dark": "Dark",
    "light": "Light",
    "eye": "Mint"
  },
  "home": {
    "brand": "HKER",
    "title": "Theme Switcher",
    "loadingHealth": "Loading health check...",
    "healthFailed": "Health check failed: {{error}}",
    "errors": {
      "loadHealth": "Failed to load health check"
    }
  },
  "links": {
    "create": "Add Link",
    "edit": "Edit Link",
    "fields": {
      "title": "Title",
      "url": "URL",
      "description": "Description"
    },
    "errors": {
      "required": "Title and URL are required",
      "save": "Failed to save link, please try again",
      "delete": "Failed to delete link"
    }
  },
  "invites": {
    "title": "Invite Links",
    "subtitle": "Create share links for collaborators",
    "roleLabel": "Role",
    "role": {
      "viewer": "Viewer",
      "editor": "Editor"
    },
    "maxUsesLabel": "Max Uses",
    "maxUsesPlaceholder": "Unlimited",
    "expiresLabel": "Expires in hours",
    "expiresPlaceholder": "Never",
    "create": "Create Invite Link",
    "loading": "Loading...",
    "empty": "No invite links yet",
    "unlimited": "∞",
    "usage": "{{role}} · Used {{useCount}}/{{maxUses}}",
    "copy": "Copy",
    "delete": "Delete",
    "confirmDelete": "Are you sure you want to delete this invite link?",
    "copySuccess": "Invite link copied.",
    "errors": {
      "load": "Failed to load invite links",
      "create": "Failed to create invite link",
      "delete": "Failed to delete invite link",
      "copy": "Failed to copy invite link",
      "maxUses": "Max uses must be between 1 and 10000",
      "expires": "Expiry hours must be between 1 and 8760"
    }
  },
  "members": {
    "title": "Members",
    "subtitle": "Manage collaborators",
    "loading": "Loading...",
    "empty": "No members yet",
    "remove": "Remove",
    "confirmRemove": "Are you sure you want to remove this member?",
    "userFallback": "User {{id}}",
    "errors": {
      "load": "Failed to load members",
      "remove": "Failed to remove member"
    }
  },
  "inviteJoin": {
    "title": "Join Collection Invite",
    "subtitle": "You've been invited to join: {{title}}",
    "invalid": "This invite link is invalid or has reached its usage limit.",
    "joinNow": "Join Now",
    "loginToJoin": "Log in to join",
    "loading": "Loading...",
    "notFound": "Invite link not found",
    "errors": {
      "load": "Failed to load invite",
      "join": "Failed to join invite",
      "forbidden": "You don't have permission to join this invite"
    }
  },
  "familyTodoInviteJoin": {
    "title": "Join Space Invite",
    "subtitle": "You've been invited to join the space: {{title}}",
    "invalid": "This space invite link is invalid or has reached its usage limit.",
    "joinNow": "Join Space",
    "loginToJoin": "Log in to join",
    "loading": "Loading...",
    "notFound": "Invite link not found",
    "errors": {
      "load": "Failed to load space invite",
      "join": "Failed to join space invite",
      "forbidden": "You don't have permission to join this space invite"
    }
  },
  "auth": {
    "loginTitle": "Log in to HKER",
    "registerTitle": "Create your HKER account",
    "email": "Email",
    "password": "Password",
    "displayName": "Display Name",
    "submitLogin": "Log In",
    "submitRegister": "Create Account",
    "loginSuccess": "Logged in successfully",
    "registerSuccess": "Account created successfully",
    "errors": {
      "emailRequired": "Email is required",
      "passwordRequired": "Password is required",
      "passwordLength": "Password must be between 8 and 128 characters",
      "invalidCredentials": "Incorrect email or password",
      "emailTaken": "This email is already in use",
      "register": "Failed to create account",
      "login": "Failed to log in"
    }
  }
}
```

---

## 13. Environment Variables

```bash
# .env.example

# ─── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app

# ─── App ─────────────────────────────────────────────────────────────────────
APP_BASE_URL=http://localhost:3000

# ─── Auth ────────────────────────────────────────────────────────────────────
# 32+ random bytes, shared by all app instances
AUTH_SESSION_SECRET=replace-with-long-random-secret
AUTH_SESSION_COOKIE_NAME=hker_session
AUTH_SESSION_TTL_DAYS=30

# ─── Security ────────────────────────────────────────────────────────────────
# Comma-separated trusted proxy IPs for X-Forwarded-For handling.
# Leave empty to disable X-Forwarded-For entirely.
TRUSTED_PROXIES=

# ─── Future SSO (not used in alpha/beta) ────────────────────────────────────
# Add provider-specific variables later when SSO is introduced.
# Example:
# OIDC_CLIENT_ID=
# OIDC_CLIENT_SECRET=
# OIDC_ISSUER=

# ─── Docker Compose ──────────────────────────────────────────────────────────
POSTGRES_DB=app
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

### Variable Reference

| Variable | Required | Client-exposed | Description |
|----------|----------|----------------|-------------|
| `DATABASE_URL` | Yes | No | PostgreSQL connection string |
| `APP_BASE_URL` | Yes | No | Absolute app URL used to build invite links and future auth callbacks |
| `AUTH_SESSION_SECRET` | Yes | No | HMAC secret used when hashing session tokens before persistence |
| `AUTH_SESSION_COOKIE_NAME` | Optional | No | Cookie name; defaults to `hker_session` |
| `AUTH_SESSION_TTL_DAYS` | Optional | No | Session lifetime; defaults to 30 days |
| `TRUSTED_PROXIES` | Optional | No | Comma-separated trusted proxy IPs |

---

## 14. Docker and Deployment

### `next.config.ts`

```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
}

export default config
```

### `Dockerfile`

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
```

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB:       ${POSTGRES_DB:-app}
      POSTGRES_USER:     ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-postgres}@db:5432/${POSTGRES_DB:-app}
      APP_BASE_URL: ${APP_BASE_URL:-http://localhost:3000}
      AUTH_SESSION_SECRET: ${AUTH_SESSION_SECRET}
      AUTH_SESSION_COOKIE_NAME: ${AUTH_SESSION_COOKIE_NAME:-hker_session}
      AUTH_SESSION_TTL_DAYS: ${AUTH_SESSION_TTL_DAYS:-30}
      TRUSTED_PROXIES: ${TRUSTED_PROXIES}

volumes:
  pgdata:
```

### `captain-definition`

```json
{
  "schemaVersion": 2,
  "dockerfilePath": "./Dockerfile"
}
```

### Deployment Notes

- No auth configuration is baked into the client bundle. All auth-related configuration stays server-side.
- Run `npm run db:migrate` in a release step or one-off admin job before starting the app in production.
- Set `APP_BASE_URL` correctly in each environment so invite URLs and future SSO callbacks resolve to the right host.
- CapRover: push via `caprover deploy` or GitHub Actions webhook.

---

## 15. `package.json` Dependencies

```json
{
  "name": "hker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev":         "next dev",
    "build":       "next build",
    "start":       "next start",
    "lint":        "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate":  "drizzle-kit migrate",
    "db:push":     "drizzle-kit push",
    "db:studio":   "drizzle-kit studio"
  },
  "dependencies": {
    "next":           "^15.0.0",
    "react":          "^19.0.0",
    "react-dom":      "^19.0.0",
    "drizzle-orm":    "^0.38.0",
    "postgres":       "^3.4.0",
    "i18next":        "^25.0.0",
    "react-i18next":  "^16.0.0",
    "@dnd-kit/core":      "^6.3.1",
    "@dnd-kit/sortable":  "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2"
  },
  "devDependencies": {
    "typescript":           "^5.8.0",
    "@types/node":          "^22.0.0",
    "@types/react":         "^19.0.0",
    "@types/react-dom":     "^19.0.0",
    "drizzle-kit":          "^0.30.0",
    "tailwindcss":          "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "eslint":               "^9.0.0",
    "eslint-config-next":   "^15.0.0"
  }
}
```

---

## 16. `drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit'

export default {
  schema:      './src/db/schema/*',
  out:         './drizzle',
  dialect:     'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

---

## 17. Implementation Phases

### Phase 1 — Scaffolding & Infrastructure (sequential)

| Step | Task |
|------|------|
| 1.1 | Init Next.js: `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir`, restructure to `src/` layout |
| 1.2 | Configure `next.config.ts` with `output: 'standalone'` |
| 1.3 | Set up Drizzle: install packages, create all 6 schema files, `drizzle.config.ts`, run `npm run db:generate` |
| 1.4 | Configure Tailwind CSS v4: `postcss.config.mjs`, CSS custom properties (3 themes) in `globals.css`, Google Fonts via `next/font` |
| 1.5 | Set up auth foundation: `users`, `auth_identities`, `auth_sessions`, `src/lib/auth.tsx`, `src/server/auth.ts`, password hashing helpers, session cookie helpers |
| 1.6 | Set up i18n: `src/i18n/index.ts` + locale files |
| 1.7 | Shared utilities: `types.ts`, `errors.ts`, `toast.ts`, `api-client.ts`, `theme.ts` |
| 1.8 | `src/components/providers.tsx` + wire `src/app/layout.tsx` with anti-flicker inline script + `<Providers>` |

### Phase 2 — Server-Side API Layer

Steps 2.1–2.4 block all route work. Steps 2.5–2.9 are parallel.

| Step | Task | Dependencies |
|------|------|-------------|
| 2.1 | Drizzle DB singleton + auth/user/session services | Phase 1 |
| 2.2 | Auth API routes: `/api/auth/session`, `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | 2.1 |
| 2.3 | Permission service: `requireAtLeast()`, `requireSpaceAtLeast()` | 2.1 |
| 2.4 | API helpers: `withAuth()`, `withOptionalAuth()`, error helpers, rate limiting | 2.1, 2.2, 2.3 |
| 2.5 | [PARALLEL] Collection API routes (6 endpoints) | 2.4 |
| 2.6 | [PARALLEL] Link API routes (5 endpoints + SSRF protection) | 2.5 |
| 2.7 | [PARALLEL] Invite & Member API routes (7 collection endpoints + family todo invite read/join) | 2.5 |
| 2.8 | [PARALLEL] Marketplace API routes (8 endpoints, denormalized counters) | 2.4 |
| 2.9 | [PARALLEL] Family Todo API routes (core space/list/todo/member endpoints) | 2.4 |
| 2.10 | Health endpoint | 2.4 |

### Phase 3 — Frontend Pages & Components (parallel with Phase 2)

Step 3.1 blocks 3.2–3.6. Steps 3.2–3.6 are parallel.

| Step | Task | Dependencies |
|------|------|-------------|
| 3.1 | `(main)/layout.tsx` (nav, theme/lang switcher) + `Glyphs`, `CollectionAvatar`, `ToastHost` | Phase 1 |
| 3.2 | [PARALLEL] Home page | 3.1 |
| 3.3 | [PARALLEL] Collections pages + all collection components + `useCollectionAccess` | 3.1, Phase 2 |
| 3.4 | [PARALLEL] Marketplace pages (Server Components + client sections + `generateMetadata`) | 3.1, Phase 2 |
| 3.5 | [PARALLEL] Family Todo pages + all todo components (`TodoBoard`, `TodoColumn`, `TodoCard`, `TodoFormModal`, `AddListButton`) | 3.1, Phase 2 |
| 3.6 | [PARALLEL] Auth pages: `/login`, `/register`, `/invite/[token]`, `/family-todo/invite/[token]` | 3.1, Phase 2 |

### Phase 4 — Infrastructure & Deployment (after Phases 2 + 3)

1. Write `Dockerfile` (multi-stage, standalone)
2. Write `captain-definition`
3. Finalise `docker-compose.yml`
4. Write `.env.example`
5. Update developer documentation

### Phase 5 — Verification & Cutover

| Check | Description |
|-------|-------------|
| Build | `npm run build` — zero TypeScript errors |
| Docker | `docker compose up` — app starts and DB connects; migration step documented separately |
| API smoke test | All specified endpoints return expected shapes |
| SSR check | `curl https://example.com/marketplace` shows HTML with collection content |
| Auth flow | Register → logout → login → protected API call via session cookie |
| Page render | All documented pages render without console errors |
| DnD | Kanban drag works: list reorder, todo reorder, cross-list move |
| Invite flow | Collection invite and Family Todo invite both support public metadata view → login redirect → join → member appears |
| Fork flow | Fork marketplace listing → new collection in My Collections |

---

## 18. Critical Implementation Notes

### Password Identity and Session Storage

Password hashes and session tokens must never be stored in plaintext.

```typescript
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':')
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function hashSessionToken(token: string): string {
  return createHmac('sha256', process.env.AUTH_SESSION_SECRET!)
    .update(token)
    .digest('hex')
}
```

Rules:

- `auth_identities.password_hash` is only set for `provider='password'`
- Session cookies carry the raw random token; the DB stores only `token_hash`
- On logout, delete the current `auth_sessions` row and clear the cookie
- On login, always issue a fresh session token instead of reusing an old one

### Future SSO Account Linking

When SSO is added later, do not create a second HKER user unless the person explicitly wants a separate account.

Recommended linking rules:

1. Normalize provider email to lowercase.
2. If the SSO identity has a verified email matching an existing `users.email`, link the new `auth_identities` row to that existing `user_id`.
3. If there is no matching user, create a new `users` row and attach the SSO identity.
4. If email is missing or unverified, require explicit account-linking confirmation before attaching.

This is the key decision that keeps "normal login now, SSO later" low-risk.

### Return-To Redirect Validation

`/login` and `/register` accept `returnTo`, but it must be validated before redirecting:

```typescript
function sanitizeReturnTo(input: string | null | undefined): string {
  if (!input) return '/'
  if (!input.startsWith('/')) return '/'
  if (input.startsWith('//')) return '/'
  return input
}
```

Never redirect to arbitrary absolute URLs from a query parameter.

### SSRF Protection

Must be implemented in `src/server/services/link-service.ts` before any URL is stored.

```typescript
function isPrivateIP(ip: string): boolean {
  if (ip === '::1') return true
  if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true
  const privateRanges = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^224\./,
    /^0\./,
    /^255\./,
  ]
  return privateRanges.some(r => r.test(ip))
}

export async function validateUrl(url: string): Promise<void> {
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error('INVALID_URL') }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('INVALID_URL')
  }

  const { hostname } = parsed
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && isPrivateIP(hostname)) {
    throw new Error('INVALID_URL')
  }

  // DNS lookup to catch domain names resolving to private IPs
  try {
    const { lookup } = await import('dns/promises')
    const addresses = await lookup(hostname, { all: true })
    for (const { address } of addresses) {
      if (isPrivateIP(address)) throw new Error('INVALID_URL')
    }
  } catch (e) {
    if ((e as Error).message === 'INVALID_URL') throw e
    throw new Error('INVALID_URL') // DNS failure = reject
  }
}
```

### Invite Token Generation

```typescript
import { randomBytes } from 'crypto'

function generateToken(): string {
  return randomBytes(48).toString('base64url').slice(0, 64)
}

// Retry on unique constraint violation (up to 5 attempts)
async function createWithUniqueToken(data: InviteData): Promise<InviteLink> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.insert(collectionInviteLinks)
        .values({ ...data, token: generateToken() })
        .returning()
        .then(r => r[0])
    } catch (e) {
      if (isUniqueConstraintViolation(e) && attempt < 4) continue
      throw e
    }
  }
  throw new Error('Failed to generate unique token')
}
```

### Transactional Invite Join

The join flow must be atomic. Use a database transaction:

```
BEGIN;

1. SELECT * FROM collection_invite_links WHERE token = $token FOR UPDATE
   → 404 if not found
   → 400 INVITE_EXPIRED if expiresAt < NOW()
   → 400 INVITE_EXHAUSTED if maxUses IS NOT NULL AND useCount >= maxUses

2. Check if user is the collection owner
   → If yes: COMMIT; return 200

3. SELECT * FROM collection_members WHERE collectionId = $cid AND userId = $uid
   → If exists: COMMIT; return existing membership

4. INSERT INTO collection_members (collectionId, userId, role)

5. UPDATE collection_invite_links
   SET use_count = use_count + 1
   WHERE id = $inviteId
     AND (max_uses IS NULL OR use_count < max_uses)
   → If 0 rows updated: ROLLBACK; 409 CONFLICT (race condition)

COMMIT;
```

Same pattern applies to `POST /api/family-todo/invites/:token/join`.

### Anonymous Publisher Masking

When `publisherAnonymous = true`:

```typescript
function maskPublisher(listing: RawListing): MarketplaceListing {
  return {
    ...listing,
    publisher: listing.publisherAnonymous ? null : {
      id: listing.publisherId,
      displayName: listing.publisherDisplayName,
      avatarUrl: listing.publisherAvatarUrl,
    },
  }
}
```

Never return `publisherId` to the client. Apply in **all** marketplace responses.

### Denormalized Counter Maintenance

`subscriber_count` and `fork_count` on `marketplace_listings` are manually maintained. Execute in the same transaction as the related INSERT/DELETE:

```sql
-- Subscribe
INSERT INTO subscriptions (user_id, listing_id) VALUES ($uid, $lid);
UPDATE marketplace_listings SET subscriber_count = subscriber_count + 1 WHERE id = $lid;

-- Unsubscribe (floor at 0)
DELETE FROM subscriptions WHERE user_id = $uid AND listing_id = $lid;
UPDATE marketplace_listings SET subscriber_count = GREATEST(0, subscriber_count - 1) WHERE id = $lid;

-- Fork
INSERT INTO forks (source_collection_id, forked_collection_id, forked_by) VALUES (...);
UPDATE marketplace_listings SET fork_count = fork_count + 1 WHERE collection_id = $sourceCollectionId;
```

### Marketplace Server Components — Direct Drizzle Queries

Server Component pages must query Drizzle directly — **do NOT call `/api/marketplace`** from server code:

```typescript
// src/app/(main)/marketplace/page.tsx  (no 'use client')
import { db } from '@/server/db'
import { marketplaceListings, collections, users } from '@/db/schema'

export default async function MarketplacePage({ searchParams }) {
  const page = Math.max(0, Number(searchParams.page ?? 0))
  const size = Math.min(100, Number(searchParams.size ?? 20))

  const listings = await db
    .select({ /* select fields */ })
    .from(marketplaceListings)
    .innerJoin(collections, eq(marketplaceListings.collectionId, collections.id))
    .leftJoin(users, eq(marketplaceListings.publisherId, users.id))
    .orderBy(desc(marketplaceListings.publishedAt))
    .limit(size)
    .offset(page * size)

  return <MarketplaceClientView initialListings={listings} initialPage={page} />
}
```

The `MarketplaceClientView` client component handles search and pagination via `fetch('/api/marketplace/search?...')`.

### Board Data Loading Strategy

`GET /api/family-todo/spaces/:sid/board` uses 3 queries:

```typescript
// Query 1: all lists for space
const lists = await db.select().from(familyTodoLists)
  .where(eq(familyTodoLists.spaceId, spaceId))
  .orderBy(asc(familyTodoLists.sortOrder))

// Query 2: all todos in this space (via list join)
const todos = await db.select().from(familyTodos)
  .innerJoin(familyTodoLists, eq(familyTodos.listId, familyTodoLists.id))
  .where(eq(familyTodoLists.spaceId, spaceId))
  .orderBy(asc(familyTodos.sortOrder))

// Query 3: batch fetch all referenced users
const userIds = [...new Set(todos.flatMap(t =>
  [t.assignedTo, t.completedBy, t.createdBy].filter(Boolean)
))]
const userMap = userIds.length ? await fetchUsersById(userIds) : {}

// Assemble in memory: group todos by listId, attach user objects
```

### Next.js + i18next SSR Safety

Guard all `localStorage` access in i18n init:

```typescript
const storedLanguage = (() => {
  if (typeof window === 'undefined') return null
  try { return window.localStorage.getItem('lang') } catch { return null }
})()
```

The file that imports i18n must be inside a `'use client'` component (`src/components/providers.tsx`). Never import i18n in Server Components.

---

