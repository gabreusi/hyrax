# Getting started

::: warning Not published yet
Hyrax 1.0 is being prepared. Until the first release these instructions describe what the package will do, and the
old 0.x code lives at the git tag `legacy-0.6.1`.
:::

## Install

```sh
npm install @gabreusi/hyrax
```

It works with npm, pnpm and Yarn, and the package ships ESM and CommonJS builds with their own type declarations.
There are no runtime dependencies. React and React DOM are optional peer dependencies that only `@gabreusi/hyrax/react`
needs.

## Entrypoints

Hyrax has three entrypoints, split by where the code can run:

| Import                  | Runs in                    | Contents                                                             |
| ----------------------- | -------------------------- | -------------------------------------------------------------------- |
| `@gabreusi/hyrax`       | Anywhere                   | Numbers, strings, `Random`, `StringBuilder`, `Suspend` and friends   |
| `@gabreusi/hyrax/dom`   | Browsers                   | `getCSSVar`, `toPixels`, `listen`, `onClickOutside`                  |
| `@gabreusi/hyrax/react` | React 18 and 19 (optional) | `useEventListener`, `useClickOutside`, `useInterval`, `hx`, `Portal` |

The React entrypoint is built on the DOM one, and the DOM one is plain JavaScript: if you use Vue, Svelte or no
framework at all, take the functions from `@gabreusi/hyrax/dom` and skip the hooks.

## A first look

```ts
import { clamp, Random, StringBuilder, toKebabCase } from "@gabreusi/hyrax";

clamp(15, 0, 10); // => 10
toKebabCase("Hello World"); // => "hello-world"

// The same seed gives the same numbers, in Node, in a browser, in Deno and in Bun.
const rng = new Random("level-1");
rng.int(1, 100); // => 25
new Random("level-1").int(1, 100); // => 25

const classes = new StringBuilder().append("btn").if(true, "btn--primary").build(); // => "btn btn--primary"
```

## TypeScript

Types are included. `moduleResolution` must be `node16`, `nodenext` or `bundler` so that TypeScript can follow the
`exports` map to `@gabreusi/hyrax/dom` and `@gabreusi/hyrax/react`. That is the default for every new project, and
the old `node10` setting cannot resolve any package with subpath exports.

## Where next

- One guide per module: [numbers](./numbers), [strings](./strings), [random](./random), [everyday helpers](./functions),
  [Suspend](./suspend), [DOM](./dom) and [React](./react).
- The [API reference](/api/) is generated from the source, so it always matches the code.
- Coming from 0.x? Read the [migration guide](/migration).
