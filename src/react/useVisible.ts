import { useEffect, useState } from "react";
import { intersect } from "../dom/internal/intersect";
import type { OnVisibleOptions } from "../dom/observe";
import { resolveRef } from "./internal/refs";
import type { MaybeRef } from "./internal/refs";

/**
 * Whether an element is in the viewport (or `root`), updated as it enters and leaves. It is `false`
 * on the server and until the element is observed. With `once: true` it stays `true` after the
 * first time, which is what lazy loading and "animate on first view" need.
 *
 * The element is read when the component mounts, or when `target` or an option changes.
 *
 * @example
 * ```tsx
 * import { useRef } from "react";
 *
 * function LazyImage({ src }: { src: string }) {
 *   const ref = useRef<HTMLImageElement>(null);
 *   const visible = useVisible(ref, { once: true, rootMargin: "200px" });
 *   return <img ref={ref} src={visible ? src : undefined} alt="" />;
 * }
 * ```
 *
 * @param target - A ref to the element, the element, or `null`.
 * @param options - `once`, and the `IntersectionObserver` options `root`, `rootMargin` and `threshold`.
 * @returns Whether the element is visible.
 */
export function useVisible(target: MaybeRef<Element>, options: OnVisibleOptions = {}): boolean {
  const [visible, setVisible] = useState(false);
  const { once = false, root, rootMargin } = options;
  // A threshold list can be a new array on every render: compare it by value.
  const threshold = JSON.stringify(options.threshold ?? 0);

  useEffect(
    () =>
      intersect(
        resolveRef(target),
        (entry, stop) => {
          setVisible(entry.isIntersecting);
          if (once && entry.isIntersecting) stop();
        },
        { root, rootMargin, threshold: JSON.parse(threshold) as number | number[] },
      ),
    [target, once, root, rootMargin, threshold],
  );
  return visible;
}
