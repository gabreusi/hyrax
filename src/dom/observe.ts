import { intersect } from "./internal/intersect";

// A local no-op, like in listen.ts: importing the core one would tie /dom to the root chunk.
const noop = () => {};

/**
 * Calls `callback` whenever the size of `element` changes, and once right after observing starts
 * when the element already has a size (that is how `ResizeObserver` works). Each call gets the `ResizeObserverEntry`, with `contentRect` and the
 * border and content box sizes.
 *
 * A `null` or `undefined` element (a ref that is not set yet), a server render, or a runtime
 * without `ResizeObserver` observe nothing, and the returned function still works.
 *
 * @example
 * ```ts
 * const panel = document.createElement("div");
 * const off = observeSize(panel, (entry) => console.log(entry.contentRect.width));
 * off();
 * ```
 *
 * @param element - The element to watch.
 * @param callback - Called with the entry of every size change.
 * @param options - `ResizeObserver` options, such as `{ box: "border-box" }`.
 * @returns A function that stops observing. Calling it again does nothing.
 */
export function observeSize(
  element: Element | null | undefined,
  callback: (entry: ResizeObserverEntry) => void,
  options?: ResizeObserverOptions,
): () => void {
  if (!element || typeof ResizeObserver === "undefined") return noop;
  // ponytail: one observer per call; share one if hundreds of elements are observed at once.
  const observer = new ResizeObserver((entries) => entries.forEach((entry) => callback(entry)));
  observer.observe(element, options);
  return () => observer.disconnect();
}

/** Options for {@link onVisible}: those of `IntersectionObserver`, plus `once`. */
export interface OnVisibleOptions extends IntersectionObserverInit {
  /** Stop observing after the first time the element becomes visible. Defaults to `false`. */
  once?: boolean;
}

/**
 * Calls `callback` every time `element` enters the viewport (or `root`), which is how you lazy-load
 * an image, start a video or record that a section was seen. Leaving is not reported. With
 * `once: true` it stops after the first time.
 *
 * A `null` or `undefined` element, a server render, or a runtime without `IntersectionObserver`
 * observe nothing, and the returned function still works.
 *
 * @example
 * ```ts
 * const image = document.createElement("img");
 * onVisible(image, () => (image.src = image.dataset.src ?? ""), { once: true, rootMargin: "200px" });
 * ```
 *
 * @param element - The element to watch.
 * @param callback - Called with the `IntersectionObserverEntry` when the element becomes visible.
 * @param options - `once`, and `IntersectionObserver` options (`root`, `rootMargin`, `threshold`).
 * @returns A function that stops observing. Calling it again does nothing.
 */
export function onVisible(
  element: Element | null | undefined,
  callback: (entry: IntersectionObserverEntry) => void,
  { once = false, ...init }: OnVisibleOptions = {},
): () => void {
  let done = false;
  return intersect(
    element,
    (entry, stop) => {
      // `done`: a batch can hold several entries after `once` already stopped the observer.
      if (!entry.isIntersecting || done) return;
      if (once) {
        done = true;
        stop();
      }
      callback(entry);
    },
    init,
  );
}
