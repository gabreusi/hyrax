# @gabreusi/hyrax

## 1.0.0-rc.1

### Minor Changes

- [#33](https://github.com/gabreusi/hyrax/pull/33) [`fa47f90`](https://github.com/gabreusi/hyrax/commit/fa47f9066e2d85e85998890f86d1d526a70abd56) Thanks [@gabreusi](https://github.com/gabreusi)! - New pieces, in the same spirit of overloads that shorten the common case and fallbacks instead of values that break:

  - Numbers: `wrap` (the cyclic sibling of `clamp`), `inRange` and `snap` (rounding to a grid without float error).
  - Strings: `toConstantCase`, `toTitleCase` and `truncate`, which never cuts an emoji or an accented letter in half.
  - Helpers: `attempt` (`try`/`catch` as an expression, for promises too), `toBoolean` (the pair of `toNumber`),
    `toArray` and the `Arrayable<T>` type.
  - `StringBuilder`: `append` takes a class map (`{ active: isActive }`), and a new `toggle`.
  - `Random`: `int(max)` is `int(0, max)`.
  - `/dom`: `setCSSVar`, the pair of `getCSSVar`, and `readStorage` / `writeStorage`, JSON in `localStorage` that never
    throws.
  - `/react`: `useMediaQuery`, which renders its fallback on the server and while hydrating, so there is no mismatch.

- [#34](https://github.com/gabreusi/hyrax/pull/34) [`413823d`](https://github.com/gabreusi/hyrax/commit/413823d0d793c6c9521053e506fb70b737ac6227) Thanks [@gabreusi](https://github.com/gabreusi)! - A second batch of pieces:

  - Core: `approach` (step toward a goal without overshooting), `toInteger`, `slugify`, `interpolate` (placeholders
    without a value stay visible instead of printing `undefined`), and `debounce` / `throttle` with `cancel()`, `flush()`
    and `pending`.
  - `StringBuilder`: `has(text)` and `size`.
  - `Random`: `sign()`, which gives `1` or `-1`.
  - `/dom`: `observeSize` and `onVisible` (`ResizeObserver` and `IntersectionObserver` in the shape of `listen`), and
    `copyText`, which resolves to whether it worked and never rejects.
  - `/react`: `useStorage` (state kept in `localStorage`, synced across tabs, hydration-safe), `useDebouncedValue` and
    `useSuspend`.

- [#35](https://github.com/gabreusi/hyrax/pull/35) [`c2b3fda`](https://github.com/gabreusi/hyrax/commit/c2b3fda99e6302504356eeabb2c1d4b90c9cf707) Thanks [@gabreusi](https://github.com/gabreusi)! - A third batch of pieces:

  - Core: `retry` (waits longer after each failure, with `retryIf`, an `AbortSignal` and an optional `fallback`) and
    `timeout` (rejects with a `TimeoutError`, or resolves to a fallback); `range`, with the shapes of `clamp` and no
    float drift; and `plural`, on `Intl.PluralRules`, for any language.
  - `/dom`: `onKey` for keyboard shortcuts (`"mod+k"`, lists, aliases, safe in text fields) and `lockScroll`, counted and
    without the layout jump.
  - `/react`: `useHotkey`, `useScrollLock`, `useSize` and `useVisible`.

## 1.0.0-rc.0

### Major Changes

- Hyrax is rebuilt from scratch as an isomorphic TypeScript toolkit, and is now published as `@gabreusi/hyrax` (the 0.x package was `@gpsign/hyrax`).

  - **Three entrypoints, split by where the code runs.** `@gabreusi/hyrax` runs anywhere (numbers, strings, `Random`, `StringBuilder`, `Suspend` and more), `@gabreusi/hyrax/dom` needs a browser (`getCSSVar`, `toPixels`, `listen`, `onClickOutside`), and `@gabreusi/hyrax/react` has the hooks, `hx` and `Portal` for React 18 and 19. ESM and CommonJS builds with their own types, no runtime dependencies, tree-shakeable, and safe to render on the server.
  - **`Random` is reproducible and has no bias.** A seed gives the same numbers in every runtime. It has an optional `luck`, `fork`, `state` and `restore`, weighted choices, dice notation, and `Random.secure()` for secrets.
  - **The DOM and React utilities were rewritten**, and they fix a number of bugs of 0.x: capture listeners that were never removed, percentages measured against the window and not the container, a click-outside that could not cross Shadow DOM, and a `Portal` that broke server rendering.
  - **Documented, and the examples are tests.** There is a site with a guide per module and a generated API reference, and every code example in them is checked against the built package.

  This is a breaking change from 0.x in every corner: the API uses named imports only, and several functions were renamed, changed or removed. The migration guide lists all of it: https://gabreusi.github.io/hyrax/migration
