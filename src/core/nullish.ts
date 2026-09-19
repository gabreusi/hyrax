/**
 * Returns the first value that is neither `null` nor `undefined`, or `null` when
 * there is none. Falsy values such as `0`, `""` and `false` count as valid.
 *
 * @example
 * ```ts
 * coalesce(null, undefined, 0, "x"); // => 0
 * coalesce(null, undefined, "x"); // => "x"
 * coalesce(null, undefined); // => null
 * ```
 *
 * @param values - The candidates, in order of priority.
 * @returns The first non-nullish value, or `null`.
 */
export function coalesce<T extends readonly unknown[]>(
  ...values: T
): NonNullable<T[number]> | null {
  for (const value of values) {
    if (value != null) return value;
  }
  return null;
}
