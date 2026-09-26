import { host } from "./internal/host";

/**
 * The part of an `AbortSignal` that `retry` uses, spelled out so the universal core does not need
 * the DOM types. Any `AbortSignal` fits.
 */
export interface AbortSignalLike {
  readonly aborted: boolean;
  readonly reason?: unknown;
  addEventListener(type: "abort", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

/** Options for {@link retry}. */
export interface RetryOptions {
  /** How many attempts in total, the first one included. Defaults to `3`. */
  times?: number;
  /** The wait before the second attempt (ms). Defaults to `100`. */
  delay?: number;
  /** What the wait is multiplied by after each failure. Defaults to `2` (100, 200, 400...). */
  backoff?: number;
  /** Whether a failure is worth another attempt. Defaults to always. */
  retryIf?: (error: unknown, attempt: number) => boolean;
  /** Stops waiting and attempting when it aborts. */
  signal?: AbortSignalLike;
}

/** Options for {@link retry} with a fallback: the result when every attempt failed. */
export interface RetryOptionsWithFallback<F> extends RetryOptions {
  /** Returned instead of rejecting when the attempts run out or the signal aborts. */
  fallback: F;
}

/** A usable count or duration: `NaN`, negative or infinite values fall back to `fallback`. */
function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && value >= 0 && Number.isFinite(value) ? value : fallback;
}

/** Waits `ms`, or less when `signal` aborts. Never rejects: the caller checks the signal. */
function wait(ms: number, signal: AbortSignalLike | undefined): Promise<void> {
  return new Promise((resolve) => {
    // An `abort` that already happened (during the attempt) fires no event: check it now.
    if (signal?.aborted) return resolve();
    const timers = host();
    if (!timers.setTimeout) throw new Error("setTimeout is not available in this runtime.");
    const done = () => {
      timers.clearTimeout?.(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = timers.setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Calls `fn` until it succeeds, waiting longer after each failure: 100 ms, then 200 ms, for three
 * attempts in total by default. For the call that fails once in a while, a flaky network or a busy
 * server. `fn` receives the attempt number, starting at `1`, and may return a value or a promise.
 *
 * When every attempt fails, the promise rejects with the last error. A `times` below `1` or that is
 * not a number counts as a single attempt, and an invalid `delay` or `backoff` as none.
 *
 * @example
 * ```ts
 * let calls = 0;
 * const flaky = () => (++calls < 3 ? Promise.reject(new Error("busy")) : Promise.resolve("ok"));
 * await retry(flaky, { delay: 1 }); // => "ok"
 * ```
 *
 * @param fn - The work to attempt.
 * @param times - How many attempts in total (default `3`).
 * @returns The first successful result.
 */
export function retry<T>(fn: (attempt: number) => T | PromiseLike<T>, times?: number): Promise<T>;
/**
 * Retries with options, and with `fallback` never rejects: when the attempts run out, or `signal`
 * aborts, the fallback is the result. Without it, an abort rejects with the signal's reason.
 *
 * @example
 * ```ts
 * const down = () => Promise.reject(new Error("down"));
 * await retry(down, { times: 2, delay: 1, fallback: null }); // => null
 * await retry(down, {
 *   delay: 1,
 *   retryIf: (error) => error instanceof TypeError,
 *   fallback: "gave up",
 * }); // => "gave up"
 * ```
 *
 * @param fn - The work to attempt.
 * @param options - `times`, `delay`, `backoff`, `retryIf`, `signal` and `fallback`.
 * @returns The first successful result, or `fallback`.
 */
export function retry<T, F>(
  fn: (attempt: number) => T | PromiseLike<T>,
  options: RetryOptionsWithFallback<F>,
): Promise<T | F>;
/**
 * Retries with options, and rejects with the last error when every attempt fails.
 *
 * @example
 * ```ts
 * const ping = () => Promise.resolve("pong");
 * await retry(ping, { times: 5, delay: 250, backoff: 1.5 }); // => "pong"
 * ```
 *
 * @param fn - The work to attempt.
 * @param options - `times`, `delay`, `backoff`, `retryIf` and `signal`.
 * @returns The first successful result.
 */
export function retry<T>(
  fn: (attempt: number) => T | PromiseLike<T>,
  options: RetryOptions,
): Promise<T>;
export async function retry(
  fn: (attempt: number) => unknown,
  timesOrOptions: number | (RetryOptions & { fallback?: unknown }) = {},
): Promise<unknown> {
  const options = typeof timesOrOptions === "number" ? { times: timesOrOptions } : timesOrOptions;
  const { retryIf = () => true, signal } = options;
  const times = Math.max(1, Math.floor(finite(options.times, 3)));
  const backoff = finite(options.backoff, 2);
  const hasFallback = "fallback" in options;
  let delay = finite(options.delay, 100);

  const fail = (error: unknown) => {
    if (hasFallback) return options.fallback;
    throw error;
  };

  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) return fail(signal.reason);
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= times || !retryIf(error, attempt)) return fail(error);
    }
    await wait(delay, signal);
    delay *= backoff;
  }
}

/**
 * The error {@link timeout} rejects with when the time runs out and there is no fallback. Check for
 * it with `instanceof` to tell a slow call apart from a failed one.
 *
 * @example
 * ```ts
 * const never = new Promise(() => {});
 * await timeout(never, 10).catch((error: unknown) =>
 *   error instanceof TimeoutError ? "slow" : "failed",
 * ); // => "slow"
 * ```
 */
export class TimeoutError extends Error {
  override readonly name = "TimeoutError";
}

/**
 * Waits for `work` for at most `ms` milliseconds, and rejects with a {@link TimeoutError} when the
 * time runs out. `work` is a promise, or a function that starts one. A rejection of `work` itself
 * passes through unchanged. An `ms` that is negative, `NaN` or infinite means no limit.
 *
 * The work is not cancelled when the time runs out (a promise cannot be): pass it an `AbortSignal`
 * of its own if it must stop.
 *
 * @example
 * ```ts
 * await timeout(Promise.resolve("fast"), 1000); // => "fast"
 * ```
 *
 * @param work - The promise, or a function returning a value or a promise.
 * @param ms - The limit (ms).
 * @returns The result of `work`.
 */
export function timeout<T>(
  work: PromiseLike<T> | (() => T | PromiseLike<T>),
  ms: number,
): Promise<T>;
/**
 * Waits for `work` for at most `ms` milliseconds, and resolves to `fallback` when the time runs out
 * instead of rejecting. A rejection of `work` itself still rejects.
 *
 * @example
 * ```ts
 * const never = new Promise<string>(() => {});
 * await timeout(never, 10, "cached"); // => "cached"
 * ```
 *
 * @param work - The promise, or a function returning a value or a promise.
 * @param ms - The limit (ms).
 * @param fallback - The result when the time runs out.
 * @returns The result of `work`, or `fallback`.
 */
export function timeout<T, F>(
  work: PromiseLike<T> | (() => T | PromiseLike<T>),
  ms: number,
  fallback: F,
): Promise<T | F>;
export function timeout(
  work: PromiseLike<unknown> | (() => unknown),
  ms: number,
  ...fallback: [unknown?]
): Promise<unknown> {
  // In an executor, a function that throws becomes a rejection instead of a throw.
  const promise = new Promise((resolve) => resolve(typeof work === "function" ? work() : work));
  if (!(ms >= 0) || !Number.isFinite(ms)) return promise;

  const timers = host();
  let timer: unknown;
  const expired = new Promise((resolve, reject) => {
    timer = timers.setTimeout?.(() => {
      if (fallback.length) resolve(fallback[0]);
      else reject(new TimeoutError(`Timed out after ${ms} ms.`));
    }, ms);
  });
  return Promise.race([promise, expired]).finally(() => timers.clearTimeout?.(timer));
}
