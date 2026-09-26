import { useCallback, useMemo, useSyncExternalStore } from "react";
import { listen } from "../dom/listen";
import { resolveStorage } from "../dom/internal/storage";
import { readStorage, writeStorage } from "../dom/storage";
import { useLatest } from "./internal/useLatest";

/** Sets the stored value: a value, a function of the current one, or `undefined` to remove it. */
export type SetStorage<T> = (next: T | undefined | ((current: T) => T | undefined)) => void;

/** Every mounted `useStorage` in this tab: a write through one of them tells the others. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Other tabs: the browser fires `storage` there, never in the tab that wrote.
  const off = listen(globalThis.window, "storage", onChange);
  return () => {
    listeners.delete(onChange);
    off();
  };
}

/** Marks a stored text that could not be parsed, so it falls back like a missing one. */
const INVALID = Symbol("invalid");

/**
 * A value kept in `localStorage` as JSON, as state: `[value, setValue]`, like `useState`. It
 * survives a reload, follows changes made in other tabs, and every component that uses the same key
 * in this tab renders the same value.
 *
 * `fallback` is the value while nothing valid is stored, on the server, and during hydration, so the
 * markup of the server and of the first client render agree; the stored value takes over right
 * after. `setValue` takes a value or a function of the current one, and `undefined` removes the key.
 * Reading and writing never throw: when storage is blocked or full, the value stays at what could be
 * read. The stored value is parsed, not validated.
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const [theme, setTheme] = useStorage<"light" | "dark">("theme", "light");
 *   return (
 *     <button onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}>
 *       {theme}
 *     </button>
 *   );
 * }
 * ```
 *
 * @param key - The storage key.
 * @param fallback - The value when nothing valid is stored, and on the server.
 * @param storage - Another store, such as `sessionStorage`. `null` means none: `fallback` is used.
 * @returns The value and a function that sets it.
 */
export function useStorage<T>(
  key: string,
  fallback: T,
  storage?: Storage | null,
): [T, SetStorage<T>] {
  const text = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return resolveStorage(storage)?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    () => null,
  );
  const parsed = useMemo(() => {
    if (text === null) return INVALID;
    try {
      return JSON.parse(text) as T;
    } catch {
      return INVALID;
    }
  }, [text]);
  const latestFallback = useLatest(fallback);

  const setValue = useCallback<SetStorage<T>>(
    (next) => {
      // Read the store, not the render: two updates in a row must build on each other.
      const value =
        typeof next === "function"
          ? (next as (current: T) => T | undefined)(
              readStorage(key, latestFallback.current, storage),
            )
          : next;
      if (writeStorage(key, value, storage)) listeners.forEach((listener) => listener());
    },
    [key, storage, latestFallback],
  );

  return [parsed === INVALID ? fallback : parsed, setValue];
}
