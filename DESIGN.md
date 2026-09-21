---
name: Hyrax
description: Small functions, checked answers. The documentation site as a bench you can touch.
colors:
  graphite: "#0d0c0b"
  graphite-sunk: "#090807"
  graphite-panel: "#161513"
  graphite-raised: "#1f1d1a"
  paper: "#fbf9f6"
  paper-sunk: "#f2eee8"
  paper-panel: "#f6f3ee"
  paper-raised: "#ece7df"
  ink: "#f4f1ec"
  ink-soft: "#b9b3a9"
  ink-faint: "#8f897f"
  ink-night: "#1b1815"
  ink-night-soft: "#57514a"
  ink-night-faint: "#6a645a"
  vermilion: "#ff6a3d"
  vermilion-hover: "#ff8259"
  vermilion-ink-dark: "#ff7a4f"
  vermilion-ink-light: "#b5330b"
  on-vermilion: "#1a0e08"
  code-lilac: "#c4a5f7"
  code-sand: "#e6c87b"
  code-mint: "#7fd1ae"
  code-sky: "#79c0f2"
  danger-dark: "#ff8a7d"
  danger-light: "#b3261e"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.2rem + 5.2vw, 4.75rem)"
    fontWeight: 660
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 680
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
  code:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.75
    fontFeature: '"calt" 0'
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "16px"
spacing:
  block: "128px"
  gap: "24px"
  panel: "24px"
components:
  button-primary:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.on-vermilion}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.vermilion-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  field:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
  code-panel:
    backgroundColor: "{colors.graphite-panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    typography: "{typography.code}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "8px"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.vermilion-ink-dark}"
---

# Design System: Hyrax

## Overview

**Creative North Star: "The Live Bench"**

Every page is a bench you can touch. The documentation stops being text with pasted code: a function's answer sits
beside its code, computed by the real library, and the reader can drag a value or change a seed before reading on. The
system is dark first, precise and a little warm: graphite ground, hairline panels, one vermilion accent, and a single
family of type. It takes its structure from the Motion docs (live demos above code, dense but airy, crisp borders) and
its friendliness from the Zustand docs (small surface, install and code at the top, plain language).

The accent means one thing everywhere: this is true. Vermilion marks an answer the checker asserted, the page you are
on, and the main action. Nothing else is orange, so the colour keeps its meaning. There is no mascot, no logo art and
no reference to the animal; the mark is a letter tile.

**Key Characteristics:**

- One warm graphite ground with panels one tonal step up and 1px hairlines; no resting shadows.
- One accent, vermilion, that carries active, verified and primary.
- Geist for reading and interface, Geist Mono for code, numbers and import paths.
- Live labs: an inset stage with real controls beside code whose results are computed by the library.
- Every code block states what the checker did to it, in its header, by shape and words.

## Colors

A warm graphite ground with one vermilion accent and four quiet code hues.

### Primary

