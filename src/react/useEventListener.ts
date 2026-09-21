import { useEffect } from "react";
import { listen } from "../dom/listen";
import type { ListenOptions } from "../dom/listen";
import { resolveRef } from "./internal/refs";
import type { MaybeRef } from "./internal/refs";
import { useLatest } from "./internal/useLatest";

/**
 * Listens to an event on the window for as long as the component is mounted.
 *
 * The handler is read from the latest render, so it can use fresh props and state without a
 * dependency array and without listening again. Changing `type`, the target or an option does
 * listen again.
 *
 * @example
 * ```tsx
 * import { useState } from "react";
 *
 * function Width() {
 *   const [width, setWidth] = useState(0);
 *   useEventListener(window, "resize", () => setWidth(window.innerWidth));
 *   return <p>{width}px</p>;
 * }
 * ```
 *
 * @param target - The window, a ref to it, or `null`/`undefined` (nothing is listened to). On the
 * server `window` does not exist: pass `globalThis.window`, which is `undefined` there.
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options. A new object every render is fine.
 */
export function useEventListener<K extends keyof WindowEventMap>(
  target: MaybeRef<Window>,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: ListenOptions,
): void;
/**
 * Listens to an event on the document for as long as the component is mounted.
 *
 * @example
 * ```tsx
 * import { useState } from "react";
 *
 * function Visibility() {
 *   const [hidden, setHidden] = useState(false);
 *   useEventListener(document, "visibilitychange", () => setHidden(document.hidden));
 *   return <p>{hidden ? "Away" : "Here"}</p>;
 * }
 * ```
 *
 * @param target - The document, a ref to it, or `null`/`undefined`. On the server pass
 * `globalThis.document`.
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 */
export function useEventListener<K extends keyof DocumentEventMap>(
  target: MaybeRef<Document>,
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: ListenOptions,
): void;
/**
 * Listens to an event on an element for as long as the component is mounted.
 *
 * A ref is read when the effect runs, after the first render. An element that is rendered
 * conditionally, and so appears later, is missed by a ref: keep it in state with a callback ref
 * (`<div ref={setNode}>`) and pass the state instead.
 *
 * @example
 * ```tsx
 * import { useRef } from "react";
 *
 * function Clicker() {
 *   const button = useRef<HTMLButtonElement>(null);
 *   useEventListener(button, "click", (event) => console.log(event.clientX));
 *   return <button ref={button}>Click</button>;
 * }
 * ```
 *
 * @param target - The element, a ref to it, or `null`/`undefined`.
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 */
export function useEventListener<K extends keyof HTMLElementEventMap>(
  target: MaybeRef<HTMLElement>,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: ListenOptions,
): void;
/**
 * Listens to an event on any `EventTarget` (an SVG element, an `EventSource`, your own bus).
 *
 * @example
 * ```tsx
 * function Bus({ bus }: { bus: EventTarget }) {
 *   useEventListener(bus, "message", (event) => console.log(event));
 *   return null;
 * }
 * ```
 *
 * @param target - The target, a ref to it, or `null`/`undefined`.
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 */
export function useEventListener(
  target: MaybeRef<EventTarget>,
  type: string,
  handler: (event: Event) => void,
  options?: ListenOptions,
): void;
export function useEventListener(
  target: MaybeRef<EventTarget>,
  type: string,
  handler: (event: never) => void,
  options?: ListenOptions,
): void {
  const latest = useLatest(handler as (event: Event) => void);
  // The options are taken apart so that a new object with the same content does not listen again.
  const { capture, once, passive, signal } =
    typeof options === "boolean" ? { capture: options } : (options ?? {});

  useEffect(
    () =>
      listen(resolveRef(target), type, (event) => latest.current(event), {
        capture,
        once,
        passive,
        signal,
      }),
    [target, type, capture, once, passive, signal, latest],
  );
}
