import { host } from "./internal/host";

/**
 * Called after a suspension was detected.
 *
 * @param elapsed - Milliseconds since the previous check, which is far more than the
 *   interval when the machine or tab was suspended.
 */
export type SuspendCallback = (elapsed: number) => void;

/** Options for {@link Suspend}. */
export interface SuspendOptions {
  /** A gap between two checks longer than this counts as a suspension (ms). Defaults to `3000`. */
  threshold?: number;
  /** How often the clock is checked (ms). Defaults to `1000`. */
  interval?: number;
}

interface Listener {
  callback: SuspendCallback;
  once: boolean;
}

/**
 * Detects that the process, tab or machine was suspended (laptop lid closed, tab frozen,
 * container paused) by noticing that a timer fired much later than it should have. Use it to
 * reconnect sockets, refresh stale data or resync clocks after a wake-up.
 *
 * The check timer runs only while there are listeners, and in Node it does not keep the
 * process alive. It reads the wall clock (`Date.now()`), so changing the system clock by hand
 * can look like a suspension.
 *
 * @example
 * ```ts
 * const suspend = new Suspend({ threshold: 5000 });
 * const off = suspend.on((elapsed) => {
 *   console.log(`Woke up after ${elapsed} ms`);
 *   // reconnect your socket, refresh what is stale...
 * });
 *
 * off(); // stop listening
 * suspend.dispose(); // or tear everything down
 * ```
 */
export class Suspend {
  /** A gap between two checks longer than this counts as a suspension (ms). */
  readonly threshold: number;
  /** How often the clock is checked (ms). */
  readonly interval: number;

  readonly #listeners = new Set<Listener>();
  #timer: unknown = undefined;
  #running = false;
  #last = 0;
  #disposed = false;

  /**
   * Creates a detector. Nothing runs until the first listener is added.
   *
   * @param options - The threshold and the check interval.
   * @throws {RangeError} When `interval` is not positive or `threshold` is not greater than
   *   `interval` (a threshold at or below the interval would fire constantly).
   */
  constructor({ threshold = 3000, interval = 1000 }: SuspendOptions = {}) {
    if (!(interval > 0) || !(threshold > interval)) {
      throw new RangeError(
        `Suspend needs 0 < interval < threshold, got interval ${interval} and threshold ${threshold}.`,
      );
    }
    this.threshold = threshold;
    this.interval = interval;
  }

  /**
   * Listens for suspensions. The first listener starts the timer, and removing the last one
   * stops it.
   *
   * @example
   * ```ts
   * const suspend = new Suspend();
   * const off = suspend.on((elapsed) => console.log(elapsed), { once: true });
   * off();
   * suspend.dispose();
   * ```
   *
   * @param callback - Called with the elapsed time (ms) when a suspension is detected.
   * @param options - `once: true` removes the listener after its first call.
   * @returns A function that removes this listener. Calling it again does nothing.
   * @throws {Error} When the detector was disposed, or the runtime has no `setInterval`.
   */
  on(callback: SuspendCallback, { once = false }: { once?: boolean } = {}): () => void {
    if (this.#disposed) throw new Error("This Suspend has been disposed.");
    if (!this.#running) this.#start();

    const listener: Listener = { callback, once };
    this.#listeners.add(listener);

    return () => {
      this.#listeners.delete(listener);
      if (this.#listeners.size === 0) this.#stop();
    };
  }

  /**
   * Stops the timer and removes every listener. The detector cannot be used afterwards.
   * Calling it more than once is harmless.
   *
   * @example
   * ```ts
   * const suspend = new Suspend();
   * suspend.on(() => {});
   * suspend.dispose();
   * ```
   */
  dispose(): void {
    this.#disposed = true;
    this.#listeners.clear();
    this.#stop();
  }

  #start(): void {
    const timers = host();
    if (!timers.setInterval) throw new Error("setInterval is not available in this runtime.");

    // Measure from now, not from when the class loaded: otherwise a listener added long
    // after startup would be told the machine had just been suspended.
    this.#last = Date.now();
    this.#timer = timers.setInterval(() => this.#tick(), this.interval);
    this.#running = true;
    // In Node the handle has unref(): a detector must never keep the process alive.
    (this.#timer as { unref?: () => void } | null)?.unref?.();
  }

  #stop(): void {
    if (!this.#running) return;
    this.#running = false;
    host().clearInterval?.(this.#timer);
    this.#timer = undefined;
  }

  #tick(): void {
    const now = Date.now();
    const elapsed = now - this.#last;
    this.#last = now;
    if (elapsed <= this.threshold) return;

    const errors: unknown[] = [];
    for (const listener of [...this.#listeners]) {
      // An earlier listener may have removed this one, or disposed the detector.
      if (!this.#listeners.has(listener)) continue;
      if (listener.once) this.#listeners.delete(listener);
      try {
        listener.callback(elapsed);
      } catch (error) {
        errors.push(error);
      }
    }
    if (this.#listeners.size === 0) this.#stop();

    // Let every listener run first, then surface the failure as one uncaught error.
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, "Several Suspend listeners threw.");
  }
}
