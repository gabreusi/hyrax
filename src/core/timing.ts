import { host } from "./internal/host";

/** Options for {@link debounce}. */
export interface DebounceOptions {
  /** How long the calls must stop before `fn` runs (ms). Defaults to `0`. */
  wait?: number;
  /** Also run `fn` on the first call of a burst. Defaults to `false`. */
  leading?: boolean;
  /** Run `fn` when the calls stop. Defaults to `true`. */
  trailing?: boolean;
  /** Run `fn` at least this often during a long burst (ms). Defaults to never. */
  maxWait?: number;
}

/** Options for {@link throttle}. */
export interface ThrottleOptions {
  /** The shortest time between two runs of `fn` (ms). Defaults to `0`. */
  wait?: number;
  /** Run `fn` on the first call. Defaults to `true`. */
  leading?: boolean;
  /** Run `fn` once more with the last arguments when the calls stop. Defaults to `true`. */
  trailing?: boolean;
}

/** What {@link debounce} and {@link throttle} return: the function, plus controls. */
export interface Debounced<A extends unknown[]> {
  /** Records a call: `fn` runs later with the arguments of the latest one. */
  (...args: A): void;
  /** Drops the waiting call, if any. */
  cancel(): void;
  /** Runs the waiting call now, if any. */
  flush(): void;
  /** Whether a call is waiting to run. */
  readonly pending: boolean;
}

/** The largest delay `setTimeout` honours; a longer one overflows and fires at once. */
const MAX_DELAY = 2 ** 31 - 1;

/** A usable number of milliseconds: `NaN`, negative or infinite values fall back to `0`. */
function milliseconds(value: number | undefined): number {
  return value !== undefined && value > 0 && Number.isFinite(value)
    ? Math.min(value, MAX_DELAY)
    : 0;
}

/**
 * Delays `fn` until the calls stop for `wait` milliseconds, then runs it once with the arguments of
 * the latest call: search as the user types, save after the last keystroke, lay out after the last
 * resize. A `wait` that is negative, `NaN` or infinite counts as `0`, instead of breaking the timer.
 *
 * The returned function has `cancel()`, `flush()` and `pending`. Errors thrown by `fn` surface from
 * the timer. Its timer keeps a Node process alive, so a pending save is not lost on exit.
 *
 * @example
 * ```ts
 * const save = debounce((text: string) => console.log("saving", text), 300);
 * save("h");
 * save("hi"); // only "hi" is saved, 300 ms after this call
 * save.flush(); // or now
 * ```
 *
 * @param fn - The function to delay. Bind it first if it needs `this`.
 * @param wait - How long the calls must stop (ms, default `0`).
 * @returns The debounced function.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => unknown,
  wait?: number,
): Debounced<A>;
/**
 * Debounces with options: `leading` also runs `fn` on the first call of a burst, `trailing: false`
 * skips the run when the calls stop, and `maxWait` makes a long burst still run `fn` at least that
 * often.
 *
 * @example
 * ```ts
 * const track = debounce((y: number) => console.log(y), { wait: 100, maxWait: 1000 });
 * track(10);
 * track.cancel();
 * ```
 *
 * @param fn - The function to delay.
 * @param options - `wait`, `leading`, `trailing` and `maxWait`.
 * @returns The debounced function.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => unknown,
  options: DebounceOptions,
): Debounced<A>;
export function debounce<A extends unknown[]>(
  fn: (...args: A) => unknown,
  waitOrOptions: number | DebounceOptions = {},
): Debounced<A> {
  const options = typeof waitOrOptions === "number" ? { wait: waitOrOptions } : waitOrOptions;
  const { leading = false, trailing = true } = options;
  const wait = milliseconds(options.wait);
  const maxWait =
    options.maxWait === undefined ? undefined : Math.max(milliseconds(options.maxWait), wait);

  let timer: unknown = undefined;
  let waiting: A | undefined;
  let lastCall = 0;
  let windowStart = 0;

  const invoke = () => {
    const args = waiting;
    if (!args) return;
    // Settle the state first: `fn` may call the debounced function again, or throw.
    waiting = undefined;
    windowStart = Date.now();
    fn(...args);
  };

  const schedule = (now: number) => {
    let delay = wait - (now - lastCall);
    if (maxWait !== undefined) delay = Math.min(delay, maxWait - (now - windowStart));
    const timers = host();
    if (!timers.setTimeout) throw new Error("setTimeout is not available in this runtime.");
    timer = timers.setTimeout(fire, Math.max(0, delay));
  };

  const stop = () => {
    if (timer === undefined) return;
    host().clearTimeout?.(timer);
    timer = undefined;
  };

  function fire() {
    timer = undefined;
    const now = Date.now();
    if (now - lastCall >= wait) {
      // The calls stopped: the burst is over.
      // `invoke` clears `waiting` before `fn` runs, so a call made from inside `fn` is kept.
      if (trailing) invoke();
      else waiting = undefined;
      return;
    }
    // Still inside a burst: `maxWait` ran out, so run now and start a new window.
    if (maxWait !== undefined && now - windowStart >= maxWait && (leading || trailing)) invoke();
    schedule(now);
  }

  const debounced = (...args: A) => {
    const now = Date.now();
    waiting = args;
    lastCall = now;
    if (timer === undefined) {
      windowStart = now;
      if (leading) invoke();
    } else {
      stop();
    }
    schedule(now);
  };

  return Object.defineProperties(debounced, {
    cancel: {
      value: () => {
        stop();
        waiting = undefined;
      },
    },
    flush: {
      value: () => {
        stop();
        invoke();
      },
    },
    pending: { get: () => waiting !== undefined },
  }) as Debounced<A>;
}

/**
 * Runs `fn` at most once every `wait` milliseconds, however often it is called: on the first call,
 * then once per `wait` while the calls go on, and once more with the latest arguments when they stop.
 * For scroll and pointer handlers, or progress reports. A `wait` that is negative, `NaN` or infinite
 * counts as `0`.
 *
 * @example
 * ```ts
 * const report = throttle((y: number) => console.log(y), 100);
 * report(1); // runs now
 * report(2);
 * report(3); // runs 100 ms after the first call, with 3
 * ```
 *
 * @param fn - The function to throttle. Bind it first if it needs `this`.
 * @param wait - The shortest time between two runs (ms, default `0`).
 * @returns The throttled function, with `cancel()`, `flush()` and `pending`.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => unknown,
  wait?: number,
): Debounced<A>;
/**
 * Throttles with options: `leading: false` waits for the first `wait` before running, and
 * `trailing: false` skips the last run when the calls stop.
 *
 * @example
 * ```ts
 * const onMove = throttle((x: number) => console.log(x), { wait: 100, trailing: false });
 * onMove(1); // runs now
 * onMove(2); // dropped: no run when the calls stop
 * ```
 *
 * @param fn - The function to throttle.
 * @param options - `wait`, `leading` and `trailing`.
 * @returns The throttled function.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => unknown,
  options: ThrottleOptions,
): Debounced<A>;
export function throttle<A extends unknown[]>(
  fn: (...args: A) => unknown,
  waitOrOptions: number | ThrottleOptions = {},
): Debounced<A> {
  const options = typeof waitOrOptions === "number" ? { wait: waitOrOptions } : waitOrOptions;
  const { wait, leading = true, trailing = true } = options;
  return debounce(fn, { wait, leading, trailing, maxWait: milliseconds(wait) });
}
