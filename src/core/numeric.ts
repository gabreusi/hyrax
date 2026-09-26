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

/**
 * Converts a numeric value to an integer, dropping the fraction (`1.9` gives `1`, `-1.9` gives
 * `-1`), or returns `fallback` when the value is not numeric or the integer is not exactly
 * representable (beyond `Number.MAX_SAFE_INTEGER`).
 *
 * @example
 * ```ts
 * toInteger("42"); // => 42
 * toInteger("1.9"); // => 1
 * toInteger("abc"); // => 0
 * toInteger(1e20); // => 0
 * ```
 *
 * @param value - The value to convert.
 * @returns The integer, or `0`.
 */
export function toInteger(value: unknown): number;
/**
 * Converts a numeric value to an integer, or returns `fallback`. Pass `null` to tell an invalid
 * value apart from a real `0`.
 *
 * @example
 * ```ts
 * toInteger("7 items", -1); // => -1
 * toInteger("x", null); // => null
 * ```
 *
 * @param value - The value to convert.
 * @param fallback - What to return when `value` cannot be converted (any type).
 * @returns The integer, or `fallback`.
 */
export function toInteger<T>(value: unknown, fallback: T): number | T;
export function toInteger(value: unknown, fallback: unknown = 0): unknown {
  // `+ 0` turns `-0` into `0`, so `toInteger("-0.5")` does not print as "-0".
  const integer = Math.trunc(toNumber(value, NaN)) + 0;
  return Number.isSafeInteger(integer) ? integer : fallback;
}

const TRUE_WORDS = new Set(["true", "yes", "on", "1"]);
const FALSE_WORDS = new Set(["false", "no", "off", "0"]);

/**
 * Reads a boolean out of a value that came from text: an environment variable, a query string, a
 * `data-*` attribute. Booleans pass through, `1` and `0` (number or bigint) count, and so do the
 * strings `true`/`false`, `yes`/`no`, `on`/`off` and `1`/`0`, in any case and with surrounding
 * whitespace. Anything else is `false`.
 *
 * @example
 * ```ts
 * toBoolean("true"); // => true
 * toBoolean(" YES "); // => true
 * toBoolean("off"); // => false
 * toBoolean(1); // => true
 * toBoolean("maybe"); // => false
 * ```
 *
 * @param value - The value to read.
 * @returns The boolean, or `false` when `value` is not one.
 */
export function toBoolean(value: unknown): boolean;
/**
 * Reads a boolean out of a value, or returns `fallback` when it is not one. Pass `null` to tell a
 * missing or invalid value apart from an explicit `false`.
 *
 * @example
 * ```ts
 * toBoolean("maybe", true); // => true
 * toBoolean(undefined, null); // => null
 * toBoolean("no", null); // => false
 * ```
 *
 * @param value - The value to read.
 * @param fallback - What to return when `value` is not a boolean (any type).
 * @returns The boolean, or `fallback`.
 */
export function toBoolean<T>(value: unknown, fallback: T): boolean | T;
export function toBoolean(value: unknown, fallback: unknown = false): unknown {
  switch (typeof value) {
    case "boolean":
      return value;
    case "number":
    case "bigint":
      // `==` so that `1n` and `0n` count too.
      return value == 1 ? true : value == 0 ? false : fallback;
    case "string": {
      const word = value.trim().toLowerCase();
      return TRUE_WORDS.has(word) ? true : FALSE_WORDS.has(word) ? false : fallback;
    }
    default:
      return fallback;
  }
}
