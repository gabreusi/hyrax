/**
 * A function that does nothing. Accepts any arguments and returns `undefined`.
 * Useful as a default callback or placeholder.
 *
 * @example
 * ```ts
 * noop(1, 2, 3); // => undefined
 * ```
 *
 * @param _values - Ignored.
 */
export function noop(..._values: unknown[]): void {}
