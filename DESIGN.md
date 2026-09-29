---
name: Hyrax
description: Small functions, checked answers. The documentation site as a bench you can touch, at first light.
colors:
  night: "#121510"
  night-sunk: "#0d0f0b"
  olive: "#1d211a"
  olive-raised: "#262b22"
  sand: "#efe6d2"
  sand-sunk: "#e8dec7"
  paper: "#f8f3e7"
  sand-raised: "#e7ddc6"
  sand-ink: "#e8dcc0"
  sand-ink-soft: "#b5ad97"
  sand-ink-faint: "#9a947f"
  ink: "#1f1c16"
  ink-soft: "#534c3e"
  ink-faint: "#686150"
  acacia-dark: "#8fc27f"
  acacia-dark-hover: "#a4d195"
  acacia-light: "#3f6b3a"
  acacia-light-hover: "#4b7c45"
  sun-dark: "#e8703a"
  sun-light: "#e0662e"
  sun-ink-light: "#b8501f"
  code-lilac: "#c4a5f7"
  code-sand: "#e6c87b"
  code-mint: "#7fd1ae"
  code-sky: "#79c0f2"
  danger-dark: "#ff8a7d"
  danger-light: "#b3261e"
typography:
  display:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 1.2rem + 5.2vw, 4.75rem)"
    fontWeight: 660
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "42px"
    fontWeight: 680
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
  code:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
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
    backgroundColor: "{colors.acacia-dark}"
    textColor: "{colors.night}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.acacia-dark-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  field:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 14px"
  code-panel:
    backgroundColor: "{colors.olive}"
    textColor: "{colors.sand-ink}"
    rounded: "{rounded.lg}"
    typography: "{typography.code}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.sand-ink-soft}"
    rounded: "8px"
    padding: "0 12px"
    height: "32px"
  chip-selected:
    backgroundColor: "{colors.olive-raised}"
    textColor: "{colors.acacia-dark}"
---

# Design System: Hyrax

## Overview

**Creative North Star: "The Live Bench"**

Every page is a bench you can touch. The documentation stops being text with pasted code: a function's answer sits
beside its code, computed by the real library, and the reader can drag a value or change a seed before reading on. The
system follows the brand in `brand/`: Savanna Night by default (olive-black ground, sand text), Savanna & Sun in light
mode (sand ground, paper panels, ink text), hairline panels, and two colours with separate jobs. It takes its structure
from the Motion docs (live demos above code, dense but airy, crisp borders) and its friendliness from the Zustand docs
(small surface, install and code at the top, plain language).

