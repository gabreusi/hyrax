# Numbers

Small functions for the arithmetic that shows up in every UI and game: keeping a value in range, blending two values,
turning a value into a fraction of a range, moving a value from one range to another, wrapping around a range,
snapping to a grid, and stepping toward a goal.

<NumberLab />

## `clamp`

`clamp(value, min, max)` keeps `value` inside the range. With two arguments the second one is the maximum, and there
is no minimum.

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

## `wrap`

`wrap(value, min, max)` is the cyclic sibling of `clamp`: a value that runs past one end of the range comes back in at
the other, the way an angle wraps at 360 or a carousel goes from the last slide to the first. `min` is included and
`max` is not. With two arguments the range is `[0, max)`, which is what a list index needs.

```ts
wrap(370, 360); // => 10
wrap(-1, 3); // => 2
wrap(12, 0, 10); // => 2
wrap(5, 10, 0); // => 5
```

Like `clamp`, it accepts the bounds in either order. An empty range gives `min`, and a value that is not finite gives
`NaN`, since there is no sensible place to wrap infinity to.

## `inRange`

`inRange(value, min, max)` checks that `min <= value < max`. The end is excluded so that ranges that touch, such as
`[0, 10)` and `[10, 20)`, never both claim a value. With two arguments the range is `[0, max)`, so `inRange(i, list.length)`
checks an index. `NaN` is never in range.

```ts
inRange(5, 0, 10); // => true
inRange(10, 0, 10); // => false
inRange(2, 3); // => true
inRange(5, 10, 0); // => true
```

## `snap`

`snap(value, step = 1, origin = 0)` rounds to the nearest point of a grid that goes through `origin` every `step`. The
result is rounded to the decimal places of `step`, so the float error of the arithmetic does not leak out.

```ts
snap(7, 5); // => 5
snap(8, 5); // => 10
snap(0.1 + 0.2, 0.1); // => 0.3
snap(12, 5, 1); // => 11
snap(2.6); // => 3
```

A `step` of `0`, or one that is not finite, leaves the value as it is instead of returning `NaN`. Halfway values round
up, as with `Math.round`.

## `approach`

`approach(current, target, delta)` moves `current` toward `target` by at most `delta`, and never past it. It is one step
of an animation or a game loop that must land exactly on its goal, where `current + speed` would overshoot and then
oscillate.

```ts
approach(0, 10, 3); // => 3
approach(9, 10, 3); // => 10
approach(10, 0, 4); // => 6
```

The sign of `delta` does not matter. An infinite `delta` arrives at once, and a `delta` of `NaN` does not move instead of
turning the value into `NaN`.

## Reference

The full signatures, with every option and error, are in the API reference: [`clamp`](/api/hyrax/functions/clamp), [`lerp`](/api/hyrax/functions/lerp), [`ratio`](/api/hyrax/functions/ratio), [`remap`](/api/hyrax/functions/remap), [`wrap`](/api/hyrax/functions/wrap), [`inRange`](/api/hyrax/functions/inRange), [`snap`](/api/hyrax/functions/snap), [`approach`](/api/hyrax/functions/approach).
