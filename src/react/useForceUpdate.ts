import { useCallback, useState } from "react";

/**
 * Returns a function that renders the component again, for the times the screen must follow
 * something that is not React state: a mutable ref, an external store, a plain object.
 *
 * @example
 * ```tsx
 * function Clicks() {
 *   const forceUpdate = useForceUpdate();
 *   const count = useRef(0);
 *   return <button onClick={() => { count.current += 1; forceUpdate(); }}>{count.current}</button>;
 * }
 * ```
 *
 * @returns A function that never changes between renders, so it is safe in a dependency array.
 */
export function useForceUpdate(): () => void {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((tick) => tick + 1), []);
}
