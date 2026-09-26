/**
 * Restricts `value` to the range `[min, max]`. When `min` is greater than `max`
 * the bounds are swapped. `NaN` is returned as is.
 *
 * @example
 * ```ts
 * clamp(5, 0, 10); // => 5
 * clamp(-1, 0, 10); // => 0
 * clamp(11, 0, 10); // => 10
 * clamp(5, 10, 0); // => 5
 * ```
 *
 * @param value - The number to restrict.
 * @param min - One bound of the range.
 * @param max - The other bound of the range.
 * @returns `value` limited to the range.
 */
export function clamp(value: number, min: number, max: number): number;
/**
 * Caps `value` at `max`, with no lower bound.
 *
 * @example
 * ```ts
 * clamp(5, 10); // => 5
 * clamp(15, 10); // => 10
 * ```
 *
 * @param value - The number to cap.
 * @param max - The upper bound.
 * @returns `value`, or `max` when `value` is greater.
 */
export function clamp(value: number, max: number): number;
export function clamp(value: number, a: number, b?: number): number {
  const [lower, upper]: [number, number] =
    b === undefined ? [-Infinity, a] : a <= b ? [a, b] : [b, a];
  return Math.min(Math.max(value, lower), upper);
}

/**
 * Linear interpolation between `a` and `b`. Returns exactly `a` for `t = 0` and
 * exactly `b` for `t = 1`. Values of `t` outside `0..1` extrapolate.
 *
 * @example
 * ```ts
 * lerp(0, 10, 0.5); // => 5
 * lerp(10, 20, 0.25); // => 12.5
 * lerp(0, 10, 2); // => 20
 * ```
 *
 * @param a - The value at `t = 0`.
 * @param b - The value at `t = 1`.
 * @param t - The interpolation factor.
 * @returns The interpolated value.
 */
export function lerp(a: number, b: number, t: number): number {
  return (1 - t) * a + t * b;
}

/**
 * Where `value` sits inside the range `[min, max]`, as a fraction: `0` at `min`,
 * `1` at `max`. It is meant to be multiplied by other values to keep
 * proportions. It does not clamp, so the result can be negative or above `1`.
 * An empty range (`max === min`) gives `0`.
 *
 * @example
 * ```ts
 * ratio(50); // => 0.5
 * ratio(30, 60); // => 0.5
 * ratio(75, 100, 50); // => 0.5
 * ```
 *
 * @param value - The value to locate.
 * @param max - The upper end of the range.
 * @param min - The lower end of the range.
 * @returns The fraction of the range that `value` represents.
 */
export function ratio(value: number, max = 100, min = 0): number {
  const range = max - min;
  return range === 0 ? 0 : (value - min) / range;
}

/**
 * Maps `value` from one range to another. The ranges may be reversed and the
 * result is not clamped. When the input range is empty the start of the output
 * range is returned.
 *
 * @example
 * ```ts
 * remap(5, [0, 10], [0, 100]); // => 50
 * remap(0.5, [0, 1], [10, 20]); // => 15
 * remap(5, [10, 0], [0, 100]); // => 50
 * ```
 *
 * @param value - The value to map.
 * @param input - The `[min, max]` range `value` belongs to.
 * @param output - The `[min, max]` range to map into.
 * @returns The mapped value.
 */
export function remap(
  value: number,
  [inMin, inMax]: readonly [number, number],
  [outMin, outMax]: readonly [number, number],
): number {
  return lerp(outMin, outMax, ratio(value, inMax, inMin));
}

/** Orders two bounds, or treats a lone bound as the far end of a range that starts at `0`. */
function bounds(a: number, b: number | undefined): [number, number] {
  if (b === undefined) b = 0;
  return a <= b ? [a, b] : [b, a];
}

/**
 * Wraps `value` around the range `[min, max)`, the way an angle wraps at 360: going past `max`
 * comes back in at `min`, and going below `min` comes back in from `max`. The bounds may be given
 * in either order. An empty range gives `min`, and a value that is not finite gives `NaN`.
 *
 * @example
 * ```ts
 * wrap(12, 0, 10); // => 2
 * wrap(-1, 0, 5); // => 4
 * wrap(5, 10, 0); // => 5
 * ```
 *
 * @param value - The number to wrap.
 * @param min - One bound of the range (included).
 * @param max - The other bound of the range (excluded).
 * @returns `value` brought into the range.
 */
