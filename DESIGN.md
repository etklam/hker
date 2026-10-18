---
name: HKER Directory
description: A Hong Kong street-plate system — enamel green board, bilingual plates, a ruled index, one seal for "this one".
register: product
colors:
  enamel: "oklch(0.312 0.049 163)"
  enamel-deep: "oklch(0.252 0.044 163)"
  enamel-raise: "oklch(0.372 0.052 163)"
  enamel-wash: "oklch(0.958 0.016 163)"
  on-enamel: "oklch(0.985 0.003 163)"
  on-enamel-2: "oklch(0.822 0.026 163)"
  paper: "oklch(0.993 0.002 162)"
  shade: "oklch(0.966 0.006 162)"
  shade-deep: "oklch(0.936 0.009 162)"
  rule: "oklch(0.876 0.011 162)"
  rule-mid: "oklch(0.615 0.019 164)"
  ink: "oklch(0.238 0.021 164)"
  ink-2: "oklch(0.432 0.019 164)"
  ink-3: "oklch(0.492 0.017 164)"
  ink-4: "oklch(0.615 0.014 164)"
  seal: "oklch(0.523 0.196 31)"
  seal-deep: "oklch(0.455 0.168 29)"
  seal-wash: "oklch(0.959 0.024 38)"
  danger: "oklch(0.452 0.158 20)"
  warn: "oklch(0.445 0.104 73)"
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
  plate:
    width: "58px"
    background: "{colors.enamel}"
    textColor: "{colors.on-enamel}"
    variants: "filled (district) · outline (online) · seal (featured)"
  button:
    background: "{colors.paper}"
    border: "1px solid {colors.rule-mid}"
    rounded: "{rounded.control}"
    minHeight: "44px"
  button-primary:
    background: "{colors.enamel}"
    textColor: "{colors.on-enamel}"
  listing-card:
    layout: "plate · bilingual name · price, hairline separated"
---

# Design System: HKER Directory

## Overview

Hong Kong tells you where you are on **enamelled plates**: a bounded field, a
dark ground, the Chinese place name with its Latin name set beneath in tracked
caps. The road signs are green. HKER borrows that grammar literally, because
the product does the same job — telling a person standing on a street which
place is which.

So the masthead, the home board and the footer are enamel green; every listing
carries a **district plate**; names with a Latin form get the plate's second
line; red is reserved for "this one".

This replaces the signage-index system (ink frame, paper sheet, vermilion seal).
That system was disciplined but anonymous: a tasteful Swiss-minimal directory
template that could have belonged to any city. Its concrete failures were an
index row 140px tall carrying four short lines, a price orphaned 1000px from
its name across empty paper, a search rail of eight stacked full-width selects
running 1600px against three results, a 6px orange square as the only "featured"
mark, and `#hashtag` tags at 11px grey. Nothing on screen was Hong Kong.

The register is **product**: design serves the task. A visitor is on a street in
daylight deciding where to go in the next ten minutes; a curator is at a desk
keeping the list honest. Both want to read, not to admire. That forces light
mode, high contrast and density.

## Colors

Strategy is **committed on the board, restrained on the sheet**. The home board,
masthead and footer are a full enamel-green surface. Interior pages are paper,
with green carried only by plates, primary buttons, section rules and the
current-page marker.

- **Enamel** is the brand surface and the primary action. Not an accent: a
  ground. `enamel-raise` / `enamel-deep` are its hover and pressed states.
- **Paper / shade / shade-deep** are the three sheet layers. Content on paper;
  sidebars, toolbars, table headers, empty states and panels on shade.
- **Ink** carries headings and body copy. **ink-2** is metadata and secondary
  copy, **ink-3** is placeholders and Latin plate lines, **ink-4** is drawn
  marks only and never type.
- **Seal** (red) means *this one*: the featured plate, the featured marker,
  focus rings, and hover underlines on paper. It is never a surface and never
  decoration, and it stays under roughly 5% of any screen.
- **Danger** is a darker, cooler red than the seal and appears only on
  destructive controls, which are always labelled too. **warn** carries notices
  and the staging banner.

