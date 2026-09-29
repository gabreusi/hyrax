---
"@gabreusi/hyrax": minor
---

A third batch of pieces:

- Core: `retry` (waits longer after each failure, with `retryIf`, an `AbortSignal` and an optional `fallback`) and
  `timeout` (rejects with a `TimeoutError`, or resolves to a fallback); `range`, with the shapes of `clamp` and no
  float drift; and `plural`, on `Intl.PluralRules`, for any language.
- `/dom`: `onKey` for keyboard shortcuts (`"mod+k"`, lists, aliases, safe in text fields) and `lockScroll`, counted and
  without the layout jump.
- `/react`: `useHotkey`, `useScrollLock`, `useSize` and `useVisible`.
