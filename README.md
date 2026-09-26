# Hyrax

[![CI](https://github.com/gabreusi/hyrax/actions/workflows/ci.yml/badge.svg)](https://github.com/gabreusi/hyrax/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Docs](https://img.shields.io/badge/docs-gabreusi.github.io%2Fhyrax-blue.svg)](https://gabreusi.github.io/hyrax/)

A TypeScript toolkit whose functions are short to call and safe to call. Each one accepts its input in every shape it
really comes in, types each shape exactly, and has a defined answer for every input its types allow. Zero runtime
dependencies. Works in Node, browsers, Deno and Bun.

> **Status:** being rebuilt toward 1.0. The package is not published yet under its new name (`@gabreusi/hyrax`). The
> old 0.x code (`@gpsign/hyrax`) lives at the git tag `legacy-0.6.1`.

## Install

```sh
npm install @gabreusi/hyrax
```

## The idea

Every function in Hyrax follows two rules.

**It takes input in the shapes it really comes in, and types each shape exactly.** The common case gets a short
signature and the full form stays available. Overloads keep every form precise, the compiler infers the generics, and
the return type already lists every value that can come back, fallbacks included.

**It has an answer for every input its types allow.** Bounds work in either order, degenerate input gives a neutral
result instead of `NaN` or an endless loop, a missing target is a no-op, and code that needs a browser falls back on the
server instead of throwing. Hyrax throws only for a configuration no correct program
can write, because hiding a bug is worse than reporting it.

```ts
import { clamp, range, Random, StringBuilder, toKebabCase, toNumber } from "@gabreusi/hyrax";

clamp(15, 10); // => 10
clamp(5, 10, 0); // => 5
range(5, 0, 2); // => [5, 3, 1]
toNumber("abc"); // => 0
toKebabCase("Hello World"); // => "hello-world"

const rng = new Random("level-1"); // the same seed gives the same numbers, in every runtime
rng.int(1, 100); // => 25

const classes = new StringBuilder().append("btn").if(true, "btn--primary").build(); // => "btn btn--primary"
```

The full list of rules, with the reason for each, is in [AGENTS.md](./AGENTS.md).

## Entrypoints

| Import                  | Runs in                   | Contents                                                      |
| ----------------------- | ------------------------- | ------------------------------------------------------------- |
| `@gabreusi/hyrax`       | Anywhere                  | Numbers, strings, `Random`, `StringBuilder`, `Suspend`        |
| `@gabreusi/hyrax/dom`   | Browsers                  | `listen`, `onClickOutside`, `setCSSVar`, `readStorage`...     |
| `@gabreusi/hyrax/react` | React 18+ (optional peer) | `useEventListener`, `useClickOutside`, `useInterval`, `hx`... |

## Documentation

The guides, the design notes, the migration guide from 0.x and the generated API reference are at
**<https://gabreusi.github.io/hyrax/>**. Every example in them is type-checked against the built package, and the ones
for the core are run.

## Requirements

Node 20 or newer. TypeScript consumers need `moduleResolution` set to `node16`, `nodenext` or `bundler` (the `/dom`
and `/react` subpaths use the package `exports` map).

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
