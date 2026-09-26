/**
 * Observes whether `element` intersects the viewport (or `init.root`) and calls `callback` with
 * every entry. Shared by `onVisible` and the React `useVisible`. Nothing is observed for a missing
 * element or where there is no `IntersectionObserver`.
 */
export function intersect(
  element: Element | null | undefined,
  callback: (entry: IntersectionObserverEntry, stop: () => void) => void,
  init?: IntersectionObserverInit,
): () => void {
  if (!element || typeof IntersectionObserver === "undefined") return () => {};
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) callback(entry, stop);
  }, init);
  let stopped = false;
  function stop() {
    stopped = true;
    observer.disconnect();
  }
  observer.observe(element);
  return () => {
    if (!stopped) stop();
  };
}
