---
name: HKER Directory
description: A clear blue and white directory for Hong Kong discovery and catalog curation.
colors:
  bg: "#f8fafc"
  surface: "#fff"
  text: "#172334"
  muted: "#5b6879"
  accent: "#1b58ca"
  accent-hover: "#1547a6"
  accent-soft: "#edf3ff"
  border: "#dce2e9"
  danger: "#b42318"
  success: "#177245"
typography:
  display:
    fontFamily: 'system-ui, -apple-system, "Noto Sans HK", sans-serif'
    fontSize: "clamp(32px, 5vw, 54px)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontSize: "19px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: 'system-ui, -apple-system, "Noto Sans HK", sans-serif'
    fontSize: "15px"
    lineHeight: 1.65
  label:
    fontSize: "14px"
    fontWeight: 550
rounded:
  control: "6px"
  status: "4px"
spacing:
  compact: "8px"
  field: "18px"
  card: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 17px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
  listing-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "24px"
  chip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "6px 12px"
---

# Design System: HKER Directory

## Overview

A clean, minimal directory with white surfaces, cool gray structure, and restrained blue actions. The public shell gives search and listing information room to breathe; administration uses the same vocabulary at a denser scale. This records the implemented replacement for the former Mochi identity, based on the user’s textual rebuild brief.

Key characteristics: readable Hong Kong Chinese, quiet borders, explicit controls, and useful empty and error states. No raster imagery or approved visual comp defines this system.

## Colors

Blue is the primary accent for the wordmark, primary actions, links, tags, and active navigation. Accent-soft supports selected admin navigation; accent-hover deepens primary buttons on hover.

The neutral palette separates the pale page background from white surfaces. Dark text carries content, muted text carries metadata, and borders define structure. Danger identifies destructive actions and errors; success identifies enabled status. Notices use a separate warm tinted treatment.

## Typography

System sans typography is shared across headings, forms, and body text, with Noto Sans HK as a fallback. Display type serves the public hero; headline and title roles distinguish sections and listing names. Metadata and table text use a compact 13px size; descriptions and links use 14px. Prices and tables use tabular numerals. Detail prose is capped at 72ch.

## Layout

The public container caps at 1120px with 20px side gutters. Home listings use three columns with 18px gaps. Search uses a 230px filter rail and a two-column results grid. The admin shell uses a 220px sidebar and 32px content padding.

At 760px and below, public gutters become 16px, listing grids and search become one column, and filters become a collapsible bordered panel. Admin navigation becomes a disclosure menu; table rows become labeled blocks. The right editor becomes full-screen, and two-column form groups become one column. Taxonomy tiles retain two columns on mobile.

## Elevation & Depth

Surfaces are flat: white fill, subtle borders, and spacing establish hierarchy without decorative shadows or gradients. A translucent backdrop separates the modal editor from its underlying page. There are no custom motion transitions in the current implementation.

## Shapes

Controls, listing cards, panels, and chips share modest control-radius corners. Status labels have slightly tighter corners. Borders remain thin and consistent. The editor is a flush rectangular panel with a left divider on desktop and no outer border on mobile.

## Components

- **Buttons:** primary blue or white secondary surfaces; danger actions retain the secondary shape with red text. Minimum height is 44px. Hover changes the fill; disabled buttons dim and show a wait cursor.
- **Inputs:** full-width white fields with thin borders and a 44px minimum height. Labels sit above fields; checkbox labels preserve a 44px target. Textareas resize vertically.
- **Focus:** visible keyboard focus uses a 3px blue outline with a 3px offset across interactive elements.
- **Chips:** compact bordered links with a 40px minimum height; hover turns the border and text blue. Listing hashtags are lighter inline text links rather than filled badges.
- **Listing cards:** title, area/category metadata, description, optional price, tags, and a divided detail link. Cards stretch descriptions to align their lower actions. Empty results use a dashed panel and a recovery link.
- **Navigation:** compact header links; desktop admin links use a pale blue active background and blue text. Mobile navigation preserves accessible targets.
- **Tables and status:** subtle header fill and row hover, horizontal separators, green enabled labels and neutral disabled labels. Mobile rows reveal their field names.
- **Editor:** native modal dialog, up to 620px wide on desktop, full viewport height, and a sticky action footer. Unsaved changes require confirmation before closing. Error messages remain within the form.

## Do's and Don'ts

- **Do** use the same neutral surfaces and blue accent across public and admin screens.
- **Do** retain visible keyboard focus, readable labels, and real loading, empty, and error states.
- **Do** let long listing content wrap and adapt dense information for mobile.
- **Don't** reintroduce the superseded Mochi theme, decorative gradients, or decorative shadows.
- **Don't** invent listing imagery or use absent links and prices as visual filler.
