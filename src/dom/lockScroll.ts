// A local no-op, like in listen.ts: importing the core one would tie /dom to the root chunk.
const noop = () => {};

/** How many locks are held, and how to put the page back when the last one goes. */
let locks = 0;
let restore: (() => void) | undefined;

/**
 * Stops the page from scrolling, for a modal or a drawer, and returns the function that lets it
 * scroll again. The space of the scrollbar that disappears is added as padding, so the layout does
 * not jump sideways.
 *
 * Locks are counted: with two dialogs open, closing one keeps the page locked until the other
 * closes too. Each returned function releases its own lock once, and calling it again does nothing.
 * Without a document (server-side rendering) it does nothing.
 *
 * It sets `overflow: hidden` on `<body>`. iOS Safari before 16 ignored that for touch scrolling.
 *
 * @example
 * ```ts
 * const unlock = lockScroll();
 * // ...the dialog is open...
 * unlock();
 * ```
 *
 * @returns A function that releases this lock.
 */
export function lockScroll(): () => void {
  if (typeof document === "undefined") return noop;

  if (locks++ === 0) {
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const { overflow, paddingRight } = body.style;
    const padding = getComputedStyle(body).paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `calc(${padding} + ${gap}px)`;
    restore = () => {
      body.style.overflow = overflow;
      body.style.paddingRight = paddingRight;
    };
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      restore?.();
      restore = undefined;
    }
  };
}
