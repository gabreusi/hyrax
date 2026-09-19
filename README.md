# Hyrax

[![CI](https://github.com/gabreusi/hyrax/actions/workflows/ci.yml/badge.svg)](https://github.com/gabreusi/hyrax/actions/workflows/ci.yml)

An isomorphic TypeScript toolkit: seeded random, number and string helpers, and DOM and React utilities.
Zero runtime dependencies. Works in Node, browsers, Deno and Bun.

> **Status:** being rebuilt from scratch toward 1.0. The package is not published yet under its new name
> (`@gabreusi/hyrax`). The old 0.x code (`@gpsign/hyrax`) lives at the git tag `legacy-0.6.1`.

## Entrypoints

| Import                  | Runs in                   | Contents                             |
| ----------------------- | ------------------------- | ------------------------------------ |
| `@gabreusi/hyrax`       | Anywhere                  | Universal helpers (no DOM, no React) |
| `@gabreusi/hyrax/dom`   | Browsers                  | DOM utilities                        |
| `@gabreusi/hyrax/react` | React 18+ (optional peer) | Hooks and components                 |

## Requirements

Node 20 or newer. TypeScript consumers need `moduleResolution` set to `node16`, `nodenext` or `bundler`
(the `/dom` and `/react` subpaths use the package `exports` map).

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
