# HKER — Domain Context

> Auto-generated during grill-with-docs session. Terms are resolved inline as decisions crystallise.

## Product Identity

HKER is a **生活工具箱** (life toolkit) for Hong Kong people. The homepage is a tool hub where every feature is a "tool" in two categories:

- **長期工具 (Long-term tools)** — require login, persist data. Examples: Collections, Spaces (Todo + Bills), Marketplace.
- **短期工具 (Short-term tools)** — no login needed, instant use, no persistence. Examples: resignation calculator, mortgage calculator, cheque amount converter.

The three long-term tool surfaces (Collections, Marketplace, Spaces) are intentionally independent product modules sharing a common auth shell. New tools are added organically as ideas emerge.

**Tone of voice:** 親切 (warm, friendly). UI language is 粵語為主 — written Cantonese with Traditional Chinese mixed in where natural. Not formal written Chinese, not playful/slangy — just conversational and approachable.

---

## Glossary

### Theme
Three modes: `light` (default), `dark`, `eye` (green tint). Persisted via local preference. More themes planned for the future.

### User
A registered account. Has a `role` of `user`, `admin`, or `superadmin`. Role hierarchy: superadmin manages admins and has full system access; admin manages users and content; user is a regular member. Owns collections, spaces, and bill lists. `email` and `displayName` on the `users` table are nullable to support future SSO providers that may not provide an email. The provider-neutral auth model separates user identity from login methods: `users` is the application-level identity, `auth_identities` stores login credentials per provider. Email source of truth: `auth_identities.email` (per-provider) supersedes `users.email`. If multiple identities exist, the most recently used identity's email takes precedence.

### Collection
A curated group of links. Owned by one User. Can be shared with other Users via membership and invite links. Has three visibility levels:

- **`private`** — visible to owner + all members (viewer + editor). Not discoverable.
- **`unlisted`** — visible to owner + all members. Anyone with the direct link can join as a member. Not on Marketplace.
- **`public`** — visible to everyone. Eligible for Marketplace publishing.

### Link
A URL entry inside a Collection. Has title, description, favicon, and sort order. Favicon is auto-fetched when a link is added. No re-fetch or Open Graph metadata support currently — may be considered later.

### Collection Member
A User who has been invited into a Collection. Roles: `viewer` or `editor`. The owner is not stored as a member row — ownership is on the Collection itself.

### Marketplace Listing
A published projection of a public Collection. One-to-one with a Collection. Has its own `title` and `description`, pre-filled from the Collection at publish time but independently editable afterward. The `publisherId` may differ from the Collection's `ownerId` because editors can publish on behalf of the owner. Tracks subscriber count, fork count, pin status, and whether the publisher is anonymous. Unpublishing soft-deletes the Listing (active=false) but preserves Subscription and Fork records — subscribers simply can no longer see it, and forked copies are independent. Re-publishing reactivates the existing Listing, preserving custom title/description.

### Subscription
A User's follow relationship with a Marketplace Listing. Currently acts as a bookmark — no notification or update mechanism. Future enhancements planned.

### Fork
A copy of a listed Collection into the forker's private workspace. Creates a new Collection (default visibility: `private`) that is independent of the source. If the source Collection is deleted, the forked copy is unaffected — only the `forks` record is cascade-deleted. No re-sync mechanism exists yet; long-term TODO.

### Space
A collaborative workspace. Owned by one User. Members join via invite links. Roles: `owner`, `admin`, `member`. Both owner and admin can change member roles. New members join as `member` by default — future: invite links should support a `role` field to allow pre-assigning `admin` or `member` at invitation time. Originally called "Family Todo Space" — renamed to reflect that usage extends beyond family (e.g. roommates, friends splitting bills).

### Space List
A column inside a Space. Contains Todos. Can be reordered.

### Space Todo
A task card inside a Space List. Has priority, due date, assignee, completion tracking. Can be moved across Lists.

### Monthly Bill List
A recurring bill tracker subordinate to a Space. Owned by one User. Can optionally bind to a Space (`sharedSpaceId`) to inherit its members. If unbound (`null`), the bill list is private to the owner. Currently placed under `/tools/` in the UI as a temporary home — not a permanent product-level peer of Collections or Spaces. Future: may support non-family sharing (e.g. splitting Netflix with friends).

### Monthly Bill Item
A recurring charge inside a Bill List. Has a due day (1–31), optional amount, and note.

### Monthly Bill Check
A per-month tick-off record for a Bill Item. Tracks who checked it and when. Unique per (item, year, month).

### Telegram Bot
Experimental. Currently only responds to `/start` and `/help`. No integration with HKER data. On hold until core features stabilise.

### Tool (Short-term)
A client-side only utility (no backend, no auth). Instant use, no persistence. Currently includes: resignation last day calculator, mortgage calculator, cheque amount converter. Monthly bills was temporarily placed here but belongs under Spaces. New short-term tools are added organically.

---

## Domain Boundaries

| Boundary | Schema File | Service Module | Auth Required |
|----------|-------------|----------------|---------------|
| Auth | `auth.ts`, `rateLimit.ts` | `auth-service`, `session-service` | Partial |
| Users | `users.ts` | `user-service` | Yes |
| Collections + Links | `collections.ts` | `collection-service`, `link-service` | Yes |
| Collection Collaboration | `collaboration.ts` | `member-service`, `invite-service`, `permission-service` | Yes |
| Marketplace | `marketplace.ts` | `marketplace-service`, `subscription-service` | Partial |
| Spaces (Todo + Bills) | `familyTodo.ts`, `monthlyBills.ts` | `family-todo-space-service`, `family-todo-service`, `family-todo-board-service`, `monthly-bill-service` | Yes |
| Tools (Short-term) | (client-side only) | (none) | No |
| Telegram Bot | (none) | `telegram-bot` | Webhook token |

---

## Open Questions

- **Rate limiting migration:** `rateLimitEntries` and `loginFailures` tables exist in schema but are not yet used — rate limiting and login lockout are still in-memory. Plan: migrate to DB-based first, then switch to Redis when available.

## Resolved Decisions

- **superadmin role added to user_role enum:** Homepage featured content now sources from superadmin's public collections with admin fallback.
- **Publisher demotion edge case:** Editors can publish to Marketplace and unpublish. If a publisher is demoted to Viewer or removed, the Listing remains active. The original publisher retains the ability to unpublish the Listing they created (via `publisherId` match). Owner and current editors can also unpublish at any time.
- **Listing title/description independence:** Marketplace Listings have their own `title` and `description` columns, pre-filled from the Collection at publish time but independently editable. Search and display use listing-level fields. Re-publishing preserves custom values.
- **Visibility downgrade auto-unpublishes:** If a published Collection's visibility is changed from `public` to `private` or `unlisted`, the associated Marketplace Listing is automatically unpublished. Subscription and Fork records are preserved.
- **Space invite default role:** New Space members join as `member`. Owner and admin can change roles. Future: add `role` field to Space invite links.
- **Admin capabilities implemented:** Admin+ can ban/unban users (except superadmin or self), delete any collection, update any collection (title, description, icon), and pin/unpin marketplace listings. Superadmin only can delete users (except self) and change user roles. Banned users are blocked from auth at session validation.
- **Space naming:** "Family Todo Space" renamed to "Space" throughout. Code refactor pending.
