/**
 * The store to use: `localStorage` by default in a browser, and none on the server, where a global
 * store (Node has one) would be shared by every request.
 */
export function resolveStorage(storage: Storage | null | undefined): Storage | null {
  if (storage !== undefined) return storage;
  // Reading `localStorage` itself throws when storage is blocked (some privacy settings, sandboxed iframes).
  return typeof window === "undefined" ? null : window.localStorage;
}
