# Design rules

These are the rules every contribution to Hyrax follows, whether a person or an AI agent writes it. They are
requirements, not a tour of the features. Each rule gives its reason and an example from the code. For commands see
[CONTRIBUTING.md](CONTRIBUTING.md#commands); for what the package promises its users see
[the design notes](site/notes/design.md); for why the 1.0 looks the way it does see
[the revival spec](docs/superpowers/specs/2026-09-18-hyrax-revival-design.md) (in Portuguese).

## The idea

Hyrax exists to make each call site short and each call safe. Two properties define it, and a piece that lacks
either does not belong:

- **A wide input surface, typed exactly.** A function accepts every form its input really comes in, with overload
  signatures that make the common case short and the full form available. The overloads are the contract: the
  compiler picks the one that matches, infers the generics, and gives a return type that already includes every value
  that can come back, fallbacks included. Flexibility never costs type precision.
- **A narrow failure surface.** A function is total over its data: every input the types allow has a defined result,
  and degenerate or missing input maps to a neutral value, a caller-chosen fallback or a no-op instead of an
  unplanned `NaN` or `undefined`, an endless loop or an exception. Nothing depends on the runtime at import, so the
  same code works on a server, in a browser and in a test. The only thing that fails loudly is a configuration no
  correct program can write, because hiding a bug is worse than reporting it.

Sections 1 to 5 turn these two properties into rules. The rest is what a library that makes this promise also needs.

## 1. Overloads: short for the common case, full for control

- **Give the common case a shorter signature, and keep the full form.** `clamp(v, max)` next to `clamp(v, min, max)`;
  `range(end)` next to `range(start, end, step?)`; `rng.int(max)` next to `rng.int(min, max)`. Reason: most calls use
  one bound, and they should not have to spell out the other.
- **Accept `number | Options` when a function has one main setting and a few rare ones.** `debounce(fn, 300)` and
  `debounce(fn, { wait: 300, maxWait: 1000 })`; the same for `throttle`, `retry` and `truncate`. Reason: the number
  covers nearly every call, and adding an option later does not break it.
- **Accept the shapes the input really comes in.** `Random.from` takes an array, a string or a record; `append` takes a
  string or a class map (`{ active: isActive }`); `listen` takes a window, a document, an element or any `EventTarget`.
- **When two overloads can match the same call, the narrower one comes first.** TypeScript picks the first overload
  that matches, so a wide one placed first hides the others. Example: `retry` lists `RetryOptionsWithFallback<F>`
  before `RetryOptions`, and `listen` lists `Window`, `Document` and `HTMLElement` before `EventTarget`.
- **Each overload has its own TSDoc and its own `@example`.** Editors show the doc of the overload the caller matched.
- **Generics are inferred from the arguments, never required.** `toInteger("x", null)` is typed `number | null` with no
  type argument. An explicit argument is allowed only to widen a literal (`useStorage<"light" | "dark">(...)`).
- **The return type follows the fallback.** `toBoolean<T>(value, fallback: T): boolean | T`,
  `attempt<T, F>(...): Attempted<T, F>` (a promise when `callback` returns one), `timeout(work, ms, fallback)` gives
  `Promise<T | F>`. Reason: the caller must see in the type every value that can come back.

## 2. Total functions over data

- **Accept bounds in either order.** `clamp(5, 10, 0)` is `5`, `wrap(5, 10, 0)` is `5`, `inRange(5, 10, 0)` is `true`,
  `Random.float(20, 10)` works. Reason: the order of two numbers is not worth a bug.
- **Give degenerate input a neutral result.** An empty range: `ratio(5, 5, 5)` is `0`, `remap` returns the start of the
  output range, `wrap` returns `min`. A step of `0`: `snap(3, 0)` is `3`, `range(0, 10, 0)` is `[]`. A length below `1`:
  `truncate("Hi", 0)` is `""`. Out-of-range settings fall back to their default: a `retry` `times` of `NaN` means `3`.
- **Never loop forever on a wrong sign.** `range(5, 0, 2)` is `[5, 3, 1]`: the direction comes from the bounds, not from
  the sign of `step`. `approach` ignores the sign of `delta`.
- **A `null` or `undefined` target is a no-op.** `listen(null, "click", fn)` returns a working `off()`, `toArray(null)`
  is `[]`, `observeSize(null, fn)` observes nothing. Reason: refs are `null` before mount.
- **Never return `undefined`, `"undefined"` or `"NaN"` by accident.** `interpolate("Hi, {name}", {})` leaves `{name}`
  in place instead of writing `"undefined"`. When a sentinel is the right answer, the type and the TSDoc say so:
  `toPixels` returns `NaN` because `0` is a real size; `Random.from([])` is typed `T | undefined`.

## 3. Fallback or throw

**Rule.** Invalid _data_ or a missing _environment_ gives a fallback, a no-op or `false`. An impossible _configuration_,
which only a programmer can write, throws a `RangeError` (or a `TypeError` for a wrong shape, an `Error` otherwise).
Reason: data and environments vary at run time and the caller cannot always prevent them; a configuration error is a
bug, and hiding a bug is worse than failing loudly.

| Data or environment: falls back                             | Configuration: throws                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------- |
| `toNumber("abc")` gives `0`                                 | `random.boolean(50)`: a chance is `0..1`, not a percentage    |
| `readStorage` on blocked storage or bad JSON gives fallback | `new Suspend({ threshold: 0 })`: it would fire constantly     |
| `writeStorage` when storage is full gives `false`           | `traceHierarchy` on a cycle: corrupt data it must not swallow |
| `copyText` without a clipboard resolves to `false`          | `alias` with the same alias on two keys                       |
| `getCSSVar` on the server gives its fallback                | `random.roll("2d")`: the message points at the bad piece      |
| `timeout(work, ms, fallback)` gives `fallback` when late    | `new Random({ luck: NaN })`, `random.sample(items, -1)`       |
| `lockScroll()` on the server returns a no-op                | `Random.restore(null)`: a wrong shape is a `TypeError`        |

- **`Random` treats its arguments as configuration.** `int(1.2, 1.8)` throws instead of guessing, because a silent
  substitute would change a seeded sequence with no warning.
- **A fallback must never weaken a guarantee.** `Random.secure()` throws without `crypto.getRandomValues` and never
  falls back to `Math.random`, because a secret that is quietly predictable is worse than an error.
- **Error messages name the function and say what was received and what was expected.** Good:
  `boolean() needs a chance between 0 and 1, got 50.`
- **`@throws` documents configuration errors only.** Data and environment problems are described as fallbacks.

## 4. Subscriptions

- **Anything that subscribes returns `off()`, and `off()` is idempotent.** `listen`, `onClickOutside`, `onKey`,
  `onVisible`, `observeSize`, `Suspend.on` and `lockScroll` return a function that can be called any number of times;
  `listen` keeps an `active` flag, `lockScroll` a `released` flag. Reason: cleanup runs twice in StrictMode and in
  hand-written teardown code.
- **A `null` target returns a working no-op**, never `undefined`, so `off()` can always be called.
- **Hooks read handlers from the latest render through `useLatest`**, so they take no dependency array and do not
  subscribe again when an inline callback changes (`useEventListener`, `useClickOutside`, `useInterval`, `useHotkey`,
  `useSuspend`). Only options that change what is listened to subscribe again.

## 5. Isomorphism and server rendering

- **The core is universal.** `src/core` compiles without the DOM lib and without `@types/node`; `check:boundary` fails
  otherwise. Structural types stand in for platform ones: `AbortSignalLike`, the `Host` interface in
  `src/core/internal/host.ts`.
- **`/dom` imports and runs on the server as a no-op or a fallback**, and never imports from `src/core` (a shared chunk
  would tie the two entrypoints together over a one-line function; see the local `noop` in `src/dom/listen.ts`).
- **`/react` is a thin layer over `/dom`** and is the only entrypoint marked `"use client"` (added by the banner in
  `tsdown.config.ts`). The root and `/dom` stay usable from a Server Component.
- **Read globals at call time, never at import.** The core goes through `host()`; `/dom` checks
  `typeof document === "undefined"` inside the function. Reason: fake timers and stubs installed after the module loads
  must be honoured, and a server has no `window` at import.
- **Hydration never mismatches.** A hook that reads synchronous browser state uses `useSyncExternalStore` with the
  fallback as the server snapshot (`useMediaQuery`, `useStorage`, `Portal`). A hook that needs an observer starts from a
  fixed value in `useState` and updates in an effect (`useSize`, `useVisible`).
- **Defaults that depend on the machine are fixed.** `plural` defaults to `"en"`, not the machine's locale, so the
  server and the browser write the same text.

## 6. Public API and versioning

- **The public API is exactly the named exports of the three entrypoints, plus their types.** Anything under
  `internal/`, and helper types listed in `intentionallyNotExported` in `typedoc.json`, are not part of it.
- **The surface tests pin it.** `src/index.test.ts`, `src/dom/index.test.ts` and `src/react/index.test.ts` list every
  runtime export. Changing that list is an API decision, made on purpose.
- **SemVer.** Removing or renaming an export, narrowing what a parameter accepts, or widening what a return type can be
  is a major. Adding an export, an overload or an option is a minor. A fix that makes the code match its documentation
  is a patch. (Widening a return type as a major, and the patch rule, are proposals for the owner to confirm.)
- **For `Random`, changing the output for a seed is a major**, whatever the reason. See
  [Determinism](site/notes/design.md#determinism) for what is frozen; the vectors in `random*.test.ts` and in
  `scripts/smoke.mjs` change only with a major.
- **A change that users can see adds a changeset** (`npm run changeset`); tests, tooling and docs add none.

## 7. Deprecation (proposal, needs the owner's confirmation)

- Mark the export, or the overload, with `@deprecated` in its TSDoc and name the replacement, for example
  `@deprecated Use wrap instead.`
- Keep it working for at least one minor release, with a changeset that announces it.
- Remove it only in a major, listed in the migration guide.
- No runtime warning: a `console.warn` is a side effect and costs bytes in every bundle.

## 8. Size, tree-shaking and dependencies

- **Only named exports.** No default export and no aggregate object; the surface tests check `"default" in root`.
- **Nothing runs at import.** The package is `sideEffects: false`. No top-level `new Map()`, `new Set()`,
  `Array.from(...)`, typed arrays or `**` constants: a bundler cannot prove a top-level call harmless and keeps it in a
  build that only imports `clamp`. Build lazily inside the function (`alphanumeric ??= ...` in
  `src/core/random-base.ts`) or write the literal (`MAX_SPAN = 9007199254740992`).
- **The only allowed module state is state that has to be global to be correct**, with a comment that says why: the
  `lockScroll` lock counter (two dialogs share one page) and the `useStorage` listener set (a write through one hook
  must reach the others in the same tab).
- **Zero runtime dependencies.** React and React DOM are optional peers, used only by `/react`.
- **Every budget in the `size-limit` section of `package.json` holds**, and `npm run size` fails the check otherwise. A
  budget goes up only on purpose, in the same change, with the new measurement in the description. A size written in the
  docs is a measurement, not a guess.

## 9. Immutability

- **Never mutate an input unless the name says so.** `Random.pop(array)` removes from `array`; `shuffle` and `sample`
  return new arrays; `toArray(list)` copies even when `list` is already an array. A builder mutates itself and returns
  `this` (`StringBuilder.append`).

## 10. Types

- **`strict` with `noUncheckedIndexedAccess`** (`tsconfig.base.json`). No `any` in a public signature; use `unknown`
  and narrow.
- **Narrow with type predicates.** `isNumeric(value): value is Numeric`.
- **Accept `readonly` inputs** when nothing is written: `shuffle<T>(array: readonly T[])`,
  `remap(value, readonly [number, number], ...)`.
- **Write source that compiles against React 18 and 19.** Do not name `RefObject` in a signature; use `RefLike<T>` and
  `MaybeRef<T>`.

## 11. Security

- **Read user-shaped keys with `Object.hasOwn`.** `interpolate("{constructor}", {})` must not print the inherited
  function; `hx` must not find `toString` on its attribute table.
- **No `eval`, no `new Function`, no dynamic code.**
- **`Random` is not cryptographic.** Seeded output is predictable by design. Only `Random.secure()` is fit for secrets,
  and `token()` exists only there.

## 12. Naming

- `to*` converts (`toNumber`, `toPixels`, `toArray`), `is*` narrows (`isNumeric`), `on*` subscribes and returns `off()`
  (`onKey`, `onVisible`, `Suspend.on`), `use*` is a hook, a noun is a class (`Random`, `Suspend`, `StringBuilder`).
- An options interface is named `<Name>Options`: `DebounceOptions`, `TruncateOptions`, `OnKeyOptions`,
  `UseIntervalOptions`.

## 13. Documentation is a contract

- **Every export has TSDoc**: a summary, `@param`, `@returns`, an `@example` for each overload, and `@throws` only for
  configuration errors. The linter enforces the summary and the examples; the rest is on review.
- **A trailing `// => literal` is an executed assertion** in the core (`clamp(15, 0, 10); // => 10` fails the build if it
  stops being `10`). Anything else after `=>` is prose. See `scripts/check-examples.mjs`.
- **State the limit next to the feature**, in the TSDoc and in the guide: `Suspend` reads the wall clock; a seeded
  `shuffle` reaches every permutation only up to 34 items.
- **No number without a measurement.** Sizes, speeds and counts come from `npm run size`, `npm run bench` or a test. No
  users, downloads or benchmarks are invented.

## 14. Tests

- **Unit tests sit next to the code** (`name.test.ts`).
- **`/dom` and `/react` also get a server test** (`// @vitest-environment node`, `renderToString` for React) that checks
  the fallback instead of a throw, and a **real-browser test** (`name.browser.test.ts`) wherever happy-dom would pass
  without proving anything: layout, Shadow DOM, real clicks, capture listeners. Hooks also run in StrictMode.
- **Property tests (`fast-check`) cover numeric invariants** (`number.test.ts`, `luck.test.ts`, `random.test.ts`).
- **A test that guards a subtle behaviour is shown to fail when the behaviour breaks**: break the code, watch the test
  fail, restore it. Examples: the hydration fallback of `useMediaQuery`, an abort during a `retry` wait, a capture
  listener that must be removed.
- **Coverage stays at 95% or more** in `src/core`, `src/dom` and `src/react` (`vitest.config.ts`).

## 15. Scope: when a new piece belongs

A piece belongs only if all three hold:

1. It completes a family that already exists (`wrap` next to `clamp`, `setCSSVar` next to `getCSSVar`, `toBoolean`
   next to `toNumber`).
2. It follows sections 1 to 5.
3. The language or the platform does not already cover it.

Rejected on purpose:

- `pick`, `omit`, `sum`, `groupBy` and other lodash clones: one line of modern JavaScript, or `Object.groupBy`
  (the owner's decision).
- Fake data generators, `poisson`, `bigint` draws, Perlin noise, an alias table for huge `weighted` lists (spec,
  section 4). They are compatible additions and can wait.
- Entrypoints for other frameworks (`/vue`, `/svelte`) for now; the `/dom` layer keeps them possible (spec, "Fora de
  escopo").
- Cryptographic guarantees for seeded `Random`, compatibility with the 0.x API, and the `stateless` mode of
  `useInterval` (spec, "Fora de escopo").
- Pieces removed in 1.0: `length`, `useAudioRecorder`, `ChildrenRefs`, `BlurListener`, `getBoundingClientRect`,
  `getCSSProperties`, the `Any`/`Widen`/`Count`/`Index`/`AnyRecord` types (spec, section 1).

## Known gaps

What these rules require and the code does not do yet:

- **The surface tests pin runtime exports only.** A type removed from an entrypoint (`RetryOptions`, `Arrayable`) fails
  no test.
- **Not every export has its own size budget.** `lerp`, `wrap`, `toArray`, `getCSSVar`, `onClickOutside`, `useSize` and
  others are covered only by the budget of their whole entrypoint.
- **Module-level work and state outside the allowed cases**: `new Set` in `src/core/numeric.ts`, `2 ** 31 - 1` in
  `src/core/timing.ts`, the `new Map` caches in `src/react/hx.tsx`, the lazy caches in `random-base.ts`, `float.ts` and
  `dice.ts`, the shared `/g` regex in `src/dom/internal/vars.ts`.
- **A missing timer throws instead of falling back** in `retry`, `debounce`, `throttle` and `Suspend.on`, while
  `timeout` silently sets no timer.
- **Some error messages lack the function or the received value** (`date()`, `weighted()`, `Random.restore()`, the timer
  errors).
- **No deprecation policy is in force** (section 7 is a proposal).

## Checklist for a new export

1. Pass the admission test (section 15).
2. Design the overloads: the short form, the full form, `number | Options` if it fits, narrowest first (section 1).
3. Decide, for every bad input, fallback or throw (section 3), and make the return type show the fallback.
4. Handle server rendering: no global at import, a fallback without `document`, `useSyncExternalStore` or a fixed
   initial state in a hook (section 5).
5. Write the TSDoc: summary, `@param`, `@returns`, `@example` with `// =>` for each overload, `@throws` for
   configuration errors, and the limit.
6. Write the tests: unit, server (`/dom`, `/react`), browser where happy-dom proves nothing, property tests for numeric
   invariants. Break the code once to see each subtle test fail.
7. Add the name to the surface test of its entrypoint.
8. Add a `size-limit` entry with a measured budget.
9. Document it in its guide in `site/guide/`, with its limit.
10. Add it to the entrypoint list in `PRODUCT.md`.
11. Add a changeset (`minor` for a new export).
12. Run `npm run check`.