Acacia green means one thing everywhere: this is true or current. It marks an answer the checker asserted, the page
you are on, and the main action. Orange is the sun and only the sun: the mark, the second sentence of the home
headline. It never marks a control. The mark is two stones and a sun on
the horizon between them (the sun is the H's crossbar); nothing else draws the animal.

**Key Characteristics:**

- One ground per theme with panels one tonal step off it and 1px hairlines; no resting shadows.
- Acacia for active, verified and primary; orange only for the sun.
- Schibsted Grotesk for reading and interface, JetBrains Mono for code, numbers and import paths.
- Live labs: an inset stage with real controls beside code whose results are computed by the library.
- Every code block states what the checker did to it, in its header, by shape and words.

## Colors

Two palettes from `brand/palette.json`: Savanna Night (dark, the default) and Savanna & Sun (light).

### Primary

- **Acacia** (#8fc27f dark; #3f6b3a light): fills and text for everything interactive or true: the primary button, the
  bars in the size table, the tab underline, focus rings, links, the active sidebar page, asserted answers and their
  tick. Text on the fill is Night (#121510) in dark and white in light. Hover lightens (#a4d195; #4b7c45).
- **Sun** (#e8703a dark; #e0662e light, #b8501f as text on light): the mark's sun, the accent half of the home
  headline. Nothing else.

### Neutral

- **Night** (#121510; light Sand #efe6d2): the page ground and the sidebar.
- **Olive** (#1d211a; light Paper #f8f3e7): code panels, labs, fields, the install chip. In light mode panels are
  lighter than the ground, like paper on sand.
- **Night Sunk** (#0d0f0b; light #e8dec7): the lab stage, a step below its panel.
- **Olive Raised** (#262b22; light #e7ddc6): hover fills and inline code.
- **Sand Ink** (#e8dcc0; light Ink #1f1c16), **Soft** (#b5ad97; light #534c3e), **Faint** (#9a947f; light #686150):
  text, secondary text, metadata. Every step holds 4.5:1 on the surfaces it sits on.
- **Hairline** (rgba(232,220,192,.09); light rgba(31,28,22,.12)) and **Hairline Strong** (.17 / .22): every division.

### Code hues

Lilac (#c4a5f7) for keywords, sand (#e6c87b) for strings, mint (#7fd1ae) for numbers and constants, sky (#79c0f2) for
types, with darker equivalents in light mode. Orange is not among them.

### Named Rules

**The Orange Is The Sun Rule.** Orange appears in the mark, in at most one highlighted phrase per view. It never fills a button, colours a link, or marks state.

**The True-Only Accent Rule.** Acacia is used for what is true or current: asserted answers, the active page, the
primary action, focus. It never decorates, and it never appears in syntax colours.

**The Warm Neutral Rule.** Neutrals lean warm and slightly green (olive and sand); nothing is a cold blue-grey.

## Typography

**Display and Body Font:** Schibsted Grotesk (with system sans)
**Code Font:** JetBrains Mono (with system mono)

**Character:** Schibsted Grotesk is sturdy and a little editorial, so long reference pages stay easy to read and the
hero and titles get their voice from weight and tight tracking, not from a second face. Ligatures are off in mono so
`=>` shows as typed.

### Hierarchy

- **Display** (660, clamp(2.5rem, 1.2rem + 5.2vw, 4.75rem), 1.02, -0.04em): the home headline only; its second sentence is in Sun.
- **Headline** (680, 42px, 1.08, -0.035em): page titles, followed by an 18px lede in Ink Soft.
- **Title** (650, 26px, 1.2, -0.025em): h2. **Subhead** (620, 19px): h3.
- **Body** (400, 16px, 1.75): prose held to 68ch.
- **Label** (500, 12.5px): facts, table heads, captions; sentence case, never uppercase and never mono.
- **Code** (400, 13.5px, 1.75): blocks and labs; inline code at 0.86em on Olive Raised with a hairline.

### Named Rules

**The Mono Means Data Rule.** Monospace is for code, import paths, sizes and numbers you could type. Headings and labels
stay in Schibsted Grotesk.

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
- **Primary:** Acacia fill, Night text (white in light mode); hover lightens; pressing moves 1px down; a trailing arrow
  nudges 2px right.
- **Quiet:** transparent, 1px Hairline Strong; hover fills Olive Raised.

### Inputs / Fields

- **Style:** Olive fill, 1px Hairline Strong, 10px corners, mono 15px, 44px.
- **Focus:** 2px acacia outline offset 2px. No halo glow.
- **Range:** a 4px track and a 20px acacia thumb with a 3px ground-coloured ring.

### Chips and tabs

- **Chips:** 32px, 8px corners, hairline; selected is Acacia text on the 13% accent wash with an accent hairline.
- **Tabs:** name in 600 weight with a quiet second word; the selected tab has a 2px acacia underline that scales in.

### Navigation

- **Nav bar:** 56px, translucent ground with a 14px backdrop blur (content scrolls under it) and a hairline below. The
  mark (22px, a light and a dark file) and "Hyrax" at 17px left; a 36px search pill with a Ctrl K key; links at 14px; theme switch; GitHub.
- **Sidebar:** group titles at 13px 650 with the import path in small mono beneath; items at 13.5px in Soft text;
  the active page is Acacia on an accent wash with 8px corners.
- **Pager:** two hairline links with 12px corners; hover raises to Olive.

### Code Block (signature)

An Olive panel with a hairline and 12px corners. A 40px header bar holds the checker's state at the left (shape, then
words: "Run, answers asserted", "Type-checked, not run", "Not checked") and the copy button at the right. Answers
(`// => value`) align in one column; an asserted literal is Acacia, semi-bold, with a small disc-tick after it;
prose answers stay a quiet italic comment; an answer that no longer matches is struck through in the danger colour.

### Lab (signature)

A two-part panel: an inset Night Sunk stage with real controls (range, text field, chips) and a code side with the
same header bar reading "Computed live by the library". Its answers come from the actual source through the build's
alias, so the numbers on the page are the library's. The Numbers lab draws a track: the allowed range as a wash, the
raw value as a hollow dot, what `clamp` keeps as an acacia dot joined by a dashed line.

### Size Table (signature)

A table of what each import costs, with an acacia bar per row scaled to the largest. The bars grow once, in
sequence, when the table scrolls into view, and stay drawn without script or under reduced motion.

## Do's and Don'ts

### Do:

- **Do** keep acacia for what is true or current: asserted answers, the active page, the main action.
- **Do** take the mark and colours from `brand/` (`mark-light.svg`, `mark-dark.svg`, `palette.json`) rather than redrawing them.
- **Do** give every code block its state in the header, by shape and words; add new example pages to `sheets.ts` so their facts row exists.
- **Do** build new demos as labs: real controls on the stage, results computed by the source, never typed in.
- **Do** keep motion to state changes of 120-250ms with an exponential ease-out, and honour reduced motion.
- **Do** keep muted text at 4.5:1 or better on the surface it sits on, in both themes.

### Don't:

- **Don't** draw the animal, a mascot or any character; the mark is two stones and a sun, from `brand/`.
- **Don't** use orange for a control, a link, a state or a syntax colour; it is the sun.
- **Don't** put grid paper, dot grids, grain or any pattern behind content.
- **Don't** use gradient text, glowing halos, or a colored side border above 1px.
- **Don't** set labels or headings in monospace, or uppercase eyebrow labels above headings.
- **Don't** nest panels inside panels or lay out a page as a grid of identical icon cards.
