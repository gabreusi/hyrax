# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

TypeScript and JavaScript developers who arrive from npm or GitHub. First visit: they decide in about a minute whether
a small utility package is worth a dependency. Later visits: they come back to look up a signature, an option, an edge
case or an example. A secondary audience is existing users of the 0.x package (`@gpsign/hyrax`) who need to migrate.

## Product Purpose

Hyrax (`@gabreusi/hyrax`) is a small, isomorphic TypeScript toolkit: number and string helpers, a seeded random
generator, a suspend detector, DOM utilities and a thin React layer. The documentation site
(https://gabreusi.github.io/hyrax/) exists so that a developer can adopt it with confidence and use it without reading
the source. Success: a visitor understands what each entrypoint is for, finds any function in two clicks or one search,
and trusts the examples.

## Positioning

- Every code example in the guides and the API reference is type-checked against the built package, and the core ones
  are run; a trailing `// => value` is an assertion. The docs cannot silently drift from the code.
- `Random` is a contract: the same seed gives the same output in every runtime (Node, browsers, Deno, Bun) and only
  changes in a major version. No modulo bias (proven by exhaustive tests), a continuous `luck`, `fork`, `state`, dice
  notation, and a separate cryptographic mode.
- Three entrypoints split by where code can run: universal core, `/dom` (browser, safe to import on the server),
  `/react` (a thin layer over `/dom`). Not a React library.
- Every export has a size budget that fails the build (for example `clamp` about 76 B, all of `/dom` about 1.1 kB).

## Operating Context

Read in a browser next to an editor, often in dark mode, sometimes on a phone from a link. Built with VitePress (default
theme extended with a custom stylesheet and Vue components, local search) and a TypeDoc-generated API reference (`typedoc-plugin-markdown` + `typedoc-vitepress-theme`,
output in `site/api/`, git-ignored). Deployed to GitHub Pages under the base `/hyrax/`. `npm run docs:examples` checks
every ```ts fence in `site/guide/` (use `<!-- untested -->` before a fence to skip it), and `npm run docs:build` must
stay green.

## Capabilities and Constraints

- Entrypoints: `@gabreusi/hyrax` (clamp, lerp, ratio, remap, case functions, splitWords, StringBuilder, Random, random,
  Suspend, coalesce, fabricate, isNumeric, toNumber, traceHierarchy, alias, noop, types), `@gabreusi/hyrax/dom`
  (getCSSVar, toPixels, listen, onClickOutside), `@gabreusi/hyrax/react` (useEventListener, useClickOutside,
  useInterval, useForceUpdate, hx, Portal).
- Runtimes: Node 20+, current browsers (ES2022), Deno, Bun; React 18 and 19 as optional peers.
- Status: 1.0.0-rc.0, not yet published to npm. The docs must say so until the first release.
- Documentation language: English. Owner's chat language is Brazilian Portuguese.

## Brand Commitments

- Name: Hyrax. No existing logo, colors or mascot; the owner left the identity open (2026-09-21), including whether to
  use the animal.
- Voice already present in the guides: plain, exact, explains why, states limits honestly ("Limits worth knowing"), no
  hype. Keep it.
- Author: Gabriel Pantano Signorini. License: MIT.
- Visual direction from the owner (2026-09-21, replaces every earlier one): a modern, beautiful docs site inspired by
  the Motion (framer-motion) and Zustand docs. Dark first with a vivid accent, live demos beside code, plain language.
  No animal reference at all: no mascot, no drawn hyrax, no rock or sun motifs; the identity is the wordmark "Hyrax"
  and a letter tile.
- Retired worlds, not to be revived: the green engineering grid paper ("The Computation Sheet"), the "Napkin Sketch"
  zine (hand-drawn boxes, cartoon mascot, cream paper with highlighters, handwritten fonts) and the sundial "Gnomon
  Plate". Grid or graph paper behind content and green as the identity colour stay out.
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
