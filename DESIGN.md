---
name: HKER Directory
description: A Hong Kong wayfinding system — ink frame, paper sheet, ruled index, one vermilion seal.
register: product
colors:
  paper: "oklch(0.994 0.001 250)"
  shade: "oklch(0.967 0.003 250)"
  shade-deep: "oklch(0.941 0.004 250)"
  rule: "oklch(0.886 0.005 250)"
  rule-mid: "oklch(0.655 0.011 255)"
  ink: "oklch(0.215 0.022 255)"
  ink-raised: "oklch(0.3 0.024 255)"
  ink-2: "oklch(0.455 0.018 255)"
  ink-3: "oklch(0.53 0.015 255)"
  on-ink: "oklch(0.985 0.002 250)"
  on-ink-2: "oklch(0.79 0.012 250)"
  seal: "oklch(0.565 0.182 35)"
  seal-ink: "oklch(0.495 0.165 33)"
  seal-wash: "oklch(0.964 0.019 40)"
  danger: "oklch(0.45 0.155 18)"
  go: "oklch(0.455 0.095 160)"
  warn: "oklch(0.455 0.105 73)"
typography:
  han:
    fontFamily: '"PingFang HK", "PingFang TC", "Noto Sans HK", "Noto Sans CJK HK", "Hiragino Sans", "Microsoft JhengHei", sans-serif'
  text:
    fontFamily: '"Helvetica Neue", "Segoe UI", Roboto, Arial, var(--font-han), sans-serif'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", var(--font-han), monospace'
  scale:
    xs: "0.6875rem"
    sm: "0.8125rem"
    ui: "0.875rem"
    base: "0.9375rem"
    md: "1.0625rem"
    lg: "1.1875rem"
    xl: "1.4375rem"
    2xl: "1.75rem"
rounded:
  status: "2px"
  control: "4px"
  panel: "6px"
motion:
  ease: "cubic-bezier(0.22, 1, 0.36, 1)"
  fast: "120ms"
  base: "180ms"
components:
  button:
    background: "{colors.paper}"
    border: "1px solid {colors.rule-mid}"
    rounded: "{rounded.control}"
    minHeight: "44px"
  button-primary:
    background: "{colors.ink}"
    textColor: "{colors.on-ink}"
  button-danger:
    textColor: "{colors.danger}"
  listing-card:
    layout: "ruled index row, hairline separated"
  chip:
    background: "{colors.shade}"
    rounded: "{rounded.status}"
---

# Design System: HKER Directory

## Overview

HKER is a wayfinding system, not a card wall. Its reference is the printed and
enamelled signage Hong Kong already uses to point people at places: street
plates, lift-lobby tenant boards, tram and minibus route lists. The page is a
paper sheet inside an ink frame; listings are a ruled index; one vermilion seal
carries identity and current state and nothing else.

This replaces the earlier blue-and-white card system. That system failed the
only test that matters here — it looked generated. Its tells were a default
slate background with a royal-blue accent, identical bordered cards in a
three-column grid each ending in `查看詳情 →`, `system-ui` for both Chinese and
Latin, and gray-on-near-white metadata at no particular density.

The register is **product**: design serves the task. A visitor is standing on a
street in daylight glare deciding where to go in the next ten minutes; a curator
is at a desk keeping the list honest. Both want to read, not to admire. That
forces light mode, high contrast, and density.

## Colors

Strategy is **restrained with one committed moment**. The committed moment is
the masthead: a full ink band edged with a 2px vermilion rule, the only
saturated surface on the site.

- **Paper / shade / shade-deep** are the three surface layers. Content sits on
  paper; sidebars, toolbars, table headers, footers and panels sit on shade;
  shade-deep is for pressed states and disabled status.
- **Ink** carries the frame, all headings and all body copy, and fills primary
  buttons. Primary actions are ink, not an accent colour.
- **ink-2** is metadata and secondary copy; **ink-3** is placeholders and
  decorative marks only, never body copy.
- **Seal** (vermilion) appears on the masthead rule, the wordmark's current-page
  underline, the featured marker on index rows, focus rings, and hover
  underlines. It is never a surface and never decoration. Usage stays under
  roughly 5% of any screen.
- **Danger** is a distinctly darker, cooler red than the seal and appears only
  on destructive controls, which are also always labelled. **go** marks enabled
  status, **warn** marks notices and the staging banner.

Every pair in use is contrast-checked: body ink on paper 17.2:1, metadata 7.2:1,
placeholders 5.2:1, masthead text 16.8:1, masthead resting nav 9.1:1, seal as a
focus ring 4.9:1, control borders 3.1:1 (WCAG 1.4.11), and every status and
message colour above 6:1 on its own wash.

