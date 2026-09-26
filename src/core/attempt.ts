/** What {@link attempt} returns: the result or the fallback, inside a promise when `callback` returns one. */
export type Attempted<T, F> = T extends PromiseLike<infer U> ? Promise<U | F> : T | F;

/**
 * Runs `callback` and returns its result, or `undefined` when it throws. It is `try`/`catch` as an
 * expression, so a `const` can hold the result of something that may fail. When `callback` returns
 * a promise, a rejection is caught the same way and the result is a promise.
 *
 * @example
 * ```ts
 * attempt(() => JSON.parse('{"a":1}')); // => { a: 1 }
 * attempt(() => JSON.parse("{oops")); // => undefined
 * ```
 *
 * @param callback - The function to run.
 * @returns Whatever `callback` returns, or `undefined` when it throws or rejects.
 */
export function attempt<T>(callback: () => T): Attempted<T, undefined>;
/**
 * Runs `callback`, and when it throws, calls `fallback` with the error and returns what it returns.
 *
 * @example
 * ```ts
 * attempt(
 *   () => JSON.parse("{oops"),
 *   (error) => (error instanceof SyntaxError ? "bad json" : "other"),
 * ); // => "bad json"
 * ```
 *
 * @param callback - The function to run.
 * @param fallback - Called with what was thrown; its result is returned instead.
 * @returns Whatever `callback` returns, or what `fallback` returns when it throws or rejects.
 */
export function attempt<T, F>(callback: () => T, fallback: (error: unknown) => F): Attempted<T, F>;
/**
 * Runs `callback` and returns its result, or `fallback` when it throws. A function passed as
 * `fallback` is always called with the error (see the overload above), so to fall back to a
 * function, return it from one: `attempt(load, () => defaultHandler)`.
 *
 * @example
 * ```ts
 * attempt(() => JSON.parse("{oops"), {}); // => {}
 * attempt(() => Number("42"), 0); // => 42
 * ```
 *
 * @param callback - The function to run.
 * @param fallback - What to return when `callback` throws or rejects.
 * @returns Whatever `callback` returns, or `fallback`.
 */
export function attempt<T, F>(callback: () => T, fallback: F): Attempted<T, F>;
export function attempt(callback: () => unknown, fallback?: unknown): unknown {
  const recover = (error: unknown): unknown =>
    typeof fallback === "function" ? (fallback as (error: unknown) => unknown)(error) : fallback;
  try {
    const result = callback();
    return isThenable(result) ? Promise.resolve(result).catch(recover) : result;
  } catch (error) {
    return recover(error);
  }
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}
