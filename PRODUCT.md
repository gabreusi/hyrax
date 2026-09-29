# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

TypeScript and JavaScript developers who arrive from npm or GitHub. First visit: they decide in about a minute whether
a small utility package is worth a dependency. Later visits: they come back to look up a signature, an option, an edge
case or an example. A secondary audience is existing users of the 0.x package (`@gpsign/hyrax`) who need to migrate.

## Product Purpose

Hyrax (`@gabreusi/hyrax`) is a small, isomorphic TypeScript toolkit whose functions are short to call and safe to call.
Each one accepts its input in every shape it really comes in, types each shape exactly, and has a defined answer for
every input its types allow. The documentation site
(https://gabreusi.github.io/hyrax/) exists so that a developer can adopt it with confidence and use it without reading
the source. Success: a visitor understands what each entrypoint is for, finds any function in two clicks or one search,
and trusts the examples.

## Positioning

- Two rules define every function (see `AGENTS.md`). A wide input surface, typed exactly: the common case has a short
  signature, the full form stays available, and the return type lists every value that can come back. A narrow failure
  surface: degenerate or missing input gives a neutral value, a fallback or a no-op, and only a configuration no correct
  program can write throws.
- Every code example in the guides and the API reference is type-checked against the built package, and the core ones
  are run; a trailing `// => value` is an assertion. The docs cannot silently drift from the code.
- `Random` is a contract: the same seed gives the same output in every runtime (Node, browsers, Deno, Bun) and only
  changes in a major version. No modulo bias (proven by exhaustive tests), a continuous `luck`, `fork`, `state`, dice
  notation, and a separate cryptographic mode.
- Three entrypoints split by where code can run: universal core, `/dom` (browser, safe to import on the server),
  `/react` (a thin layer over `/dom`). Not a React library.
- Every export has a size budget that fails the build (for example `clamp` about 76 B, all of `/dom` about 2.2 kB).

## Operating Context

Read in a browser next to an editor, often in dark mode, sometimes on a phone from a link. Built with VitePress (default
theme extended with a custom stylesheet and Vue components, local search) and a TypeDoc-generated API reference (`typedoc-plugin-markdown` + `typedoc-vitepress-theme`,
output in `site/api/`, git-ignored). Deployed to GitHub Pages under the base `/hyrax/`. `npm run docs:examples` checks
every ```ts fence in `site/guide/` (use `<!-- untested -->` before a fence to skip it), and `npm run docs:build` must
stay green.

## Capabilities and Constraints

- Entrypoints: `@gabreusi/hyrax` (clamp, lerp, ratio, remap, wrap, inRange, snap, approach, range, case functions, splitWords, slugify,
  interpolate, plural, truncate, StringBuilder, Random, random, Suspend, coalesce, attempt, fabricate, isNumeric, toNumber, toInteger, toBoolean, debounce, throttle, retry, timeout,
  toArray, traceHierarchy, alias, noop, types), `@gabreusi/hyrax/dom` (getCSSVar, setCSSVar, readStorage,
  writeStorage, observeSize, onVisible, copyText, onKey, lockScroll, toPixels, listen, onClickOutside), `@gabreusi/hyrax/react` (useEventListener, useClickOutside,
  useInterval, useMediaQuery, useStorage, useDebouncedValue, useSuspend, useHotkey, useScrollLock, useSize, useVisible, useForceUpdate, hx, Portal).
- Runtimes: Node 20+, current browsers (ES2022), Deno, Bun; React 18 and 19 as optional peers.
- Status: 1.0 release candidates are published to npm under `latest` (there is no stable version yet), so a plain install gets the newest one.
- Documentation language: English. Owner's chat language is Brazilian Portuguese.

## Brand Commitments

- Name: Hyrax. Identity chosen by the owner on 2026-09-29 and kept in `brand/` (mark SVGs, `palette.json`, a brand
  board and its README). The owner chose the name for the hyrax memes; the brand only hints at the animal.
- Voice already present in the guides: plain, exact, explains why, states limits honestly ("Limits worth knowing"), no
  hype. Keep it.
- Author: Gabriel Pantano Signorini. License: MIT.
- Visual direction from the owner (2026-09-21, still standing): a modern, beautiful docs site inspired by the Motion
  (framer-motion) and Zustand docs. Dark first, live demos beside code, plain language.
- Brand from the owner (2026-09-29, replaces the 2026-09-21 "wordmark and letter tile only" rule): the mark
  "Horizon", two stones with a sun on the horizon between them as the H's crossbar; the stones end in a one-sided heel,
  a hint of the hyrax's teeth and no more. Palettes Savanna & Sun (light) and Savanna Night (dark). Orange is the sun
  only; acacia green is the interactive colour in both modes. Schibsted Grotesk and JetBrains Mono. Tagline "Small.
  Sure-footed." No mascot and no drawn hyrax; vampire and fang themes were tried and rejected.
- Retired worlds, not to be revived: the green engineering grid paper ("The Computation Sheet"), the "Napkin Sketch"
  zine (hand-drawn boxes, cartoon mascot, cream paper with highlighters, handwritten fonts) and the sundial "Gnomon
  Plate". Grid or graph paper behind content stays out; green returns only as the acacia interactive colour.
- Keep the mechanism these worlds made visible: checked examples carry a mark that says what the checker did.

## Evidence on Hand

- Real numbers: the size table in `site/notes/design.md`, the luck table in `site/guide/random.md`, the runtime and test
  matrix in `site/notes/design.md`.
- Real, tested examples throughout `site/guide/`.
- No users, testimonials, download counts, stars or benchmarks exist. Never invent them.

## Product Principles

1. Truth over polish: every claim on the site is checkable, and examples are tests.
2. Small, independent pieces: show cost and scope per function, not per package.
3. Say the limit next to the feature.
4. Reference first: lookup speed matters more than first-impression spectacle.
