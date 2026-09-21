import { createPortal } from "react-dom";
import { useId, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";

/** Props of {@link Portal}. */
export interface PortalProps {
  children?: ReactNode;
  /** The `id` of the wrapper element. Defaults to one that is unique per portal. */
  id?: string;
  /** Renders nothing while `false`. Defaults to `true`. */
  open?: boolean;
  /** Renders the children where the `Portal` is, as if it were not there. Defaults to `false`. */
  disabled?: boolean;
  /** Renders the children straight into the container, without the wrapper element. */
  transient?: boolean;
  /**
   * Where to render. Defaults to `document.body`. `null` means "not ready yet" and renders nothing:
   * keep the element in state with a callback ref (`<div ref={setHost}>`) and pass it.
   */
  container?: Element | DocumentFragment | null;
}

const subscribe = () => () => {};

/**
 * Renders its children outside of the parent's DOM, in `document.body` or in a `container`: for
 * popups, menus and dialogs that a parent with `overflow: hidden` or a stacking context would clip.
 * The children stay in the React tree, so context and events work as if they were rendered in place.
 *
 * Safe for server rendering: with no `document` it renders nothing, and it moves to the container
 * after hydration instead of causing a mismatch.
 *
 * @example
 * ```tsx
 * <Portal open={isOpen}>
 *   <div role="dialog">Hello</div>
 * </Portal>
 * ```
 *
 * @param props - See {@link PortalProps}.
 * @returns The portal, or nothing.
 */
export function Portal({
  children,
  id,
  open = true,
  disabled = false,
  transient = false,
  container,
}: PortalProps): ReactElement | null {
  const generated = useId();
  // `null` on the server and while hydrating, where there is no page to point at yet: a portal
  // cannot be rendered there, and this makes React render it again right after.
  const host = useSyncExternalStore(
    subscribe,
    () => (container === undefined ? document.body : container),
    () => null,
  );

  if (!open) return null;
  if (disabled) return <>{children}</>;
  if (host === null) return null;

  const key = id ?? `PORTAL${generated}`;
  if (transient) return createPortal(children, host, key);
  return createPortal(
    <div style={{ position: "fixed" }} id={key}>
      {children}
    </div>,
    host,
    key,
  );
}
