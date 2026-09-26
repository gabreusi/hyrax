import { useEffect } from "react";
import { lockScroll } from "../dom/lockScroll";

/**
 * Stops the page from scrolling while `active` is `true` and the component is mounted: for a modal
 * or a drawer. It is {@link lockScroll} from `@gabreusi/hyrax/dom`, so locks are counted, and two
 * open dialogs keep the page locked until both close.
 *
 * @example
 * ```tsx
 * function Drawer({ open }: { open: boolean }) {
 *   useScrollLock(open);
 *   return open ? <aside>Menu</aside> : null;
 * }
 * ```
 *
 * @param active - Whether to lock (default `true`).
 */
export function useScrollLock(active = true): void {
  useEffect(() => (active ? lockScroll() : undefined), [active]);
}
