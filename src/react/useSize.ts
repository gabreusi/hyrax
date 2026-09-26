import { useEffect, useState } from "react";
import { observeSize } from "../dom/observe";
import { resolveRef } from "./internal/refs";
import type { MaybeRef } from "./internal/refs";

/** A width and a height, in CSS pixels. */
export interface ElementSize {
  width: number;
  height: number;
}

const EMPTY: ElementSize = { width: 0, height: 0 };

/**
 * The size of an element's content box, updated when it changes. It is `{ width: 0, height: 0 }`
 * on the server, on the first render and while the ref is empty, then the real size once the
 * element is observed. A change to a size that is the same does not render again.
 *
 * The element is read when the component mounts, or when `target` itself changes: pass an element
 * held in state (a callback ref) when it is swapped for another one.
 *
 * @example
 * ```tsx
 * import { useRef } from "react";
 *
 * function Chart() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const { width } = useSize(ref);
 *   return <div ref={ref}>{width > 600 ? "wide chart" : "compact chart"}</div>;
 * }
 * ```
 *
 * @param target - A ref to the element, the element, or `null`.
 * @returns The size in pixels.
 */
export function useSize(target: MaybeRef<Element>): ElementSize {
  const [size, setSize] = useState(EMPTY);
  useEffect(
    () =>
      observeSize(resolveRef(target), ({ contentRect: { width, height } }) =>
        setSize((current) =>
          current.width === width && current.height === height ? current : { width, height },
        ),
      ),
    [target],
  );
  return size;
}
