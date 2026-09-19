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