export function wrap(value: number, min: number, max: number): number;
/**
 * Wraps `value` around the range `[0, max)`: an index that runs off either end of a list comes
 * back in from the other side.
 *
 * @example
 * ```ts
 * wrap(370, 360); // => 10
 * wrap(-1, 3); // => 2
 * ```
 *
 * @param value - The number to wrap.
 * @param max - The end of the range (excluded).
 * @returns `value` brought into the range.
 */
export function wrap(value: number, max: number): number;
export function wrap(value: number, a: number, b?: number): number {
  const [lower, upper] = bounds(a, b);
  const span = upper - lower;
  if (span === 0) return lower;
  // `%` keeps the sign of the dividend, so a second pass folds negative offsets back in.
  const wrapped = lower + ((((value - lower) % span) + span) % span);
  // A tiny negative offset can round up to exactly `span`: that is the start of the range.
  return wrapped === upper ? lower : wrapped;
}

/**
 * Checks whether `value` is inside the range `[min, max)`: `min` is included and `max` is not, so
 * ranges that touch never both claim a value. The bounds may be given in either order. `NaN` is
 * never in range.
 *
 * @example
 * ```ts
 * inRange(5, 0, 10); // => true
 * inRange(10, 0, 10); // => false
 * inRange(5, 10, 0); // => true
 * ```
 *
 * @param value - The number to check.
 * @param min - One bound of the range (included).
 * @param max - The other bound of the range (excluded).
 * @returns `true` when `value` is in the range.
 */
export function inRange(value: number, min: number, max: number): boolean;
/**
 * Checks whether `value` is inside the range `[0, max)`, for example a valid index of a list of
 * `max` items.
 *
 * @example
 * ```ts
 * inRange(2, 3); // => true
 * inRange(3, 3); // => false
 * inRange(-1, 3); // => false
 * ```
 *
 * @param value - The number to check.
 * @param max - The end of the range (excluded).
 * @returns `true` when `value` is in the range.
 */
export function inRange(value: number, max: number): boolean;
export function inRange(value: number, a: number, b?: number): boolean {
  const [lower, upper] = bounds(a, b);
  return value >= lower && value < upper;
}

/** How many decimal places a number is written with, exponent included (`1e-7` has 7). */
function decimals(value: number): number {
  const [mantissa = "", exponent = "0"] = String(Math.abs(value)).split("e");
  return Math.max(0, (mantissa.split(".")[1] ?? "").length - Number(exponent));
}

/**
 * Rounds `value` to the nearest multiple of `step`, counted from `origin`. The result is rounded
 * to the decimal places of `step` and `origin`, so the float error of the arithmetic does not
 * leak out (`0.30000000000000004` comes back as `0.3`). Halfway values round up, as with
 * `Math.round`. A `step` of `0` or one that is not finite leaves `value` as it is.
 *
 * @example
 * ```ts
 * snap(7, 5); // => 5
 * snap(8, 5); // => 10
 * snap(0.1 + 0.2, 0.1); // => 0.3
 * snap(12, 5, 1); // => 11
 * snap(3, 0); // => 3
 * ```
 *
 * @param value - The number to round.
 * @param step - The grid spacing (default `1`, which rounds to an integer).
 * @param origin - A point the grid goes through (default `0`).
 * @returns The nearest point of the grid.
 */
export function snap(value: number, step = 1, origin = 0): number {
  if (step === 0 || !Number.isFinite(step)) return value;
  const snapped = origin + Math.round((value - origin) / step) * step;
  const places = Math.min(100, Math.max(decimals(step), decimals(origin)));
  return Number(snapped.toFixed(places));
}

/**
 * Moves `current` toward `target` by at most `delta`, without going past it: one step of an
 * animation or a game loop that must land exactly on its goal. The sign of `delta` does not
 * matter, an infinite `delta` arrives at once, and a `delta` of `NaN` does not move.
 *
 * @example
 * ```ts
 * approach(0, 10, 3); // => 3
 * approach(9, 10, 3); // => 10
 * approach(10, 0, 4); // => 6
 * ```
 *
 * @param current - Where the value is now.
 * @param target - Where it is going.
 * @param delta - The largest step allowed.
 * @returns The value after one step.
 */
export function approach(current: number, target: number, delta: number): number {
  const step = Math.abs(delta);
  if (Number.isNaN(step)) return current;
  return current < target ? Math.min(current + step, target) : Math.max(current - step, target);
}
