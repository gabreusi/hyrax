// A local no-op: importing the core one would make the tsdown build emit a shared chunk and tie /dom
// to the root entrypoint for a one-line function.
const noop = () => {};

/** The options `addEventListener` accepts: a capture flag, or an options object. */
export type ListenOptions = boolean | AddEventListenerOptions;

/**
 * `addEventListener` on the window, with the event typed by name, that returns the function that
 * removes it. The removal repeats the capture flag, so capture listeners are removed too.
 *
 * @example
 * ```ts
 * const off = listen(window, "resize", (event) => console.log(event));
 * off();
 * ```
 *
 * @param target - The window, or `null`/`undefined` (nothing is listened to).
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options (`once`, `passive`, `signal`...).
 * @returns A function that removes the listener. Calling it again does nothing.
 */
export function listen<K extends keyof WindowEventMap>(
  target: Window | null | undefined,
  type: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: ListenOptions,
): () => void;
/**
 * `addEventListener` on the document, with the event typed by name.
 *
 * @example
 * ```ts
 * const off = listen(document, "visibilitychange", () => console.log(document.hidden));
 * ```
 *
 * @param target - The document, or `null`/`undefined` (nothing is listened to).
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 * @returns A function that removes the listener.
 */
export function listen<K extends keyof DocumentEventMap>(
  target: Document | null | undefined,
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: ListenOptions,
): () => void;
/**
 * `addEventListener` on an element, with the event typed by name.
 *
 * @example
 * ```ts
 * const off = listen(button, "click", (event) => console.log(event.clientX));
 * ```
 *
 * @param target - The element, or `null`/`undefined` (for example a ref that is not set yet).
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 * @returns A function that removes the listener.
 */
export function listen<K extends keyof HTMLElementEventMap>(
  target: HTMLElement | null | undefined,
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options?: ListenOptions,
): () => void;
/**
 * `addEventListener` on any `EventTarget` (an `EventSource`, an `AbortSignal`, your own bus).
 *
 * @example
 * ```ts
 * const off = listen(new EventTarget(), "ping", () => console.log("pong"));
 * ```
 *
 * @param target - The target, or `null`/`undefined` (nothing is listened to).
 * @param type - The event name.
 * @param handler - Called with the event.
 * @param options - A capture flag or `addEventListener` options.
 * @returns A function that removes the listener.
 */
export function listen(
  target: EventTarget | null | undefined,
  type: string,
  handler: (event: Event) => void,
  options?: ListenOptions,
): () => void;
export function listen(
  target: EventTarget | null | undefined,
  type: string,
  handler: (event: never) => void,
  options?: ListenOptions,
): () => void {
  if (!target) return noop;
  const listener = handler as EventListener;
  target.addEventListener(type, listener, options);

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    target.removeEventListener(type, listener, options);
  };
}
