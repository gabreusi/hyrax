import type { Numeric } from "./types";

const DECIMAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

/**
 * Checks whether a value is a finite number, a bigint or a string holding a
 * decimal number. Strings must not have surrounding whitespace (trim first),
 * and hexadecimal, `Infinity` and `NaN` are rejected.
 *
 * @example
 * ```ts
 * isNumeric(42); // => true
 * isNumeric("-1.5e3"); // => true
 * isNumeric("0x10"); // => false
 * isNumeric(" 42"); // => false
 * isNumeric(Infinity); // => false
 * ```
 *
 * @param value - The value to check.
 * @returns `true` when the value is numeric.
 */
export function isNumeric(value: unknown): value is Numeric {
  switch (typeof value) {
    case "number":
      return Number.isFinite(value);
    case "bigint":
      return true;
    case "string":
      return DECIMAL.test(value) && Number.isFinite(Number(value));
    default:
      return false;
  }
}

/**
 * Converts a numeric value to a number, or returns `fallback` when the value is
 * not numeric or does not fit a finite number.
 *
 * @example
 * ```ts
 * toNumber("42"); // => 42
 * toNumber(7n); // => 7
 * toNumber("abc"); // => 0
 * toNumber("abc", -1); // => -1
 * ```
 *
 * @param value - The value to convert.
 * @param fallback - What to return when `value` cannot be converted.
 * @returns The number, or `fallback`.
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (!isNumeric(value)) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
