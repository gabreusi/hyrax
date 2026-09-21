# Migrating from 0.x

Hyrax 1.0 is a rewrite of the 0.x package (`@gpsign/hyrax`), with the package name `@gabreusi/hyrax`. The API is
smaller, has named exports only, and fixes a number of bugs, some of which changed behaviour. This page lists what
became of everything.

## The map

| 0.x                                                                             | 1.0                                                                              |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `Hyrax` (the default object), `HyraxDOM`, `HyraxString`, `HyraxNumber`, `utils` | Removed. Use named imports                                                       |
| `map(x, inMin, inMax, outMin, outMax)`                                          | `remap(x, [inMin, inMax], [outMin, outMax])`                                     |
| `percent(v, hundred, zero)`                                                     | `ratio(v, max, min)`                                                             |
| `clamp` with numeric strings                                                    | `clamp` takes only `number`                                                      |
| `Random.number(min, max, digits)`                                               | `random.int(min, max)` or `random.float(min, max)`                               |
| `Random.uuid(n)`                                                                | `random.id(n)` (the new `uuid()` is a real version 4 UUID)                       |
| `Random.boolean(75)`                                                            | `random.boolean(0.75)`                                                           |
| a static `Random.<method>`                                                      | the `random` instance, or `new Random(seed)`; for tokens, `Random.secure()`      |
| `new StringBuilder(true)`                                                       | `new StringBuilder({ unique: true })`                                            |
| `StringBuilder.get(delim)`                                                      | `build(separator)`                                                               |
| `Suspend.addListener(cb, once)`                                                 | `new Suspend(options).on(cb, { once })`                                          |
| `nvl`                                                                           | `coalesce`                                                                       |
| `Nullun<T>`                                                                     | `Maybe<T>`                                                                       |
| `toNumber("2em")` (needed a DOM)                                                | `toPixels("2em")` in `/dom`                                                      |
| `getPropertySize`                                                               | `toPixels` in `/dom`                                                             |
| `useHTMLEventListener(ref, type, fn, deps)`                                     | `useEventListener(ref, type, fn)`, with no dependency array                      |
| `useUpdate`                                                                     | `useForceUpdate`                                                                 |
| `useInterval(..., { initial, stateless })`                                      | `useInterval(..., { autoStart })` (`isRunning` is always state)                  |
| `BlurListener`, `ChildrenRefs`, `useChildrenRefs`                               | `useClickOutside`, or `onClickOutside` outside React                             |
| `hx(Component)` with shortcut props such as `width`                             | `hx(Component)` only adds `rendered` and `transient`: use `style`, or `hx.<tag>` |
| `length`, `useAudioRecorder`, `getBoundingClientRect`, `getCSSProperties`       | Removed                                                                          |

## Behaviour that changed on purpose

These are bugs in 0.x that were fixed, so code that relied on them will notice.

**Numbers**

- `clamp(50, 5, 100)` returned the wrong number (its arguments were sorted as text). Now it is `50`.
- `remap` returns `outMin` for an input range of zero width, where 0.x divided by zero and gave `NaN` or `Infinity`.
  `ratio` returns `0` for an empty range.
- `percent` returned a fraction. The new name, `ratio`, says so.

**Strings and random**

- The case functions kept no digits, and now they do (`"foo2bar"` stays `"foo2bar"`), and they treat acronyms as one word.
- `Random` uses rejection sampling, so it has no modulo bias, and `boolean(50)` is an error and not "always true".
- `StringBuilder` applies a prefix once, and `unique` and `remove` compare the final text. In 0.x, `append("x", "a-")`
  followed by `remove("x")` removed nothing.
- `alias` no longer finds inherited names such as `toString`, and forwards `in` and `delete`.

**`Suspend`**

- It is an instance, and not a global. A first listener added ten minutes after the page loaded used to fire "suspended
  for 600 s"; the clock now starts when the timer does.
- It no longer touches `window`, and in Node the timer does not keep the process alive.

**DOM**

- `getPropertySize` measured with `position: fixed`, so a percentage was relative to the window and not to the container.
  `toPixels` measures inside the element you give it.
- A missing variable used to measure as the width of the parent. `toPixels` returns `NaN`.
- `useHTMLEventListener` removed a listener without its capture flag, so a capture listener was never removed.
- `BlurListener` decided "inside" by walking `parentElement`, which does not cross Shadow DOM and does not see a node that
  was removed. `onClickOutside` uses the event's `composedPath()`.

**React**

- `hx` no longer uses `React.memo` (it protected nothing, because `style` and `children` change on every render), uses
  `forwardRef`, has a `displayName`, and ignores `symbol` keys. Where a shortcut name is a real attribute
  (`<hx.canvas width>`) the prop is passed through.
- `hx(Component)` used to consume shortcut names such as `width` even when the component declared them itself.
- `Portal` no longer reads `document.body` while rendering, so it works in server rendering.
