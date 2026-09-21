import { useCallback, useEffect, useState } from "react";
import { useLatest } from "./internal/useLatest";

/** Options for {@link useInterval}. */
export interface UseIntervalOptions {
  /** Start on mount instead of waiting for `start()`. Defaults to `false`. */
  autoStart?: boolean;
  /** Also call the handler at the moment the interval starts, not only after the first `delay`. */
  immediate?: boolean;
}

/** What {@link useInterval} returns. */
export interface UseIntervalResult {
  /** Starts the interval. Does nothing if it is already running. */
  start: () => void;
  /** Stops the interval. Does nothing if it is not running. */
  stop: () => void;
  /** Whether the interval is running. */
  isRunning: boolean;
}

/**
 * Calls `handler` every `delay` milliseconds while the interval is running, and clears the timer
 * when the component unmounts.
 *
 * The handler is read from the latest render, so it can use fresh props and state and does not
 * restart the timer. Changing `delay` while it runs restarts the timer with the new delay.
 * `start()` and `stop()` never change between renders, and they take effect when React commits the
 * update, not on the same line.
 *
 * In StrictMode, during development, React runs every effect twice on mount, so `immediate` together
 * with `autoStart` calls the handler twice then. `start()` calls it once.
 *
 * @example
 * ```tsx
 * const { start, stop, isRunning } = useInterval(() => setSeconds((s) => s + 1), 1000);
 * return <button onClick={isRunning ? stop : start}>{isRunning ? "Pause" : "Play"}</button>;
 * ```
 *
 * @param handler - Called on every tick.
 * @param delay - The time between ticks, in milliseconds.
 * @param options - `autoStart` and `immediate`.
 * @returns `start`, `stop` and `isRunning`.
 */
export function useInterval(
  handler: () => void,
  delay: number,
  { autoStart = false, immediate = false }: UseIntervalOptions = {},
): UseIntervalResult {
  const [isRunning, setIsRunning] = useState(autoStart);
  const latestHandler = useLatest(handler);
  const latestImmediate = useLatest(immediate);

  // Its own effect, so that changing `delay` (which restarts the timer) is not a new start.
  useEffect(() => {
    if (isRunning && latestImmediate.current) latestHandler.current();
  }, [isRunning, latestHandler, latestImmediate]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => latestHandler.current(), delay);
    return () => clearInterval(timer);
  }, [isRunning, delay, latestHandler]);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  return { start, stop, isRunning };
}
