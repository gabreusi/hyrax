/**
 * The store to use: `localStorage` by default in a browser, and none on the server, where a global
 * store (Node has one) would be shared by every request.
 */
function resolve(storage: Storage | null | undefined): Storage | null {
  if (storage !== undefined) return storage;
  // Reading `localStorage` itself throws when storage is blocked (some privacy settings, sandboxed iframes).
  return typeof window === "undefined" ? null : window.localStorage;
}

/**
 * Reads a JSON value from `localStorage`, or returns `fallback` when it cannot: the key is missing,
 * the stored text is not valid JSON, storage is blocked (private mode, sandboxed iframes), or there
 * is no window (server-side rendering). It never throws.
 *
 * The value is parsed, not validated: the result is typed like `fallback`, so check it when the data
 * may come from an older version of your app.
 *
 * @example
 * ```ts
 * writeStorage("settings", { theme: "dark" });
 * readStorage("settings", { theme: "light" }); // => { theme: "dark" }
 * readStorage("missing", 10); // => 10
 * ```
 *
 * @param key - The storage key.
 * @param fallback - What to return when there is no readable value.
 * @param storage - Another store, such as `sessionStorage`. `null` means none: `fallback` is returned.
 * @returns The stored value, or `fallback`.
 */
export function readStorage<T>(key: string, fallback: T, storage?: Storage | null): T {
  try {
    const text = resolve(storage)?.getItem(key);
    return text == null ? fallback : (JSON.parse(text) as T);
  } catch {
    return fallback;
  }
}

/**
 * Writes a value to `localStorage` as JSON, and tells whether it worked instead of throwing: storage
 * can be full, blocked, or missing on the server. `undefined` removes the key. A value JSON cannot
 * write (a function, a symbol, a bigint, a cycle) is not written.
 *
 * @example
 * ```ts
 * writeStorage("count", 3); // => true
 * writeStorage("count", undefined); // removes it
 * readStorage("count", 0); // => 0
 * ```
 *
 * @param key - The storage key.
 * @param value - The value to store, or `undefined` to remove the key.
 * @param storage - Another store, such as `sessionStorage`. `null` means none: nothing is written.
 * @returns `true` when the value was written or removed.
 */
export function writeStorage(key: string, value: unknown, storage?: Storage | null): boolean {
  try {
    const store = resolve(storage);
    if (!store) return false;
    if (value === undefined) {
      store.removeItem(key);
      return true;
    }
    const text = JSON.stringify(value);
    if (text === undefined) return false;
    store.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}
