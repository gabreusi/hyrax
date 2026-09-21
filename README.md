# Hyrax

[![CI](https://github.com/gabreusi/hyrax/actions/workflows/ci.yml/badge.svg)](https://github.com/gabreusi/hyrax/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Docs](https://img.shields.io/badge/docs-gabreusi.github.io%2Fhyrax-blue.svg)](https://gabreusi.github.io/hyrax/)

A small TypeScript toolkit: seeded random, number and string helpers, and DOM and React utilities. Zero runtime
dependencies. Works in Node, browsers, Deno and Bun.

> **Status:** being rebuilt toward 1.0. The package is not published yet under its new name (`@gabreusi/hyrax`). The
> old 0.x code (`@gpsign/hyrax`) lives at the git tag `legacy-0.6.1`.

## Install

```sh
npm install @gabreusi/hyrax
```

## A first look

```ts
import { clamp, Random, StringBuilder, toKebabCase } from "@gabreusi/hyrax";

clamp(15, 0, 10); // => 10
toKebabCase("Hello World"); // => "hello-world"

const rng = new Random("level-1"); // the same seed gives the same numbers, in every runtime
rng.int(1, 100); // => 25

const classes = new StringBuilder().append("btn").if(true, "btn--primary").build(); // => "btn btn--primary"
```

## Entrypoints

| Import                  | Runs in                   | Contents                                                      |
| ----------------------- | ------------------------- | ------------------------------------------------------------- |
| `@gabreusi/hyrax`       | Anywhere                  | Numbers, strings, `Random`, `StringBuilder`, `Suspend`        |
| `@gabreusi/hyrax/dom`   | Browsers                  | `getCSSVar`, `toPixels`, `listen`, `onClickOutside`           |
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
