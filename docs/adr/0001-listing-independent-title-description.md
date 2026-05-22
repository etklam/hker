# ADR 0001 — Marketplace Listings should have independent title and description

**Date:** 2026-05-18

## Status

Accepted — implemented.

## Context

Currently, `marketplace_listings` only stores a `collection_id` reference. When rendering a Listing page, the title and description are read directly from the associated Collection. This means:

- A Collection owner cannot customise how their listing appears in the Marketplace without changing the Collection itself.
- If a Collection is edited after publishing, the Marketplace listing title/description changes immediately with no review step.
- The `publisherId` can already differ from `ownerId` (editors can publish), but only the owner controls the Collection title.

## Decision

Add `title` and `description` columns to `marketplace_listings`. At publish time, these are pre-filled from the Collection but can be edited independently afterwards.

## Consequences

- The Marketplace Listing has its own identity separate from the source Collection.
- The Collection owner and the publisher may present the same content with different framing.
- Unpublishing and re-publishing would need to decide whether to reset or preserve the custom title/description.
- Additional migration and API changes required.
