# Contributing

## Setup

Use Node 24 (`nvm use`, see `.nvmrc`; Node 22 or newer works) and install with `npm ci`.

## One-time setup for the browser tests

The `/dom` and `/react` tests that need a real browser (layout, Shadow DOM, real clicks) run in Chromium. Install it once with
`npx playwright install chromium` (on Linux CI: `--with-deps`). `npm test` needs none of this.

## Commands

| Command                  | What it does                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| `npm test`               | Runs the tests (`core` in Node, `dom` and `react` in happy-dom), without the browser                |
| `npm run test:browser`   | Runs only the tests that need a real browser (Chromium)                                             |
| `npm run test:coverage`  | Everything, browser included, with coverage. `src/core`, `src/dom` and `src/react` must stay at 95% |
| `npm run lint`           | ESLint. Every exported symbol needs TSDoc with an `@example`                                        |
| `npm run typecheck`      | Type-checks each entrypoint and the tests                                                           |
| `npm run check:boundary` | Fails if `src/core` starts compiling against DOM globals                                            |
| `npm run build`          | Builds `dist/` (ESM, CJS and type declarations)                                                     |
| `npm run check:package`  | `publint` and Are the Types Wrong on the built package                                              |
| `npm run size`           | Enforces the bundle-size budget (whole entrypoint and one function)                                 |
| `npm run bench`          | Prints how fast the `Random` methods are next to `Math.random` and `crypto` (a report, not a gate)  |
| `npm run smoke`          | Installs the packed tarball, imports every entrypoint and type-checks a consumer                    |
| `npm run check`          | Everything above, in CI order                                                                       |

## Rules of the repo

- `src/core` is universal: no `window`, `document` or Node-only APIs. The compiler enforces it (no DOM lib there).
- Only named exports. No default export and no aggregate object.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `build:`, `ci:`, `test:`, `chore:`).

## Writing TSDoc

Every exported function and type gets a summary, `@param`, `@returns` and an `@example`. The lint rule enforces
the summary and the `@example`; the rest is on review.

- Document **each overload** separately, since editors show the doc of the signature the caller matched. The
  linter only guarantees the first one, so check the others by hand.
- The lint rules apply to what is exported. Private members (`#field`, `private`) and everything under
  `src/core/internal/` are exempt. A class needs an `@example` on the class itself; document each public
  method with `@param` and `@returns`.
- Write examples as one statement per line with the result in a trailing `// => value` comment. A later phase
  runs these examples as tests, so keep them exact.
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
