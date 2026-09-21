/**
 * Runs a callback and returns its result. It is a block expression: it lets you
 * initialise a `const` with early returns instead of declaring a `let`.
 *
 * @example
 * ```ts
 * const width = 800;
 * const size = fabricate(() => {
 *   if (width < 600) return "small";
 *   if (width < 1200) return "medium";
 *   return "large";
 * }); // => "medium"
 * ```
 *
 * @param callback - The function to run.
 * @returns Whatever `callback` returns (a promise is returned as is).
 */
export function fabricate<T>(callback: () => T): T;
/**
 * Runs a callback with the given parameters.
 *
 * @example
 * ```ts
 * const sum = (a: number, b: number) => a + b;
 * fabricate(sum, [3, 4]); // => 7
 * ```
 *
 * @param callback - The function to run.
 * @param params - The arguments passed to `callback`.
 * @returns Whatever `callback` returns.
 */
export function fabricate<T, P extends unknown[]>(callback: (...params: P) => T, params: P): T;
/**
 * Runs a callback with `context` as `this`. The context must be a non-function
 * object.
 *
 * @example
 * ```ts
 * const context = { multiplier: 2 };
 * fabricate(context, function (this: typeof context) {
 *   return this.multiplier * 5;
 * }); // => 10
 * ```
 *
 * @param context - The object bound as `this`.
 * @param callback - The function to run.
 * @returns Whatever `callback` returns.
 */
export function fabricate<T, C extends object>(context: C, callback: (this: C) => T): T;
/**
 * Runs a callback with `context` as `this` and the given parameters.
 *
 * @example
 * ```ts
 * const context = { multiplier: 3 };
 * fabricate(
 *   context,
 *   function (this: typeof context, a: number, b: number) {
 *     return (a + b) * this.multiplier;
 *   },
 *   [4, 5],
 * ); // => 27
 * ```
 *
 * @param context - The object bound as `this`.
 * @param callback - The function to run.
 * @param params - The arguments passed to `callback`.
 * @returns Whatever `callback` returns.
 */
export function fabricate<T, C extends object, P extends unknown[]>(
  context: C,
  callback: (this: C, ...params: P) => T,
  params: P,
): T;
export function fabricate(first: unknown, second?: unknown, third?: unknown): unknown {
  if (typeof first === "function") {
    const params = (second ?? []) as unknown[];
    return (first as (...params: unknown[]) => unknown)(...params);
  }
  const params = (third ?? []) as unknown[];
  return (second as (this: unknown, ...params: unknown[]) => unknown).call(first, ...params);
}
