import { useEffect, useState } from "react";

/**
 * A copy of `value` that only changes once `value` has stopped changing for `wait` milliseconds:
 * the query to search with while the user types, the size to lay out with while a window is being
 * resized. The first render returns `value` itself.
 *
 * Use it with a primitive, or a value that keeps its identity between renders (from `useMemo` or
 * state): a new object on every render counts as a change every time, and would never settle.
 *
 * @example
 * ```tsx
 * import { useState } from "react";
 *
 * function Search() {
 *   const [query, setQuery] = useState("");
 *   const debouncedQuery = useDebouncedValue(query, 300);
 *   // fetch results for `debouncedQuery`...
 *   return <input value={query} onChange={(event) => setQuery(event.target.value)} />;
 * }
 * ```
 *
 * @param value - The value to follow.
 * @param wait - How long `value` must stay the same (ms). Negative or `NaN` counts as `0`.
 * @returns The latest value that stayed the same for `wait`.
 */
export function useDebouncedValue<T>(value: T, wait: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(() => value), wait);
    return () => clearTimeout(timer);
  }, [value, wait]);
  return debounced;
}
