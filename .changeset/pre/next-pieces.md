---
"@gabreusi/hyrax": minor
---

A second batch of pieces:

- Core: `approach` (step toward a goal without overshooting), `toInteger`, `slugify`, `interpolate` (placeholders
  without a value stay visible instead of printing `undefined`), and `debounce` / `throttle` with `cancel()`, `flush()`
  and `pending`.
- `StringBuilder`: `has(text)` and `size`.
- `Random`: `sign()`, which gives `1` or `-1`.
- `/dom`: `observeSize` and `onVisible` (`ResizeObserver` and `IntersectionObserver` in the shape of `listen`), and
  `copyText`, which resolves to whether it worked and never rejects.
- `/react`: `useStorage` (state kept in `localStorage`, synced across tabs, hydration-safe), `useDebouncedValue` and
  `useSuspend`.