- **Vermilion** (#ff6a3d): fills only: the primary button, the bars in the size table, the tab underline, the tile mark,
  the search key focus. Text on it is Night Ink (#1a0e08).
- **Vermilion Ink** (#ff7a4f in dark, #b5330b in light): the same hue tuned to read as text: links, the active sidebar
  page, asserted answers and their tick, the accent half of the headline.

### Neutral

- **Graphite** (#0d0c0b; light Paper #fbf9f6): the page ground and the sidebar.
- **Graphite Panel** (#161513; light #f6f3ee): code panels, labs, fields, the install chip.
- **Graphite Sunk** (#090807; light #f2eee8): the lab stage, a step below its panel.
- **Graphite Raised** (#1f1d1a; light #ece7df): hover fills and inline code.
- **Ink** (#f4f1ec; light #1b1815), **Ink Soft** (#b9b3a9; light #57514a), **Ink Faint** (#8f897f; light #6a645a): text,
  secondary text, metadata. Every step holds 4.5:1 on its panel.
- **Hairline** (rgba(255,240,220,.09); light rgba(44,32,18,.11)) and **Hairline Strong** (.17 / .2): every division.

### Code hues

Lilac (#c4a5f7) for keywords, sand (#e6c87b) for strings, mint (#7fd1ae) for numbers and constants, sky (#79c0f2) for
types. Orange is not among them.

### Named Rules

**The True-Only Accent Rule.** Vermilion is used for what is true or current: asserted answers, the active page, the
primary action. It never decorates, and it never appears in syntax colours.

**The Warm Neutral Rule.** Neutrals lean warm (hue near 60); nothing is a cold blue-grey.

## Typography

**Display and Body Font:** Geist (with system sans)
**Code Font:** Geist Mono (with system mono)

**Character:** Geist is precise and quiet, so long reference pages stay easy to read; the hero and titles get their
voice from weight and tight tracking, not from a second face. Ligatures are off in mono so `=>` shows as typed.

### Hierarchy

- **Display** (660, clamp(2.5rem, 1.2rem + 5.2vw, 4.75rem), 1.02, -0.04em): the home headline only; its second sentence is in Vermilion Ink.
- **Headline** (680, 42px, 1.08, -0.035em): page titles, followed by an 18px lede in Ink Soft.
- **Title** (650, 26px, 1.2, -0.025em): h2. **Subhead** (620, 19px): h3.
- **Body** (400, 16px, 1.75): prose held to 68ch.
- **Label** (500, 12.5px): facts, table heads, captions; sentence case, never uppercase and never mono.
- **Code** (400, 13.5px, 1.75): blocks and labs; inline code at 0.86em on Graphite Raised with a hairline.

### Named Rules

**The Mono Means Data Rule.** Monospace is for code, import paths, sizes and numbers you could type. Headings and labels
stay in Geist.

## Layout

VitePress's three columns: a 280px sidebar, a 740px reading column and the outline. The home is a 1160px column: a
centered hero, the wide lab, then bands separated by 128px: a 5:6 split (text left, ledger right) for "Examples are
tests", a tabbed panel for entrypoints, a 5:6 split with the size table, and a two-column link list. Splits stack
below 1100px, the lab stacks by the room its own container has (below 860px) and shows answers under their statements
below 540px. The split text is sticky on wide screens.

## Elevation & Depth

Flat. Depth is one tonal step (ground, panel, sunk) and a hairline. Menus and the search modal are the only
exceptions and carry a soft, offset shadow. A shadow under a resting panel is off the system.

### Named Rules

**The Border Or Shadow Rule.** A surface declares its edge once: a hairline. Never a hairline over a wide shadow.

## Shapes

Panels and code blocks are 12px, labs, the entrypoint panel and page-level panels are 16px, controls and buttons are
10px, chips and inline chips are 8px, inline code 6px. Marks are drawn SVG: a filled disc with a tick (run and
asserted), a ring with a tick (type-checked), a dashed ring (not checked).

## Components

### Buttons

- **Shape:** 10px corners, 44px tall, 600 weight at 15px.
- **Primary:** Vermilion fill, Night Ink text; hover lightens to #ff8259; pressing moves 1px down; a trailing arrow
  nudges 2px right.
- **Quiet:** transparent, 1px Hairline Strong; hover fills Graphite Raised.

### Inputs / Fields

- **Style:** Graphite Panel fill, 1px Hairline Strong, 10px corners, mono 15px, 44px.
- **Focus:** 2px vermilion outline offset 2px. No halo glow.
- **Range:** a 4px track and a 20px vermilion thumb with a 3px ground-coloured ring.

### Chips and tabs

- **Chips:** 32px, 8px corners, hairline; selected is Vermilion Ink text on the 13% accent wash with an accent hairline.
- **Tabs:** name in 600 weight with a quiet second word; the selected tab has a 2px vermilion underline that scales in.

### Navigation

- **Nav bar:** 56px, translucent ground with a 14px backdrop blur (content scrolls under it) and a hairline below. Tile
  mark and "Hyrax" at 17px left; a 36px search pill with a Ctrl K key; links at 14px; theme switch; GitHub.
- **Sidebar:** group titles at 13px 650 with the import path in small mono beneath; items at 13.5px in Ink Soft;
  the active page is Vermilion Ink on an accent wash with 8px corners.
- **Pager:** two hairline links with 12px corners; hover raises to Graphite Panel.

### Code Block (signature)

A Graphite Panel with a hairline and 12px corners. A 40px header bar holds the checker's state at the left (shape, then
words: "Run, answers asserted", "Type-checked, not run", "Not checked") and the copy button at the right. Answers
(`// => value`) align in one column; an asserted literal is Vermilion Ink, semi-bold, with a small disc-tick after it;
prose answers stay a quiet italic comment; an answer that no longer matches is struck through in the danger colour.

### Lab (signature)

A two-part panel: an inset Graphite Sunk stage with real controls (range, text field, chips) and a code side with the
same header bar reading "Computed live by the library". Its answers come from the actual source through the build's
alias, so the numbers on the page are the library's. The Numbers lab draws a track: the allowed range as a wash, the
raw value as a hollow dot, what `clamp` keeps as a vermilion dot joined by a dashed line.

### Size Table (signature)

A table of what each import costs, with a vermilion bar per row scaled to the largest. The bars grow once, in
sequence, when the table scrolls into view, and stay drawn without script or under reduced motion.

## Do's and Don'ts

### Do:

- **Do** keep vermilion for what is true or current: asserted answers, the active page, the main action.
- **Do** give every code block its state in the header, by shape and words; add new example pages to `sheets.ts` so their facts row exists.
- **Do** build new demos as labs: real controls on the stage, results computed by the source, never typed in.
- **Do** keep motion to state changes of 120-250ms with an exponential ease-out, and honour reduced motion.
- **Do** keep muted text at 4.5:1 or better on the surface it sits on, in both themes.

### Don't:

- **Don't** draw the animal, a mascot or any character; the mark is a letter tile.
- **Don't** put grid paper, dot grids, grain or any pattern behind content.
- **Don't** use gradient text, glowing halos, or a colored side border above 1px.
- **Don't** put orange in syntax colours.
- **Don't** set labels or headings in monospace, or uppercase eyebrow labels above headings.
- **Don't** nest panels inside panels or lay out a page as a grid of identical icon cards.
