import { MAX_UNIT } from "./float";

/**
 * Bends a uniform draw `unit` in `[0, 1)` by `luck`: `luck >= 0` behaves like keeping the best of
 * `1 + luck` draws, `luck < 0` like keeping the worst of `1 - luck`. `luck = 0` is the identity.
 *
 * The result is clamped to `MAX_UNIT`: from luck 2 on, `unit ** (1 / (1 + luck))` rounds up to
 * exactly 1 for the largest draws, which would push `int` out of range and make `float` return `max`.
 *
 * @param unit - A uniform draw in `[0, 1)`.
 * @param luck - A finite number; `0` is neutral.
 * @returns The bent draw, in `[0, MAX_UNIT]`.
 */
export function lucky(unit: number, luck: number): number {
  if (luck === 0) return unit;
  // For luck < 0 this is 1 - (1 - unit) ** (1 / (1 - luck)), written with log1p/expm1 because `1 - unit`
  // only exists in steps of 2^-53, so the plain form pushes a tiny draw *up* instead of down.
  const value = luck > 0 ? unit ** (1 / (1 + luck)) : -Math.expm1(Math.log1p(-unit) / (1 - luck));
  return value > MAX_UNIT ? MAX_UNIT : value;
}