Every pair is computed from OKLCH to a WCAG ratio, not eyeballed: body ink on
paper 16.1:1, metadata 7.8:1, placeholders and Latin lines 6.0:1, masthead text
12.3:1, resting nav 7.5:1, plate text 12.3:1, featured plate 5.8:1, online
plate 12.5:1, control borders 3.6:1 and focus rings 5.9:1 (WCAG 1.4.11). All 31
pairs in use sit at or above their floor.

One pair was rejected on measurement: a seal underline for the current nav item
is **2.1:1 on enamel** and is a red/green pair besides. The current page is an
**inverted plate** instead — white fill, enamel text, 12.3:1 — which is the same
plate language and carries no colour load at all.

## Typography

Two families split by job, with no webfont and therefore no build-time network
dependency (production CSP is `font-src 'self'`).

- **Han**: PingFang HK first, Noto Sans HK after it. The Latin faces lead
  `--font-text` and carry no CJK glyphs, so Chinese always falls through to a
  face chosen for Hong Kong rather than to a generic `system-ui`.
- **Latin** is the same grotesque, but in **tracked caps** wherever it names
  something — the wordmark plate, the board's `Hong Kong Local Directory`, a
  listing's Latin name, a section's Latin pair. That is signage work, which is
  what a grotesque in caps is for.

Numerals are **tabular in the text face**, not monospaced. Prices, counts,
pagination and table figures all align in columns without the terminal voice the
previous system gave them; `--font-mono` survives only for genuinely machine-ish
strings via `.mono`.

The scale is fixed in rem at roughly a 1.15 ratio, per the product register.
Only the board h1 and the detail h1 use a bounded `clamp()`, both far under the
6rem ceiling and no tighter than -0.018em. Prose caps at 66ch, index
descriptions at 62ch, tables run dense.

### The bilingual pair is not an eyebrow

Tracked caps appear beside or beneath their Chinese, in the **translation**
position a real plate uses — never as a kicker floating above a heading. A
section heading reads `精選推薦 FEATURED` on one baseline. This is the brand's
defining system, used everywhere or not at all; it is not section scaffolding.

## Layout

A 1180px shell with a `clamp(16px, 4vw, 32px)` gutter. Hierarchy comes from
rules and plates, not boxes: a 2px enamel rule opens every section and column
header; 1px hairlines separate rows.

**The index row** is a three-column baseline grid — plate, name block, price —
with description and tags indented to the name column. The plate is the anchor
the old index lacked, and it makes the list scannable by district, which is how
people actually navigate Hong Kong. Price sits in its own right column on the
name's baseline, so it can never drift away from what it prices. The whole row
is a navigation target via a stretched link on the name; tag links sit above
that overlay so they stay independently clickable.

**The home board** is a two-column index above 1040px, split by a centre rule —
a lift-lobby tenant board. Descriptions clamp to two lines there; in search
results, where the single column is a scan, they run full.

Responsive behaviour is structural. At 1024px the admin sidebar becomes a
disclosure and tables become labelled blocks. At 860px the search rail stops
being sticky and collapses into a `details` panel. At 680px the masthead sheds
its subtitle and the editor sheet goes full-bleed. At 420px the plate narrows to
50px and paired fields stack. Below 360px the price drops off the name's line.
No horizontal overflow at 320px.

## The plate

The one component that carries the whole system.

- **Filled** (enamel) is a district. The label steps down a size at 3 and 4+
  characters rather than overflowing its field, because a plate's field is fixed.
- **Outline** (enamel on paper) means the listing has no district — it is
  online. The old design had no way to say this at all.
- **Seal** (red fill) means featured, and adds a drawn inner rule so the mark is
  never colour alone; the row also carries a visually hidden 「精選」. The
  listing detail deliberately does *not* use this variant: with nothing to
  compare against, a red plate reads as a claim about the district, so featured
  is a labelled marker in the meta line instead.
- The wordmark is itself a plate, with the double rule real plates carry.

## Elevation & depth