## Typography

Two families, split by job, with no webfont and therefore no build-time network
dependency (production CSP is `font-src 'self'`).

- **Han**: PingFang HK first, Noto Sans HK after it. The Latin faces lead the
  `--font-text` stack and carry no CJK glyphs, so Chinese always falls through
  to a face chosen for Hong Kong rather than to a generic `system-ui`.
- **Mono** carries the data layer: prices, dates, counts, pagination, table
  headers, filter legends, the `HKER` wordmark, section counts. This is the
  signage pairing — set Chinese against monospaced Latin and numerals — and it
  gives the interface a voice without a display face in the UI.

The scale is fixed in rem at roughly a 1.15 ratio, per the product register;
only the home h1 and the detail h1 use a bounded `clamp()`, both well under the
6rem display ceiling and no tighter than -0.015em. Prose caps at 68ch; index
descriptions at 64ch; tables run dense.

## Layout

A 1180px shell with a `clamp(16px, 4vw, 32px)` gutter. Hierarchy comes from
rules, not boxes: a 2px ink rule opens every section and every column header; 1px
hairlines separate rows.

Listings are an **index**, not cards. Each row is a baseline-aligned grid — name
and price on the first line, area · category below, description, then tags — with
the row as a single navigation target via a stretched link on the name. Tag links
sit above that overlay so they stay independently clickable.

Responsive behaviour is structural. At 1024px the admin sidebar becomes a
disclosure and tables become labelled blocks. At 860px the search rail collapses
into a `details` panel with a drawn chevron. At 680px the masthead sheds its
subtitle and the editor sheet goes full-bleed. Below 360px the index row drops to
a single column and reorders name → area → price → description → tags. No
horizontal overflow at 320px.

## Elevation & depth

Flat. There are no decorative shadows and no shadow-plus-border pairs anywhere.
Depth is the ink band, the surface layers, and a semantic z-scale
(`--z-sticky` 20 → `--z-backdrop` 40 → `--z-modal` 50 → `--z-skip` 80). The only
translucency is the editor dialog's backdrop, plain ink at 40% with no blur.

## Shapes

2px for status pills and tokens, 4px for controls, 6px for panels, tables and
the editor sheet. Nothing is more rounded than 6px.

## Motion

State only, 120–220ms, on an ease-out curve. Row and button hovers, focus rings,
disclosure chevrons, the editor sheet's 220ms slide-in, and the loading skeleton
pulse. No entrance choreography and no page-load sequences. Every animation and
transition is suppressed under `prefers-reduced-motion: reduce`.

## Components

- **Buttons**: paper fill with a 3:1 border by default, ink fill for primary,
  danger-bordered for destructive, `.sm` for admin density (reverting to 44px on
  coarse pointers), `.quiet` for inline reorder controls. Every one has hover,
  active, focus and disabled states.
- **Inputs**: 44px minimum, ink border and a seal-wash ring on focus, custom
  select caret, mono tabular numerals for numeric fields, 16px on small screens
  so iOS does not zoom.
- **Search bar**: input and button fused inside one 2px ink frame — the page's
  single strongest control.
- **Index rows**: hairline separated, shade on hover and on keyboard focus, seal
  square on featured rows with a visually hidden「精選」for screen readers.
- **Chips**: shade tokens for browsing; active search filters get an outlined
  variant with a drawn × (two rotated bars, never generated text — CSS `content`
  joins the accessible name and breaks exact-name queries).
- **Tables**: sticky mono headers on shade, hairline rows, tabular numerals,
  status pills with a square dot, row actions grouped in `.row-actions` with the
  per-row history disclosure inline.
- **Empty states** teach the next move and offer a recovery action rather than
  reporting absence; admin loading uses a skeleton table, not a spinner.
- **Editor**: right-hand sheet, ink-ruled header, sticky shade footer, full-bleed
  under 680px, unsaved-change confirmation retained.

## Do's and don'ts

- **Do** keep the seal for identity and state. If it is decorating something, it
  is wrong.
- **Do** make primary actions ink.
- **Do** render listings as a ruled index and keep the whole row a target.
- **Do** verify contrast when adding a colour; the ratios above are the floor.
- **Don't** reintroduce card grids, the old blue accent, `system-ui` for Chinese,
  or `查看詳情 →`-style arrow links on every item.
- **Don't** put decorative text in CSS `content` on anything interactive.
- **Don't** add shadows, gradients, blurs, or radii above 6px.
- **Don't** invent listing imagery, or use absent links and prices as filler.
