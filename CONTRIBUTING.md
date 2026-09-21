# Contributing

## Setup

Use Node 24 (`nvm use`, see `.nvmrc`; Node 22 or newer works) and install with `npm ci`.

## One-time setup for the browser tests

The `/dom` and `/react` tests that need a real browser (layout, Shadow DOM, real clicks) run in Chromium. Install it once with
`npx playwright install chromium` (on Linux CI: `--with-deps`). `npm test` needs none of this.

## Commands

| Command                   | What it does                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm test`                | Runs the tests (`core` and `scripts` in Node, `dom` and `react` in happy-dom), without the browser            |
| `npm run test:browser`    | Runs only the tests that need a real browser (Chromium)                                                       |
| `npm run test:coverage`   | Everything, browser included, with coverage. `src/core`, `src/dom` and `src/react` must stay at 95%           |
| `npm run lint`            | ESLint. Every exported symbol needs TSDoc with an `@example`                                                  |
| `npm run typecheck`       | Type-checks each entrypoint and the tests                                                                     |
| `npm run check:boundary`  | Fails if `src/core` starts compiling against DOM globals                                                      |
| `npm run check:workflows` | Checks every third-party action in the workflows against its `action.yml`: the inputs and outputs it declares |
| `npm run build`           | Builds `dist/` (ESM, CJS and type declarations)                                                               |
| `npm run check:package`   | `publint`, Are the Types Wrong, and what the tarball holds (no source, nothing missing, under 100 kB)         |
| `npm run size`            | Enforces the bundle-size budget (whole entrypoint and one function)                                           |
| `npm run bench`           | Prints how fast the `Random` methods are next to `Math.random` and `crypto` (a report, not a gate)            |
| `npm run smoke`           | Installs the packed tarball, imports every entrypoint and type-checks a consumer                              |
| `npm run smoke:bundlers`  | Bundles the packed tarball with esbuild, Vite and webpack, and checks tree-shaking and size                   |
| `npm run docs:examples`   | Type-checks every code example (TSDoc, guides, README) against the built package, and runs the core ones      |
| `npm run docs:build`      | Generates the API pages with TypeDoc, then builds the VitePress site (a dead link fails it)                   |
| `npm run docs:dev`        | The same generation, then the site with live reload                                                           |
| `npm run check`           | Everything above, in CI order                                                                                 |

## Rules of the repo

- `src/core` is universal: no `window`, `document` or Node-only APIs. The compiler enforces it (no DOM lib there).
- Only named exports. No default export and no aggregate object.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `build:`, `ci:`, `test:`, `chore:`).
- **The lockfile is written by npm 10**, the npm that Node 22 ships and the oldest one CI installs with:
  `npx -y npm@10 install --package-lock-only --ignore-scripts`. A lockfile written by npm 12 failed `npm ci` on npm 10
  (`Missing: react@18.3.1 from lock file`) while npm 11 and 12 accepted it, and only the Node 22 job of the CI noticed.

## Writing TSDoc

Every exported function and type gets a summary, `@param`, `@returns` and an `@example`. The lint rule enforces
the summary and the `@example`; the rest is on review.

- Document **each overload** separately, since editors show the doc of the signature the caller matched. The
  linter only guarantees the first one, so check the others by hand.
- The lint rules apply to what is exported. Private members (`#field`, `private`) and everything under
  `src/core/internal/` are exempt. A class needs an `@example` on the class itself; document each public
  method with `@param` and `@returns`.
- Write examples as one statement per line with the result in a trailing `// => value` comment. They are tested:
  see "Writing documentation" below.
- Signed zero is not a meaningful difference in `number` helpers: compare with `===`, not `Object.is`, in tests.

## Testing and performance conventions

- **No work at module level in `src/core`.** No top-level `new Map()`, `Array.from(...)`, typed arrays or `**`
  constants: build them on first use inside the function, or write the literal. A bundler cannot prove a
  top-level call harmless, so it keeps it, and a build that only imports `clamp` starts carrying it. The
  `clamp only` budget in `size-limit` is the guard.
- **Test what a method does with exact draws.** `scripted(words)` (in `src/core/internal/scripted.ts`) serves the
  32-bit words you give it, so a test can prove a mapping for every bit pattern instead of sampling. It throws when
  the words run out, because cycling them can loop forever inside a rejection sampler.
- **Statistical tests use a fixed seed and compare with the theoretical value**, never with what the code happens
  to produce, so they are deterministic and still mean something.
- **A seed's output is a contract.** Vectors in `random*.test.ts` and the values in `scripts/smoke.mjs` may only
  change together with a major version.

## Testing `/dom`

- **Where a test goes.** Logic that a simulated DOM handles (events, cleanup, options) goes in `name.test.ts`
  (happy-dom). What needs a real browser goes in `name.browser.test.ts` (Chromium): layout (`em`, `%`, `dvh`,
  `calc()`), Shadow DOM event retargeting, real mouse clicks, and any regression that happy-dom would not notice.
  happy-dom does not resolve `%` or `dvh`, does not inherit custom properties from `<html>`, does not retarget
  shadow events, computes `composedPath()` when called (not at dispatch) and removes a capture listener even when
  the removal forgets the capture flag: a test for those behaviours passes there and proves nothing.
