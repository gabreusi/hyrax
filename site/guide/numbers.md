# Numbers

Four small functions for the arithmetic that shows up in every UI and game: keeping a value in range, blending two
values, turning a value into a fraction of a range, and moving a value from one range to another.

## `clamp`

`clamp(value, min, max)` keeps `value` inside the range. With two arguments the second one is the maximum, and the
minimum is `0`.

```ts
clamp(5, 0, 10); // => 5
clamp(-1, 0, 10); // => 0
clamp(11, 0, 10); // => 10
clamp(15, 10); // => 10
```

If you pass the bounds the wrong way round, `clamp` swaps them instead of returning nonsense:

```ts
clamp(5, 10, 0); // => 5
clamp(50, 5, 100); // => 50
```

It only takes numbers. The 0.x version also accepted numeric strings, and sorted its arguments as text, so
`clamp(50, 5, 100)` gave the wrong answer. A string is now a type error, and a `NaN` stays `NaN`.

## `lerp`

`lerp(a, b, t)` is linear interpolation: the value `t` of the way from `a` to `b`. It does not clamp `t`, so `t`
above `1` overshoots. That is what you want for extrapolation, and `clamp` is one call away when you do not.

```ts
lerp(0, 10, 0.5); // => 5
lerp(10, 20, 0.25); // => 12.5
lerp(0, 10, 2); // => 20
lerp(0, 10, clamp(2, 0, 1)); // => 10
```

## `ratio`

`ratio(value, max = 100, min = 0)` answers "how far along is `value` in the range", as a fraction. It returns a
fraction, and not a percentage, so that you can multiply it by anything and keep proportions. It does not clamp
either. An empty range (`max` equal to `min`) gives `0`, never `NaN`.

```ts
ratio(50); // => 0.5
ratio(30, 60); // => 0.5
ratio(75, 100, 50); // => 0.5
ratio(5, 0); // => 0
const progress = ratio(30, 60) * 200; // => 100
```

::: tip It used to be called `percent`
The old name promised a percentage and returned a fraction. See the [migration guide](/migration).
:::

## `remap`

`remap(value, [inMin, inMax], [outMin, outMax])` moves a value from one range to another. The ranges are pairs, so
the call reads the way you say it. An input range of zero width returns `outMin`, and the 0.x `map` returned `NaN`
or `Infinity`.

```ts
remap(5, [0, 10], [0, 100]); // => 50
remap(0.5, [0, 1], [10, 20]); // => 15
remap(5, [10, 0], [0, 100]); // => 50
remap(5, [3, 3], [0, 100]); // => 0
```

Combine it with `clamp` to keep the result in the output range:

```ts
clamp(remap(12, [0, 10], [0, 100]), 0, 100); // => 100
```

## Reference

The full signatures, with every option and error, are in the API reference: [`clamp`](/api/@gabreusi/hyrax/functions/clamp), [`lerp`](/api/@gabreusi/hyrax/functions/lerp), [`ratio`](/api/@gabreusi/hyrax/functions/ratio), [`remap`](/api/@gabreusi/hyrax/functions/remap).
