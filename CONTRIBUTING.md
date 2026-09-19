# Contributing

## Setup

Use Node 24 (`nvm use`, see `.nvmrc`; Node 22 or newer works) and install with `npm ci`.

## Commands

| Command                  | What it does                                                    |
| ------------------------ | --------------------------------------------------------------- |
| `npm test`               | Runs the tests (`core` in Node, `dom` and `react` in happy-dom) |
| `npm run test:coverage`  | Same, with coverage. `src/core` must stay at 95% or above       |
| `npm run lint`           | ESLint. Every exported symbol needs TSDoc with an `@example`    |
| `npm run typecheck`      | Type-checks each entrypoint and the tests                       |
| `npm run check:boundary` | Fails if `src/core` starts compiling against DOM globals        |
| `npm run build`          | Builds `dist/` (ESM, CJS and type declarations)                 |
| `npm run check:package`  | `publint` and Are the Types Wrong on the built package          |
| `npm run smoke`          | Installs the packed tarball and imports every entrypoint        |
| `npm run check`          | Everything above, in CI order                                   |

## Rules of the repo

- `src/core` is universal: no `window`, `document` or Node-only APIs. The compiler enforces it (no DOM lib there).
- Only named exports. No default export and no aggregate object.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `build:`, `ci:`, `test:`, `chore:`).