- **Server-side rendering.** Every function has a `name.ssr.test.ts` that starts with
  `// @vitest-environment node` and checks it returns its fallback (or a no-op) instead of throwing.
- **No imports from `src/core`.** `/dom` does not depend on the root entrypoint: an import from the core would
  make the build emit a chunk shared by the two and tie them together over a one-line function. (`/dom` does
  share one chunk with `/react`, which is built on it: that is the point of the layering.)

## Testing `/react`

- **Same three kinds of test as `/dom`.** `name.test.tsx` (happy-dom, with Testing Library), `name.ssr.test.tsx`
  (`// @vitest-environment node`, rendered with `renderToString`: nothing may read `document` or `window`
  while rendering) and `name.browser.test.tsx` (Chromium, real clicks with `userEvent` from `vitest/browser`).
- **Hooks are tested in StrictMode too.** It runs every effect twice in development: a hook that leaks a
  listener or a timer, or fires twice, shows up there.
- **Both React versions.** CI runs the `react` project, the type-check and the smoke test against React 18 and
  its types as well. Write source that compiles under both: do not name `RefObject` in a signature, since it
  means different things in 18 and 19.
- **`"use client"`** is added by the build to the `/react` entrypoint only (see `tsdown.config.ts`), and the
  smoke test fails without it.

## Writing documentation

The site is in `site/` (VitePress): a guide per module in `site/guide/`, the design notes in `site/notes/`, the migration
guide, and the API reference, which is **generated** from the TSDoc by TypeDoc into `site/api/` and never edited by hand.
`npm run docs:dev` shows it.

- **Examples are tests.** `npm run docs:examples` (it needs `npm run build` first) takes every `@example` in `src/`, every
  `ts` or `tsx` fence in `site/guide/` and in the README, and type-checks it against the **built package**, resolved through
  its `exports`. The examples of the universal core (and the guides for it) are also **run**. `/dom` and `/react` examples
  are type-checked only, because they need a browser or a component.
- **A trailing `// => value` is an assertion** when the value is a literal (a number, string, boolean, `null`, `undefined`,
  `NaN`, an array or an object of those): `clamp(15, 0, 10); // => 10`. Anything else after `=>` is prose (`// => 1 to 6`)
  and the line still runs. It must follow an expression or a single `const x = ...`.
- **Hyrax names are in scope**, imported for you from the right entrypoint. Write out every other import
  (`import { useRef } from "react";`), and declare whatever else the snippet uses: each example stands alone. A snippet
  that imports from a Hyrax entrypoint itself is left as it is.
- **To skip a fence** in a guide, put `<!-- untested -->` on the line before it.
- **Helper types that shape a signature but are not exported** are listed in `intentionallyNotExported` in
  `typedoc.json`; TypeDoc treats a warning as an error, so a new one has to be decided on.
- **Publishing.** The `docs` job of the CI builds the site on every pull request. `.github/workflows/docs.yml` deploys it
  to GitHub Pages from `main`, but only after Pages is set to deploy from GitHub Actions (Settings, Pages, Source) and the
  repository variable `DOCS_DEPLOY` is `true`.

## Releasing

Versions are decided by [Changesets](https://github.com/changesets/changesets), and published by the `release` workflow
with npm **trusted publishing**: there is no npm token in the repository, GitHub proves to npm which repository and
workflow is publishing (OIDC), and the package gets a provenance statement.

- **A pull request that changes what users see adds a changeset**: `npm run changeset` (pick `patch`, `minor` or
  `major`, and write the line for the changelog). One that changes nothing they see (tests, tooling, docs) adds none.
- **On `main`, the workflow opens a "Version Packages" pull request** with the new version and the changelog. **Merging
  it publishes**, creates the tag `vX.Y.Z` and the GitHub release.
- **The `rc` pre-release mode is on** until 1.0.0: versions are `1.0.0-rc.N` and are published under the dist-tag `rc`
  (`npm install @gabreusi/hyrax@rc`). To leave it, run `npx changeset pre exit` in a pull request, review the changesets
  in `.changeset/pre/` (they become the 1.0.0 changelog), and merge the "Version Packages" pull request that follows.
- **What the tarball holds is checked** (`npm run check:package`), and `npm publish` from a machine refuses a package that
  is private or still at the `0.0.0` placeholder (`prepublishOnly`).
- **The workflow does nothing until the repository variable `RELEASE_ENABLED` is `true`.** Its filename (`release.yml`) is part
  of the trusted publisher configuration on npm: renaming it breaks publishing until npm is told.
- **One-time setup.** npm can only configure a trusted publisher for a package that already exists, so the first version is
  published by hand, once, from a clean checkout of `main` at the version commit, with an npm account that has two-factor
  authentication on and owns the `@gabreusi` scope:

  ```sh
  npm login
  npm publish --tag rc           # prepublishOnly builds and checks first; this first version has no provenance
  git tag v1.0.0-rc.0 && git push origin v1.0.0-rc.0
  npm trust github @gabreusi/hyrax --file release.yml --repo gabreusi/hyrax --allow-publish
  ```

  `npm trust` needs npm 11.15 or newer. Then, in the repository settings, allow GitHub Actions to create and approve pull
  requests (Settings, Actions, General), and set the variable `RELEASE_ENABLED` to `true`. From then on every release is made
  by the workflow, and no npm token needs to exist.