Flat. No decorative shadows and no shadow-plus-border pairs anywhere. Depth is
the enamel surfaces, the three sheet layers, and a semantic z-scale
(`--z-sticky` 20 → `--z-backdrop` 40 → `--z-modal` 50 → `--z-skip` 80). The only
translucency is the editor dialog's backdrop, plain ink at 42% with no blur.

## Shapes

2px for plates, status pills and tokens, 4px for controls, 6px for panels,
tables and the editor sheet. Nothing is more rounded than 6px.

## Motion

State only, 120–220ms, on an ease-out curve. Row and button hovers, focus rings,
disclosure chevrons, the editor sheet's 220ms slide-in, the loading skeleton
pulse. No entrance choreography and no page-load sequences. Every animation and
transition is suppressed under `prefers-reduced-motion: reduce`.

## Components

- **Buttons**: paper fill with a 3.6:1 border by default, enamel fill for
  primary, danger-bordered for destructive, `.sm` for admin density (reverting
  to 44px on coarse pointers), `.quiet` for inline reorder controls.
- **Inputs**: 44px minimum, enamel border and a seal-wash ring on focus, custom
  select caret, tabular numerals for numeric fields, 16px on small screens so
  iOS does not zoom.
- **Search bar**: input and button fused in one 2px frame — the page's single
  strongest control. On the board it is white-framed on green.
- **Search rail**: sticky and independently scrolled, so it travels with the
  results instead of out-running them, with a sticky `套用篩選` that is always
  reachable. Sort moved out of the rail and over the results, where it belongs;
  min and max budget read as one range. Only the rail scrolls — the tag list's
  own scroller is removed there, because a scroller inside a scroller traps the
  pointer.
- **Chips**: shade tokens for browsing; active filters get an outlined variant
  with a drawn × (two rotated bars, never generated text — CSS `content` joins
  the accessible name and breaks exact-name queries).
- **Tags**: plain interpunct-separated links at 13px, not `#hashtags` at 11px.
- **Tables**: sticky headers on shade, hairline rows, tabular numerals, status
  pills (enamel wash for enabled, shade for disabled, with a filled vs hollow
  dot so state is not colour alone).
- **Empty states** teach the next move and offer a recovery action; admin
  loading uses a skeleton table, not a spinner.
- **Editor**: right-hand sheet, enamel-ruled header, sticky shade footer,
  full-bleed under 680px, unsaved-change confirmation retained.

## Known gap: the Latin name

There is no `name_en` column on `directory_listings`, and `slug` is a URL key,
not a name — rendering `mei-du-restaurant` as a plate's Latin line would look
wrong on some rows and nonsensical on others. So a listing's Latin line reads
the curator-maintained `attrs` map (`英文名`, `name_en`, `英文名稱`, `English`)
and renders nothing when absent. Zero migration, graceful absence.

This is also the more faithful reading: Hong Kong's bilingual signage is
*wayfinding* — street plates, directional signs, station boards. Shop signs are
usually Chinese-dominant. The bilingual pair therefore belongs on the things the
product itself names (brand, sections, page headings, districts), and is a bonus
on shop names, not a requirement.

If curators start filling `英文名` widely, promote it to a real column.

## Do's and don'ts

- **Do** keep the seal for "this one" — featured, focus, current. If it is
  decorating something, it is wrong.
- **Do** make primary actions enamel.
- **Do** compute contrast from the token before shipping a colour; the ratios
  above are the floor, and the nav underline shows why eyeballing fails.
- **Do** let a plate's label step down a size rather than overflow its field.
- **Don't** put the Latin line above its Chinese — that turns the system into
  the uppercase-eyebrow trope.
- **Don't** reintroduce card grids, `#hashtag` tags, monospaced prices, or
  `查看詳情 →`-style arrow links on every item.
- **Don't** pair red and green to carry meaning anywhere.
- **Don't** put decorative text in CSS `content` on anything interactive.
- **Don't** add shadows, gradients, blurs, or radii above 6px.
- **Don't** invent listing imagery, or use absent links and prices as filler.
