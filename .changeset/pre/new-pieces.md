---
"@gabreusi/hyrax": minor
---

New pieces, in the same spirit of overloads that shorten the common case and fallbacks instead of values that break:

- Numbers: `wrap` (the cyclic sibling of `clamp`), `inRange` and `snap` (rounding to a grid without float error).
- Strings: `toConstantCase`, `toTitleCase` and `truncate`, which never cuts an emoji or an accented letter in half.
- Helpers: `attempt` (`try`/`catch` as an expression, for promises too), `toBoolean` (the pair of `toNumber`),
  `toArray` and the `Arrayable<T>` type.
- `StringBuilder`: `append` takes a class map (`{ active: isActive }`), and a new `toggle`.
- `Random`: `int(max)` is `int(0, max)`.
- `/dom`: `setCSSVar`, the pair of `getCSSVar`, and `readStorage` / `writeStorage`, JSON in `localStorage` that never
  throws.
- `/react`: `useMediaQuery`, which renders its fallback on the server and while hydrating, so there is no mismatch.
