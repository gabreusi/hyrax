import type { Arrayable } from "./types";

/**
 * Turns "one or many" into a list, for functions that accept a single value or an array of them:
 * `null` and `undefined` give an empty array, an array is copied, and anything else is wrapped. The
 * result is always a new array, safe to change.
 *
 * @example
 * ```ts
 * toArray("a"); // => ["a"]
 * toArray(["a", "b"]); // => ["a", "b"]
 * toArray(null); // => []
 * ```
 *
 * @param value - A value, an array of values, or nothing.
 * @returns A new array with the values.
 */
export function toArray<T>(value: Arrayable<T> | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? [...(value as readonly T[])] : [value as T];
}
