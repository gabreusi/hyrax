import { listen } from "./listen";

/** An element, or nothing yet (for example a ref that is not set). */
export type ClickOutsideTarget = Element | null | undefined;

/**
 * What counts as "inside": an element, a list of them, or a function that returns either, read on
 * every press (for elements that appear or change later).
 */
export type ClickOutsideTargets =
  | ClickOutsideTarget
  | readonly ClickOutsideTarget[]
  | (() => ClickOutsideTarget | readonly ClickOutsideTarget[]);

/** Options for {@link onClickOutside}. */
export interface ClickOutsideOptions<K extends keyof DocumentEventMap = "pointerdown"> {
  /**
   * The event that counts as a press. Defaults to `"pointerdown"`, which covers mouse, touch and
   * pen and fires before focus moves. Use `"click"`, `"mousedown"` or `"focusin"` when you need it.
   */
  event?: K;
  /**
   * Listen in the capture phase, so an inner `stopPropagation()` cannot hide a press. Defaults to
   * `true`.
   */
  capture?: boolean;
  /** Elements that count as inside, such as the button that opens the popup. */
  ignore?: ClickOutsideTargets;
  /**
   * Only call the handler after a press *inside* has happened, and again only after the next one:
   * what the legacy `BlurListener` did. Defaults to `false`: every press outside calls it.
   */
  requireInsideFirst?: boolean;
}

function resolve(targets: ClickOutsideTargets): Element[] {
  const value = typeof targets === "function" ? targets() : targets;
  const list = Array.isArray(value) ? (value as readonly ClickOutsideTarget[]) : [value];
  return list.filter((target): target is Element => target != null);
}

/** Whether the event happened on, or inside, any of `elements`. */
function isInside(event: Event, elements: readonly Element[]): boolean {
  // The path is fixed when the event is dispatched, so it still names a node that an earlier
  // handler removed, and it crosses shadow trees, where `event.target` is retargeted to the host.
  // Inside a listener it is never empty, so there is nothing to fall back to.
  const path = event.composedPath();
  return elements.some((element) => path.includes(element));
}

/**
 * Calls `handler` when the user presses outside of `targets`: to close a popup, a menu or a
 * dialog. It does not depend on any framework, so it works with React, Vue, Svelte or plain
 * JavaScript. Without a document (server-side rendering) it does nothing.
 *
 * @example
 * ```ts
 * const menu = document.querySelector<HTMLElement>("#menu")!;
 * const openButton = document.querySelector<HTMLElement>("#open")!;
 * const off = onClickOutside(menu, () => menu.classList.remove("open"), { ignore: openButton });
 * off(); // stop listening
 * ```
 *
 * @param targets - What counts as inside: an element, a list, or a function that returns them.
 * @param handler - Called with the event for every press outside.
 * @param options - The event, the capture phase, elements to ignore, and `requireInsideFirst`.
 * @returns A function that stops listening. Calling it again does nothing.
 */
export function onClickOutside<K extends keyof DocumentEventMap = "pointerdown">(
  targets: ClickOutsideTargets,
  handler: (event: DocumentEventMap[K]) => void,
  options: ClickOutsideOptions<K> = {},
): () => void {
  const {
    event = "pointerdown" as K,
    capture = true,
    ignore,
    requireInsideFirst = false,
  } = options;

  // With `requireInsideFirst`, the handler is armed by a press inside and disarmed once it runs.
  let armed = !requireInsideFirst;

  return listen(
    typeof document === "undefined" ? null : document,
    event,
    (pressed) => {
      const inside =
        isInside(pressed, resolve(targets)) ||
        (ignore !== undefined && isInside(pressed, resolve(ignore)));
      if (inside) {
        if (requireInsideFirst) armed = true;
        return;
      }
      if (!armed) return;
      if (requireInsideFirst) armed = false;
      handler(pressed);
    },
    { capture },
  );
}
