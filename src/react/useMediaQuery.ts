import { useCallback, useSyncExternalStore } from "react";
import { listen } from "../dom/listen";

/** The query list, or nothing on the server and in runtimes without `matchMedia`. */
function queryList(query: string): MediaQueryList | undefined {
  return typeof window === "undefined" ? undefined : window.matchMedia?.(query);
}

/**
 * Whether a CSS media query matches, updated when it changes (a resize, a rotation, the user
 * switching to dark mode).
 *
 * On the server there is no screen to ask, so it returns `fallback`, and while hydrating it returns
 * `fallback` too before switching to the real value, so the markup of the server and of the first
 * client render agree and React does not warn about a mismatch. Pick as `fallback` what most
 * visitors will see, to avoid a flash. Where `matchMedia` does not exist it stays at `fallback`.
 *
 * @example
 * ```tsx
 * function Layout() {
 *   const isWide = useMediaQuery("(min-width: 768px)", true);
 *   const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
 *   return <main data-theme={prefersDark ? "dark" : "light"}>{isWide ? "sidebar" : "tabs"}</main>;
 * }
 * ```
 *
 * @param query - A media query, such as `"(min-width: 768px)"`.
 * @param fallback - The value on the server and during hydration (default `false`).
 * @returns Whether the query matches.
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => listen(queryList(query), "change", onChange),
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => queryList(query)?.matches ?? fallback,
    () => fallback,
  );
}
