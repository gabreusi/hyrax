/** The largest double below 1 (`1 - 2 ** -53`): the top of the range every unit draw lives in. */
export const MAX_UNIT = 0.9999999999999999;

// Created on first use: a top-level call would be kept by bundlers that cannot prove it harmless,
// and would drag this file into a build that only imports `clamp`.
let scratch: { view: Float64Array; bits: BigInt64Array } | undefined;

/**
 * The largest double strictly below `value`. Callers pass finite numbers.
 *
 * @param value - A finite number.
 * @returns The double just below it.
 */
export function nextDown(value: number): number {
  if (value === 0) return -Number.MIN_VALUE;
  if (!scratch) {
    const view = new Float64Array(1);
    scratch = { view, bits: new BigInt64Array(view.buffer) };
  }
  scratch.view[0] = value;
  scratch.bits[0] = (scratch.bits[0] as bigint) + (value > 0 ? -1n : 1n);
  return scratch.view[0];
}
