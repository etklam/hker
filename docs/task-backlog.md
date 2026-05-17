# HKER — Task Backlog

> Generated from grill-with-docs session on 2026-05-18.
> Priority: P0 = must do first, P1 = should do, P2 = later.

---

## P0 — Must Do First

### P0-1. Rename "Family Todo" → "Space" across entire codebase
- Schema: `family_todo_spaces` → `spaces`, `family_todo_space_members` → `space_members`, `family_todo_lists` → `space_lists`, `family_todos` → `space_todos`, `family_todo_invite_links` → `space_invite_links`
- Enum: `family_todo_space_role` → `space_role`, `family_todo_space_role` values stay (`owner`, `admin`, `member`)
- Routes: `/family-todo/*` → `/spaces/*`
- Services: `family-todo-space-service` → `space-service`, `family-todo-service` → `space-todo-service`, `family-todo-board-service` → `space-board-service`
- UI: all "家庭待辦" → Space 相關文案（粵語）
- Update i18n keys
- Update `CONTEXT.md` references

### P0-2. Add `superadmin` to user role enum
- Schema: `user_role` enum add `superadmin`
- Migration: promote first admin user to `superadmin`
- Homepage featured content: change from "first admin user's public collections" → "superadmin's public collections"
- Admin API gates: differentiate `superadmin` vs `admin` permissions
- Admin UI: superadmin can manage admin role

### P0-3. Visibility downgrade auto-unpublishes listing
- In `collection-service` visibility update logic: if changing from `public` to `private`/`unlisted`, check for active Marketplace Listing and auto-unpublish
- Preserve Subscription and Fork records
- Add test coverage for this scenario

---

## P1 — Should Do

### P1-1. Move Monthly Bills from `/tools/` to Space
- Remove `/tools/monthly-bills/` page
- Create new route under Spaces (e.g. `/spaces/[sid]/bills`)
- UI: Bills appear within a Space context, not standalone tools
- Keep standalone `/api/monthly-bills/*` API for now, but add Space-scoped access control

### P1-2. Migrate rate limiting to database
- Switch from in-memory maps to `rateLimitEntries` and `loginFailures` tables
- Schema tables already exist — write service layer to use them
- Add cleanup cron / TTL logic for stale entries
- Future: swap to Redis when available

### P1-3. Marketplace Listings get independent title + description
- Add `title` and `description` columns to `marketplace_listings`
- At publish time: pre-fill from Collection, allow editing
- See ADR: `docs/adr/0001-listing-independent-title-description.md`

### P1-4. Space invite links add `role` field
- Schema: add `role` column to `family_todo_invite_links` (→ `space_invite_links`)
- Default to `member` for backwards compatibility
- Schema validation update
- API + UI: allow selecting role when creating invite

---

## P2 — Later

### P2-1. Admin: edit/delete any user's collections
- Admin API for collection CRUD on behalf of other users
- Admin UI for browsing and managing all collections

### P2-2. Admin: ban/delete users
- Add `banned` status to users (or separate `user_status` enum)
- Ban: prevent login, revoke sessions
- Delete: cascade or soft-delete with confirmation

### P2-3. Admin: pin/unpin marketplace listings
- Add `pinned` boolean to `marketplace_listings` or separate featured table
- Admin UI to manage pinned listings
- Homepage / marketplace page: show pinned listings prominently

### P2-4. Fork re-sync mechanism
- Long-term feature: allow forked collections to pull updates from source
- Complex — requires diff/merge strategy
- Design doc needed before implementation

### P2-5. Subscription notifications
- Notify subscribers when source collection is updated
- Requires notification infrastructure (in-app, email, or push)

### P2-6. Resolve publisher demotion edge case
- Decide: does unpublish require `publisherId` match or any editor/owner?
- What happens to Listing if publisher is demoted/removed?
- Add policy to `CONTEXT.md` once decided

---

## Done Decisions (no action needed)

- ✅ HKER product identity: 生活工具箱 (life toolkit) for Hong Kong people
- ✅ Tool categories: 長期工具 (auth required) vs 短期工具 (no auth)
- ✅ Space naming: "Family Todo" → "Space"
- ✅ Monthly Bills: subordinate to Space, temporary home in /tools/
- ✅ Collection visibility: private / unlisted / public semantics locked
- ✅ Tone of voice: 親切, 粵語為主, accept mixed
- ✅ Themes: light / dark (eye = green), more later
- ✅ Telegram bot: on hold
- ✅ Link metadata: auto-favicon only, no OG for now
- ✅ Subscription: bookmark only, no notifications for now
- ✅ User model: provider-neutral, SSO planned
- ✅ Superadmin > Admin > User hierarchy
