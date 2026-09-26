# Design notes

Why Hyrax works the way it does: what it promises, where it runs, what a seed freezes, what each import costs, and how
the examples on these pages are kept honest.

## What it is

Hyrax is a toolkit of small, independent pieces, and not a framework and not a React library. The universal core has no
DOM and no React in its types (the compiler enforces it), and the code that needs a browser is in its own entrypoint.
There are only named exports, with no default export and no aggregate object, so a bundler can tell exactly what you
use.

## Runtimes

- **Using it:** Node 20 or newer, current browsers (the code is ES2022), Deno and Bun.
- **Testing it:** the unit tests run on Node 22, 24 and 26 (the test runner needs Node 22.12 or newer), in Chromium for
  everything that needs a real browser, and against React 18 and 19. The built package is installed from its tarball and
  smoke-tested in Node 20, 22, 24 and 26, through both ESM and CommonJS, and in Deno and Bun.
- **Server rendering:** every `@gabreusi/hyrax/dom` function and every `@gabreusi/hyrax/react` hook and component
  imports and renders where there is no `document`. This is a test for each one, and the smoke test renders `/react`
  with `renderToString` in Node, Deno and Bun.

## Determinism

<a id="determinism"></a>

A seed is a contract. For the same seed, and the same sequence of calls, `Random` gives the same output in every
runtime and in both module formats, and that output only changes in a major version. Adding a method is a minor
release.

- **Bit for bit, everywhere:** everything built on integer arithmetic. That is the engine, `next`, `int` and `roll`
  with no luck, `from`, `pop`, `shuffle`, `sample`, `weighted` with no luck, `date`, `id`, `uuid`, `bytes`, `fork` and
  `state`.
- **Within a rounding step:** what uses `Math.pow`, `Math.log` or `Math.cos`, that is, a `luck` other than zero, `normal`
  and `exponential`. ECMAScript does not require every engine to round those the same way. In practice V8 and
  JavaScriptCore agree, and the smoke test checks the same seeded values in Node, Deno and Bun, but the formal promise
  is only "within one rounding step".
- **What is frozen for a seed:** the engine (sfc32, seeded by cyrb128 with 12 outputs discarded), the formula of `next`,
  the rejection rule (which bits, how many draws), the luck transformation and its cap, how `fork` derives a seed, the
  `state` format, the formulas of `normal` and `exponential`, the grammar of `roll`, the cumulative order of `weighted`,
  that `sign` is one `boolean()` draw, and the layout of `uuid`, `bytes` and `token`.

The seeded generator is **not** cryptographic. Use `Random.secure()` for secrets.

## Size

<a id="size"></a>

Every function is its own export, and the package is marked `sideEffects: false`, with nothing running when a module is
imported, so a bundler keeps only what you use. Sizes are minified and compressed with Brotli, and each has a budget
that fails the build when it is exceeded:

| You import                     | Costs about |
| ------------------------------ | ----------- |
| `clamp`                        | 76 B        |
| `Random`                       | 3.2 kB      |
| the whole root entrypoint      | 6.5 kB      |
| `listen` from `/dom`           | 85 B        |
| the whole of `/dom`            | 2.2 kB      |
| `useForceUpdate` from `/react` | 96 B        |
| `hx` from `/react`             | 630 B       |
| the whole of `/react`          | 3.5 kB      |

React and React DOM are not counted: they are peer dependencies. The `Random` methods live on the class, and the five
extras (`weighted`, `sample`, `normal`, `exponential` and `roll`) are about 0.9 kB of it.

## Tested examples

<a id="tested-examples"></a>

A code example that has gone stale is worse than none, so the examples are checked:

- Every `@example` in the source, and every `ts` block in the guides, is **type-checked against the built package**,
  resolved through its `exports` map, so what is checked is what you get from npm.
- The examples of the universal core are also **run**. A trailing `// => value` on a line is an assertion, so
  `clamp(15, 0, 10); // => 10` fails the build if `clamp` ever stops returning `10`. The value has to be a literal;
  anything else after `=>` is prose (`// => 1 to 6`), and the line still runs.
- Examples for `/dom` and `/react` are type-checked but not run, because they need a browser or a component.

## Layers

`@gabreusi/hyrax/react` is built on `@gabreusi/hyrax/dom`, and the DOM entrypoint knows nothing about React. That is why
the build emits one small shared chunk for those two, and none for the root. The React entrypoint starts with
`"use client"`, and the root and the DOM entrypoints do not, so they stay usable from a Server Component.

## Stability

Hyrax follows semantic versioning. The public API is what is exported and documented here, and in the API reference.
Anything under `internal/` in the source, and every helper type that shapes a signature but is not exported, is not part
of the API.
