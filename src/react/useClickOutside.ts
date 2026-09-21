import { useEffect } from "react";
import { onClickOutside } from "../dom/onClickOutside";
import type { ClickOutsideOptions } from "../dom/onClickOutside";
import { resolveRef } from "./internal/refs";
import type { MaybeRef } from "./internal/refs";
import { useLatest } from "./internal/useLatest";

/** What counts as inside: a ref, an element, or a list mixing both. Empty refs are skipped. */
export type ClickOutsideRefs = MaybeRef<Element> | readonly MaybeRef<Element>[];

/** Options for {@link useClickOutside}: those of `onClickOutside`, with refs allowed in `ignore`. */
export interface UseClickOutsideOptions<
  K extends keyof DocumentEventMap = "pointerdown",
> extends Omit<ClickOutsideOptions<K>, "ignore"> {
  /** Refs or elements that count as inside, such as the button that opens the popup. */
  ignore?: ClickOutsideRefs;
}

function elements(refs: ClickOutsideRefs): (Element | null)[] {
  const list = Array.isArray(refs)
    ? (refs as readonly MaybeRef<Element>[])
    : [refs as MaybeRef<Element>];
  return list.map((ref) => resolveRef(ref));
}

/**
 * Calls `handler` when the user presses outside of `refs`, for as long as the component is
 * mounted: to close a popup, a menu or a dialog.
 *
 * Refs are read at the moment of each press, so an element that is rendered later is found, and
 * `refs`, `ignore` and `handler` may be new on every render without listening again. Only the
 * `event`, `capture` and `requireInsideFirst` options listen again when they change.
 *
 * "Inside" is decided by the DOM, not by the React tree: a `Portal` renders in another place of
 * the page, so list its content in `refs` too, or a press on it counts as outside.
 *
 * @example
 * ```tsx
 * import { useRef, useState } from "react";
 *
 * function Menu() {
 *   const [open, setOpen] = useState(false);
 *   const popup = useRef<HTMLDivElement>(null);
 *   const opener = useRef<HTMLButtonElement>(null);
 *   useClickOutside(popup, () => setOpen(false), { ignore: opener });
 *   return (
 *     <>
 *       <button ref={opener} onClick={() => setOpen(!open)}>
 *         Menu
 *       </button>
 *       {open && <div ref={popup}>Items</div>}
 *     </>
 *   );
 * }
 * ```
 *
 * @param refs - What counts as inside: a ref, an element, or a list of them.
 * @param handler - Called with the event for every press outside.
 * @param options - The event, the capture phase, elements to ignore, and `requireInsideFirst`.
 */
export function useClickOutside<K extends keyof DocumentEventMap = "pointerdown">(
  refs: ClickOutsideRefs,
  handler: (event: DocumentEventMap[K]) => void,
  options: UseClickOutsideOptions<K> = {},
): void {
  const { event, capture, requireInsideFirst } = options;
  const latestRefs = useLatest(refs);
  const latestIgnore = useLatest(options.ignore);
  const latestHandler = useLatest(handler);

  useEffect(
    () =>
      onClickOutside(
        () => elements(latestRefs.current),
        (pressed) => latestHandler.current(pressed),
        { event, capture, requireInsideFirst, ignore: () => elements(latestIgnore.current) },
      ),
    [event, capture, requireInsideFirst, latestRefs, latestIgnore, latestHandler],
  );
}
