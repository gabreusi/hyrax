import { useEffect, useLayoutEffect, useRef } from "react";

// React 18 warns about `useLayoutEffect` during a server render, and effects never run there anyway.
const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * A ref that always holds the value of the latest render. Read it from an event handler or a timer
 * to get the newest callback without listing it as a dependency (which would listen again). The
 * return type is spelled out because `RefObject` means different things in React 18 and 19.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
