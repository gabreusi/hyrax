---
version: 1
slug: "site"
primary_target: "site"
related_targets: []
---

# Hyrax documentation site

Scope: the whole VitePress site in `site/` (home, guides, notes, migration, generated API reference). Mode: Read; the
home is a landing inside a docs product and still leads with the reference. Audience and job: TS/JS developers deciding
in a minute whether to adopt, then returning to look up signatures, options and edge cases. Constraints: VitePress
default theme extended (not replaced), `docs:examples` and `docs:build` green, base `/hyrax/`, English copy, no
invented claims (no users, stars, downloads, benchmarks). Owner direction (2026-09-21, replaces every earlier one):
modern and beautiful, inspired by the Motion (framer-motion) and Zustand docs; dark first with a vivid accent; no
animal reference at all, wordmark only; theme + home + live demos on Numbers, Strings and Random. The retired worlds
are the green Computation Sheet, the Napkin Sketch and the Gnomon Plate.

## Direction contract

THESIS: Every page is a bench you can touch. Docs stop being text with pasted code: a function's answer is live beside
its code, computed by the real library, and the accent colour means one thing everywhere: this is true (an answer that
was asserted, the page you are on). It refuses the anonymous default-theme docs and the marketing landing.

OWN-WORLD: Warm graphite ground (#0d0c0b; light: warm paper #fbf9f6), panels one step up with 1px hairlines and
12-16px radii, no resting shadows. One vermilion accent (#ff6a3d; text-size ink #c8380e on light) that carries
active, verified and primary. Geist for everything, Geist Mono for code and numbers. Code panels have a header bar
(language, check state, copy). Demos are labs: an inset stage of real controls beside code whose results are computed live.

STORY: In one viewport the visitor reads what Hyrax is, sees a live lab answering with the real library, learns that
examples are tests, and installs or jumps to a guide. Later they arrive from search, land in a guide, and try the
function in the lab before reading on.

FIRST VIEWPORT: Centered column on the dark ground with a faint warm light from the top. Headline "Small functions.
Checked answers." at 72px, the second sentence in the accent. A 18px lede, then one row: the install chip with copy,
the primary "Get started" button and a quiet "API reference". Directly below, cropped by the fold, the wide lab panel
with Numbers, Strings and Random tabs. The nav is a slim 56px bar: tile mark and wordmark left, search pill, links,
theme toggle, GitHub.

FORM: pinned by the user (Motion docs and Zustand docs as references), so no roll ran and no seed key exists.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
