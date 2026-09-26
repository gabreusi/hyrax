import { useEffect } from "react";
import { Suspend } from "../core/suspend";
import type { SuspendCallback, SuspendOptions } from "../core/suspend";
import { useLatest } from "./internal/useLatest";

/**
 * Calls `callback` when the machine or the tab wakes up from a suspension, for as long as the
 * component is mounted: reconnect a socket, refetch stale data, resync a clock. It runs a
 * {@link Suspend} detector, created when the component mounts and disposed when it unmounts.
 *
 * The callback is read from the latest render, so it can use fresh props and state without
 * restarting the detector. Changing `threshold` or `interval` starts a new one. On the server
 * nothing runs.
 *
 * @example
 * ```tsx
 * import { useState } from "react";
 *
 * function Clock() {
 *   const [now, setNow] = useState(() => Date.now());
 *   useSuspend(() => setNow(Date.now()), { threshold: 5000 });
 *   return <time>{new Date(now).toLocaleTimeString()}</time>;
 * }
 * ```
 *
 * @param callback - Called with the milliseconds since the previous check, which is far more than
 *   the interval after a suspension.
 * @param options - `threshold` and `interval`, as for `Suspend`.
 * @throws {RangeError} From the effect, when the options are invalid (see `Suspend`).
 */
export function useSuspend(callback: SuspendCallback, options: SuspendOptions = {}): void {
  const latest = useLatest(callback);
  const { threshold, interval } = options;
  useEffect(() => {
    const suspend = new Suspend({ threshold, interval });
    suspend.on((elapsed) => latest.current(elapsed));
    return () => suspend.dispose();
  }, [threshold, interval, latest]);
}
